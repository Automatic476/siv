import bluebird from 'bluebird'
import { sumBy } from 'lodash-es'
import { NextApiRequest, NextApiResponse } from 'next'
import { RP, pointToString, random_bigint } from 'src/crypto/curve'
import { keygenDecrypt, keygenEncrypt } from 'src/crypto/keygen-encrypt'
import { rename_to_c1_and_2 } from 'src/crypto/shuffle'
import { verify_shuffle_proof } from 'src/crypto/shuffle-proof'
import { destringifyPartial, stringifyPartial } from 'src/crypto/stringify-partials'
import { destringifyShuffle } from 'src/crypto/stringify-shuffle'
import {
  combine_partials,
  compute_g_to_keyshare,
  compute_keyshare,
  compute_pub_key,
  evaluate_private_polynomial,
  generate_partial_decryption_proof,
  is_received_share_valid,
  partial_decrypt,
  unlock_message_with_shared_secret,
  verify_partial_decryption_proof,
} from 'src/crypto/threshold-keygen'
import { randomizer } from 'src/trustee/keygen/11-PartialDecryptionTest'
import { Partial, Shuffled, State, Trustee } from 'src/trustee/trustee-state'
import { mapValues } from 'src/utils'

import { firebase } from '../../../_services'
import { pusher } from '../../../pusher'
import { recombine_decrypteds } from '../admin/unlock'
import { commafy, transform_email_keys } from './commafy'

const { ADMIN_EMAIL } = process.env

