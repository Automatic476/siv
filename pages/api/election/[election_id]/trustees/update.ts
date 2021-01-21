import { sumBy } from 'lodash-es'
import { NextApiRequest, NextApiResponse } from 'next'

import decrypt from '../../../../../src/crypto/decrypt'
import { decode } from '../../../../../src/crypto/encode'
import encrypt from '../../../../../src/crypto/encrypt'
import pickRandomInteger from '../../../../../src/crypto/pick-random-integer'
import {
  combine_partials,
  compute_keyshare,
  compute_pub_key,
  evaluate_private_polynomial,
  is_received_share_valid,
  partial_decrypt,
  unlock_message_with_shared_secret,
} from '../../../../../src/crypto/threshold-keygen'
import { big, bigCipher, bigPubKey, toStrings } from '../../../../../src/crypto/types'
import { Shuffled, State, Trustee } from '../../../../../src/trustee/trustee-state'
import { mapValues } from '../../../../../src/utils'
import { firebase } from '../../../_services'
import { pusher } from '../../../pusher'
import { recombine_decrypteds } from '../close'
import { commafy, transform_email_keys } from './commafy'

const { ADMIN_EMAIL } = process.env

export default async (req: NextApiRequest, res: NextApiResponse) => {
  if (!ADMIN_EMAIL) return res.status(501).send('Missing process.env.ADMIN_EMAIL')

  const { election_id } = req.query
  const { body } = req
  const { email, trustee_auth } = body
  console.log('/api/update received:', body)

  if (!email) return res.status(404).end()

  const electionDoc = firebase
    .firestore()
    .collection('elections')
    .doc(election_id as string)

  // Begin preloading these docs
  const trusteeDoc = electionDoc.collection('trustees').doc(email)
  const adminDoc = electionDoc.collection('trustees').doc(ADMIN_EMAIL)
  const loadTrustee = trusteeDoc.get()
  const loadAdmin = adminDoc.get()

  // Is election_id in DB?
  const election = await electionDoc.get()
  if (!election.exists) return res.status(400).send('Unknown Election ID.')

  // Grab claimed trustee
  const trustee = { ...(await loadTrustee).data() }

  // Authenticate by checking if trustee_auth token matches
  if (trustee.auth_token !== trustee_auth) return res.status(401).send('Bad trustee_auth token')

  // Remove email & trustee_auth from body obj
  delete body.email
  delete body.trustee_auth

  // Escape object keys w/ periods into commas
  // (Firebase doesn't like dots in keys)
  const commafied = transform_email_keys(body, 'commafy')

  // Save whatever other new data they gave us
  await trusteeDoc.update(commafied)
  console.log('Saved update to', email, commafied)

  const promises: Promise<unknown>[] = []

  // Notify all participants there's been an update
  promises.push(pusher.trigger('keygen', 'update', { [email]: body }))

  // If they provided their public key, admin can now encrypt pairwise shares for them.
  // If they provided encrypted shares, admin can decrypt their own and verify them.
  // If they provided the final shuffled votes, admin can partially decrypt
  // If they provided the final partial, admin can combine partials
  if (body.recipient_key || body.encrypted_pairwise_shares_for || body.shuffled || body.partials) {
    // Get admin's private data
    const admin = { ...(await loadAdmin).data() } as Required<State> & {
      decryption_key: string
      recipient_key: string
    }
    const { decryption_key, private_coefficients, private_keyshare, recipient_key } = admin

    // Get election parameters
    const parameters = { ...election.data() }
    const big_parameters = { g: big(parameters.g), p: big(parameters.p), q: big(parameters.q) }

    // Logic for new recipient_key
    if (body.recipient_key) {
      // Calculate admin's pairwise share for this trustee
      const pairwise_share = evaluate_private_polynomial(
        trustee.index + 1,
        private_coefficients.map((c) => big(c)),
        big_parameters,
      ).toString()

      // Encrypt the pairwise shares for the target recipients eyes only...

      // First we pick a randomizer
      const pairwise_randomizer = pickRandomInteger(big(parameters.p)).toString()

      // Then we encrypt
      const encrypted_pairwise_share = toStrings(
        encrypt(
          bigPubKey({ generator: parameters.g, modulo: parameters.p, recipient: body.recipient_key }),
          big(pairwise_randomizer),
          big(pairwise_share),
        ),
      )

      const admin_update = {
        [`encrypted_pairwise_shares_for.${commafy(email)}`]: encrypted_pairwise_share,
        [`pairwise_randomizers_for.${commafy(email)}`]: pairwise_randomizer,
        [`pairwise_shares_for.${commafy(email)}`]: pairwise_share,
      }

      // Store all the new data we created
      await adminDoc.update(admin_update)
      console.log('Updated admin:', admin_update)

      // Notify all participants there's been an update
      promises.push(
        pusher.trigger('keygen', 'update', {
          [ADMIN_EMAIL]: { encrypted_pairwise_shares_for: { [email]: encrypted_pairwise_share } },
        }),
      )
    }

    // Logic for new encrypted shares
    if (body.encrypted_pairwise_shares_for) {
      let encrypted
      try {
        encrypted = JSON.parse(body.encrypted_pairwise_shares_for[ADMIN_EMAIL])
      } catch (e) {
        return console.error(`Error parsing encrypted share from ${email} for admin`, e)
      }
      // Decrypt the share for admin
      const decrypted_share = decrypt(
        bigPubKey({
          generator: parameters.g,
          modulo: parameters.p,
          recipient: recipient_key,
        }),
        big(decryption_key),
        bigCipher(encrypted),
      )

      // Verify the received share
      const verification = is_received_share_valid(big(decrypted_share), 1, trustee.commitments, big_parameters)

      // Store all the new data we created
      const admin_update = {
        [`decrypted_shares_from.${commafy(email)}`]: decrypted_share,
        [`verified.${commafy(email)}`]: verification,
      }
      await adminDoc.update(admin_update)
      console.log('Updated admin:', admin_update)

      // Notify all participants there's been an update
      promises.push(pusher.trigger('keygen', 'update', { [ADMIN_EMAIL]: { verification: { [email]: verification } } }))

      // If admin has verified all shares, they can now (1) calculate their own private keyshare, (2) the public threshold key, and (3) encrypt and then (4) partially decrypt a test message.

      // Get latest admin data
      const adminLatest = { ...(await adminDoc.get()).data() } as State
      const numPassed = sumBy(Object.values(adminLatest.verified || {}), Number)
      const numExpected = parameters.t - 1
      // Stop if not enough have passed yet
      if (!numPassed || numPassed !== numExpected) return

      const incoming_bigs = Object.values(adminLatest.decrypted_shares_from || {}).map((n) => big(n))

      // (1) Calculate admins private keyshare
      const private_keyshare = compute_keyshare(incoming_bigs, big_parameters.q).toString()

      // Get all trustees
      const trustees: Trustee[] = []
      ;(await electionDoc.collection('trustees').get()).forEach((doc) => trustees.push({ ...doc.data() } as Trustee))
      const constant_commitments = trustees.map((t) => big(t.commitments[0]))

      // (2) Calculate & store public threshold key
      const threshold_public_key = compute_pub_key(constant_commitments, big_parameters.p).toString()
      await electionDoc.update({ threshold_public_key })
      // Notify admin panel the pub key was created
      promises.push(pusher.trigger(`create-${election_id}`, 'pub_key', { threshold_public_key }))

      // (3) Encrypt test message
      const randomizer = '108'
      const unlock = big_parameters.g.modPow(big(randomizer), big_parameters.p)

      // (4) Partially decrypt test message
      const partial_decryption = partial_decrypt(unlock, big(private_keyshare), big_parameters).toString()

      // Store admin's private_keyshare & partial_decryption
      const admin_update_2 = { partial_decryption, private_keyshare }
      await adminDoc.update(admin_update_2)
      console.log('Updated admin:', admin_update_2)

      // Notify all participants there's been an update
      promises.push(pusher.trigger('keygen', 'update', { [ADMIN_EMAIL]: { partial_decryption } }))
    }

    // Logic for final shuffled votes
    if (body.shuffled) {
      // If this is the last trustee, we can begin partially decrypting
      if (trustee.index === parameters.t - 1) {
        // Partially decrypt each item in every list
        const partials = mapValues(body.shuffled as Shuffled, (list) =>
          (list as string[]).map((cipher_string) => {
            const { unlock } = JSON.parse(cipher_string)
            return partial_decrypt(big(unlock), big(private_keyshare), big_parameters).toString()
          }),
        )

        // Store partials
        await adminDoc.update({ partials })
        console.log('Updated admin partials:', partials)

        // Notify all participants there's been an update
        promises.push(pusher.trigger('keygen', 'update', { [ADMIN_EMAIL]: { partials } }))
      }
    }

    // Logic for final partial
    if (body.partials) {
      // Get all trustees
      const trustees = (await electionDoc.collection('trustees').orderBy('index').get()).docs.map((doc) => ({
        ...doc.data(),
      }))

      // Have all trustees now uploaded partials for the last shuffled list?
      const last_shuffled = trustees[trustees.length - 1].shuffled as Shuffled
      const columns = Object.keys(last_shuffled)
      const last_shuffled_length = last_shuffled[columns[0]].length
      if (trustees.every((t) => t.partials && t.partials[columns[0]].length >= last_shuffled_length)) {
        // Ok, ready to decrypt...

        // For each column
        const decrypted_and_split = mapValues(last_shuffled, (list, key) => {
          // For each row
          return (list as string[]).map((shuffled_vote, index) => {
            // 1. First we combine the partials to get the ElGamal shared secret
            const partials = trustees.map((t) => big(t.partials[key][index]))
            const shared_secret = combine_partials(partials, big_parameters)

            // 2. Then we can unlock each messages
            const { encrypted } = JSON.parse(shuffled_vote)
            const unlocked = unlock_message_with_shared_secret(shared_secret, big(encrypted), big_parameters.p)
            return decode(unlocked)
          })
        }) as Record<string, string[]>

        // 3. Finally we recombine the separated columns back together via tracking numbers
        const decrypteds_by_tracking = recombine_decrypteds(decrypted_and_split)

        // Store decrypteds as an array
        const decrypted = Object.values(decrypteds_by_tracking)
        // 4. And save the results to election.decrypted
        await electionDoc.update({ decrypted, last_decrypted_at: new Date() })
        // And notify everyone we have new decrypted
        await pusher.trigger(election_id, 'decrypted', '')
      }
    }
  }

  // Wait for all pending promises to finish
  await Promise.all(promises)

  res.status(201).send(`Updated ${email} object`)
}