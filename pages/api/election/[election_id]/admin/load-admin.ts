import { NextApiRequest, NextApiResponse } from 'next'

import { firebase } from '../../../_services'
import { checkJwt } from '../../../validate-admin-jwt'
import { QueueLog } from './invite-voters'

export type ReviewLog = { review: 'approve' | 'reject' }

export type Voter = {
  auth_token: string
  email: string
  esignature?: string
  esignature_review: ReviewLog[]
  has_voted: boolean
  index: number
  invite_queued?: QueueLog[]
  mailgun_events: { accepted?: MgEvent[]; delivered?: MgEvent[]; failed?: MgEvent[] }
}
type Trustee = {
  email: string
  mailgun_events: { accepted?: MgEvent[]; delivered?: MgEvent[]; failed?: MgEvent[] }
  name?: string
}

type MgEvent = Record<string, unknown>

export type AdminData = {
  ballot_design?: string
  election_id?: string
  election_manager?: string
  election_title?: string
  esignature_requested?: boolean
  threshold_public_key?: string
  trustees?: Trustee[]
  voters?: Voter[]
}

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const { election_id } = req.query as { election_id?: string; password?: string }

  // Check required params
  if (!election_id) return res.status(401).json({ error: `Missing election_id` })

  // Confirm they're a valid admin
  if (!checkJwt(req, res).valid) return

  const election = firebase
    .firestore()
    .collection('elections')
    .doc(election_id as string)

  // Begin preloading all these docs
  const loadElection = election.get()
  const loadTrustees = election.collection('trustees').orderBy('index', 'asc').get()
  const loadVoters = election.collection('voters').orderBy('index', 'asc').get()
  const loadVotes = election.collection('votes').get()

  // Is election_id in DB?
  const electionDoc = await loadElection
  if (!electionDoc.exists) return res.status(400).json({ error: `Unknown Election ID: '${election_id}'` })

  const { ballot_design, election_manager, election_title, esignature_requested, threshold_public_key } = {
    ...electionDoc.data(),
  } as {
    ballot_design?: string
    election_manager?: string
    election_title?: string
    esignature_requested?: boolean
    threshold_public_key?: string
  }

  // Build trustees objects
  const trustees = (await loadTrustees).docs.reduce((acc: Trustee[], doc) => {
    const { email, mailgun_events, name } = { ...doc.data() } as {
      email: string
      mailgun_events: { accepted: MgEvent[]; delivered: MgEvent[] }
      name?: string
    }
    return [...acc, { email, mailgun_events, name }]
  }, [])

  // Gather who's voted already
  const votesByAuth: Record<string, [boolean, string?]> = (await loadVotes).docs.reduce((acc, doc) => {
    const data = doc.data()
    return { ...acc, [data.auth]: [true, data.esignature] }
  }, {})

  // Build voters objects
  const voters: Voter[] = (await loadVoters).docs.reduce((acc: Voter[], doc) => {
    const { auth_token, email, esignature_review, index, invite_queued, mailgun_events } = { ...doc.data() } as {
      auth_token: string
      email: string
      esignature_review: ReviewLog[]
      index: number
      invite_queued: QueueLog[]
      mailgun_events: { accepted: MgEvent[]; delivered: MgEvent[] }
    }
    return [
      ...acc,
      {
        auth_token,
        email,
        esignature: (votesByAuth[auth_token] || [])[1],
        esignature_review,
        has_voted: !!votesByAuth[auth_token],
        index,
        invite_queued,
        mailgun_events,
      },
    ]
  }, [])

  return res.status(200).send({
    ballot_design,
    election_id,
    election_manager,
    election_title,
    esignature_requested,
    threshold_public_key,
    trustees,
    voters,
  } as AdminData)
}