export default async (req: NextApiRequest, res: NextApiResponse) => {
  if (!ADMIN_EMAIL) return res.status(501).send('Missing process.env.ADMIN_EMAIL')

  const { election_id } = req.query
  if (typeof election_id !== 'string') return res.status(400).send('Malformed election_id')
  const { body } = req
  const { auth, email } = body
  console.log('/api/update received:', body)

  if (!email) return res.status(404).end()

  const electionDoc = firebase.firestore().collection('elections').doc(election_id)

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

  // Authenticate by checking if auth token matches
  if (trustee.auth_token !== auth) return res.status(401).send('Bad auth token')

  // Remove email & auth from body obj
  delete body.email
  delete body.auth

  // If pub key, also store req headers (user agent, ip address)
  if (body.recipient_key) body.headers = req.headers

  // Escape object keys w/ periods into commas
  // (Firebase doesn't like dots in keys)
  const commafied = transform_email_keys(body, 'commafy')

  // Save whatever other new data they gave us
  await trusteeDoc.update(commafied)
  console.log('Saved update to', email, commafied)

  const promises: Promise<unknown>[] = []

  // Notify all participants there's been an update
  promises.push(pusher.trigger(`keygen-${election_id}`, 'update', { [email]: Object.keys(body) }))

  // If they provided their public key, admin can now encrypt pairwise shares for them.
  // If they provided encrypted shares, admin can decrypt their own and verify them.
  // If they provided the final shuffled votes, admin can partially decrypt
  // If they provided the final partial, admin can combine partials
  if (body.recipient_key || body.encrypted_pairwise_shares_for || body.shuffled || body.partials) {
    // Get admin's private data
    const admin = { ...(await loadAdmin).data() } as Required<State> & { decryption_key: string }
    const { decryption_key, private_coefficients, private_keyshare } = admin

    // Get election parameters
    const parameters = { ...election.data() }

    // Logic for new recipient_key
    if (body.recipient_key) {
      // Calculate admin's pairwise share for this trustee
      const pairwise_share = evaluate_private_polynomial(trustee.index + 1, private_coefficients.map(BigInt)).toString()

      // Encrypt the pairwise shares for the target recipients eyes only...

      // First we pick a randomizer
      const pairwise_randomizer = random_bigint()

      // Then we encrypt
      const encrypted_pairwise_share = JSON.stringify(
        await keygenEncrypt(RP.fromHex(body.recipient_key), pairwise_randomizer, pairwise_share),
      )

      const admin_update = {
        [`encrypted_pairwise_shares_for.${commafy(email)}`]: encrypted_pairwise_share,
        [`pairwise_randomizers_for.${commafy(email)}`]: String(pairwise_randomizer),
        [`pairwise_shares_for.${commafy(email)}`]: pairwise_share,
      }

      // Store all the new data we created
      await adminDoc.update(admin_update)
      console.log('Updated admin:', admin_update)

      // Notify all participants there's been an update
      promises.push(
        pusher.trigger(`keygen-${election_id}`, 'update', {
          [ADMIN_EMAIL]: { encrypted_pairwise_shares_for: { [email]: encrypted_pairwise_share } },
        }),
      )
    }

    // Logic for new encrypted shares
    if (body.encrypted_pairwise_shares_for) {
      // Decrypt the share for admin
      const decrypted_share = await keygenDecrypt(
        BigInt(decryption_key),
        body.encrypted_pairwise_shares_for[ADMIN_EMAIL],
      )

      // Verify the received share
      const verification = is_received_share_valid(BigInt(decrypted_share), 1, trustee.commitments.map(RP.fromHex))

      // Store all the new data we created
      const admin_update = {
        [`decrypted_shares_from.${commafy(email)}`]: decrypted_share,
        [`verified.${commafy(email)}`]: verification,
      }
      await adminDoc.update(admin_update)
      console.log('Updated admin:', admin_update)

      // Notify all participants there's been an update
      promises.push(
        pusher.trigger(`keygen-${election_id}`, 'update', {
          [ADMIN_EMAIL]: { verification: { [email]: verification } },
        }),
      )

      // If admin has verified all shares, they can now (1) calculate their own private keyshare, (2) the public threshold key, and (3) encrypt and then (4) partially decrypt a test message.

      // Get latest admin data
      const adminLatest = { ...(await adminDoc.get()).data() } as State
      const numPassed = sumBy(Object.values(adminLatest.verified || {}), Number)
      const numExpected = parameters.t - 1
      // Stop if not enough have passed yet
      if (numPassed !== numExpected) return

      const incoming_bigs = Object.values(adminLatest.decrypted_shares_from || {}).map(BigInt)

      // (1) Calculate admins private keyshare
      const private_keyshare = compute_keyshare(incoming_bigs).toString()

      // Get all trustees
      const trustees: Trustee[] = []
      ;(await electionDoc.collection('trustees').get()).forEach((doc) => trustees.push({ ...doc.data() } as Trustee))
      const constant_commitments = trustees.map((t) => RP.fromHex(t.commitments[0]))

      // (2) Calculate & store public threshold key
      const threshold_public_key = compute_pub_key(constant_commitments).toString()
      await electionDoc.update({ threshold_public_key })
      // Notify admin panel the pub key was created
      promises.push(pusher.trigger(`status-${election_id}`, 'pub_key', { threshold_public_key }))

      // (3) Encrypt test message
      // (since it's just for testing, we only need the Lock half to compute the partial)
      const Lock = RP.BASE.multiply(randomizer)

      // (4) Partially decrypt test message
      const partial_decryption = partial_decrypt(Lock, BigInt(private_keyshare)).toString()

      // Store admin's private_keyshare & partial_decryption
      const admin_update_2 = { partial_decryption, private_keyshare }
      await adminDoc.update(admin_update_2)
      console.log('Updated admin:', admin_update_2)

      // Notify all participants there's been an update
      promises.push(pusher.trigger(`keygen-${election_id}`, 'update', { [ADMIN_EMAIL]: { partial_decryption } }))
    }

    // Logic for final shuffled votes
    if (body.shuffled) {
      // If this is the last trustee, we can begin partially decrypting
      if (trustee.index === parameters.t - 1) {
        const { shuffled } = body

        const trustees = (await electionDoc.collection('trustees').orderBy('index').get()).docs.map((doc) => ({
          ...doc.data(),
        }))

        // Confirm that every column's shuffle proof is valid
        const checks = await bluebird.map(Object.keys(shuffled), (column) => {
          const { shuffled: prevShuffle } = destringifyShuffle(trustees[trustee.index - 1].shuffled[column])
          const { proof, shuffled: currShuffle } = destringifyShuffle(shuffled[column])

          return verify_shuffle_proof(rename_to_c1_and_2(prevShuffle), rename_to_c1_and_2(currShuffle), proof)
        })

        if (!checks.length || !checks.every((x) => x)) {
          console.log("Final shuffle proof didn't fully pass")
        } else {
          // Partially decrypt each item in every list
          const partials = await bluebird.reduce(
            Object.keys(shuffled),
            (acc: Record<string, Partial[]>, column) =>
              bluebird.props({
                ...acc,
                [column]: bluebird.map((shuffled as Shuffled)[column].shuffled, async ({ lock }) => ({
                  partial: partial_decrypt(RP.fromHex(lock), BigInt(private_keyshare)).toHex(),
                  proof: stringifyPartial(
                    await generate_partial_decryption_proof(RP.fromHex(lock), BigInt(private_keyshare)),
                  ),
                })),
              }),
            {},
          )

          // Store partials
          await adminDoc.update({ partials })
          console.log('Updated admin partials:', partials)

          // Notify all participants there's been an update
          promises.push(
            pusher.trigger(`keygen-${election_id}`, 'update', { [ADMIN_EMAIL]: { partials: partials.length } }),
          )
        }
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
      const last_shuffled_length = last_shuffled[columns[0]].shuffled.length

      if (trustees.every((t) => t.partials && t.partials[columns[0]].length >= last_shuffled_length)) {
        // Verify that all partials have passing ZK Proofs
        const all_broadcasts = trustees.map(({ commitments }) => commitments.map(RP.fromHex))
        const last_trustees_shuffled = trustees[trustees.length - 1].shuffled
        let any_failed = false
        // For all trustees...
        await bluebird.map(trustees, ({ partials }, index) => {
          const g_to_trustees_keyshare = compute_g_to_keyshare(index + 1, all_broadcasts)
          // For all columns...
          return bluebird.map(
            Object.keys(partials),
            // For all votes
            (column) =>
              bluebird.map(partials[column], async ({ partial, proof }: Partial, voteIndex) => {
                const result = await verify_partial_decryption_proof(
                  RP.fromHex(last_trustees_shuffled[column].shuffled[voteIndex].lock),
                  g_to_trustees_keyshare,
                  RP.fromHex(partial),
                  destringifyPartial(proof),
                )
                if (!result) any_failed = true
              }),
          )
        })
        if (any_failed) {
          console.log('⚠️  Not all Partial proofs passed, refusing to combine')
        } else {
          // Ok, now ready to combine partials and finish decryption...

          // For each column
          const decrypted_and_split = mapValues(last_shuffled, (list, key) => {
            // For each row
            return (list as { shuffled: { encrypted: string }[] }).shuffled.map(({ encrypted }, index) => {
              // 1. First we combine the partials to get the ElGamal shared secret
              const partials = trustees.map((t) => RP.fromHex(t.partials[key][index].partial))
              const shared_secret = combine_partials(partials)

              // 2. Then we can unlock each messages
              const unlocked = unlock_message_with_shared_secret(shared_secret, RP.fromHex(encrypted))
              return pointToString(unlocked)
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
  }

  // Wait for all pending promises to finish
  await Promise.all(promises)

  res.status(201).send(`Updated ${email} object`)
}
