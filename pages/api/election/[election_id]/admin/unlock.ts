const { ADMIN_PASSWORD } = process.env

import { mapValues } from 'lodash-es'
import { NextApiRequest, NextApiResponse } from 'next'

import decrypt from '../../../../../src/crypto/decrypt'
import { decode } from '../../../../../src/crypto/encode'
import { shuffle } from '../../../../../src/crypto/shuffle'
import { big, bigCipher, bigPubKey, toStrings } from '../../../../../src/crypto/types'
import { firebase, pushover } from '../../../_services'
import { pusher } from '../../../pusher'

const { ADMIN_EMAIL } = process.env

export default async (req: NextApiRequest, res: NextApiResponse) => {
  if (!ADMIN_EMAIL) return res.status(501).json({ error: 'Missing process.env.ADMIN_EMAIL' })

  const { election_id, password } = req.query
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: `Invalid Password: '${password}'` })

  const electionDoc = firebase
    .firestore()
    .collection('elections')
    .doc(election_id as string)

  // Begin preloading these requests
  const loadVotes = electionDoc.collection('votes').get()
  const election = electionDoc.get()
  const adminDoc = electionDoc.collection('trustees').doc(ADMIN_EMAIL)
  const admin = adminDoc.get()

  // Is election_id in DB?
  if (!(await election).exists) return res.status(400).json({ error: `Unknown Election ID: '${election_id}'` })

  const { esignature_requested, g, p, t, threshold_public_key } = { ...(await election).data() } as {
    esignature_requested: boolean
    g: string
    p: string
    t: number
    threshold_public_key: string
  }
  const public_key = bigPubKey({ generator: g, modulo: p, recipient: threshold_public_key })

  type Cipher = { encrypted: string; unlock: string }

  // First admin removes the auth tokens
  const encrypteds_without_auth_tokens = (await loadVotes).docs.reduce((acc: Record<string, Cipher>[], doc) => {
    const data = doc.data()

    // Filter out non-approved
    const is_approved = false // FIX ME
    if (esignature_requested && !is_approved) {
      return [...acc]
    }

    return [...acc, data.encrypted_vote]
  }, [])

  // Then we split up the votes into individual lists for each item
  // input: [
  //   { item1: Cipher, item2: Cipher },
  //   { item1: Cipher, item2: Cipher },
  //   { item1: Cipher, item2: Cipher },
  // ]
  // output: {
  //   item1: [Cipher, Cipher, Cipher],
  //   item2: [Cipher, Cipher, Cipher],
  // }
  const split = encrypteds_without_auth_tokens.reduce((acc: Record<string, Cipher[]>, encrypted) => {
    Object.keys(encrypted).forEach((key) => {
      if (!acc[key]) acc[key] = []
      acc[key].push(encrypted[key])
    })
    return acc
  }, {})

  // Then admin does a SIV shuffle (permute + re-encryption) for each item's list
  const shuffled = mapValues(split, (list) => shuffle(public_key, list.map(bigCipher)).map(toStrings))

  // Store admins shuffled lists
  await adminDoc.update({ shuffled })
  try {
    await pusher.trigger('keygen', 'update', { 'admin@secureintervoting.org': { shuffled } })
  } catch (e) {
    await pushover('Failed to Pusher.trigger(keygen, update, admin@, shuffled)', JSON.stringify(e))
  }

  // Is admin the only trustee?
  if (t === 1) {
    // Yes, we can begin decryption...
    const { private_keyshare: decryption_key } = { ...(await admin).data() } as { private_keyshare: string }

    // Decrypt votes
    const decrypted_and_split = mapValues(shuffled, (list) => {
      return list.map((value) =>
        decode(
          decrypt(public_key, big(decryption_key), {
            encrypted: big(JSON.parse(value).encrypted),
            unlock: big(JSON.parse(value).unlock),
          }),
        ),
      )
    })

    const decrypteds_by_tracking = recombine_decrypteds(decrypted_and_split)

    // Store decrypteds as an array
    const decrypted = Object.values(decrypteds_by_tracking)

    await electionDoc.update({ decrypted, last_decrypted_at: new Date() })

    await pusher.trigger(election_id, 'decrypted', '')
  }

  res.status(201).json({ message: 'Triggered unlock' })
}

/** Recombine the columns back together via tracking numbers */
export const recombine_decrypteds = (decrypted_and_split: Record<string, string[]>) => {
  type Recombined = Record<string, Record<string, string>>
  const decrypteds_by_tracking = Object.keys(decrypted_and_split).reduce((acc: Recombined, key) => {
    decrypted_and_split[key].forEach((value) => {
      const [tracking, vote] = value.split(':')

      // Skip if 'BLANK'
      if (vote === 'BLANK') return

      // Create vote obj if needed
      if (!acc[tracking]) {
        acc[tracking] = { tracking }
      }

      acc[tracking] = { ...acc[tracking], [key]: vote }
    })
    return acc
  }, {})

  return decrypteds_by_tracking
}
