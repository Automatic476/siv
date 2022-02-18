import { NextApiRequest, NextApiResponse } from 'next'

import { pushover } from '../_services'
import { supabase } from '../_supabase'

export default async (req: NextApiRequest, res: NextApiResponse) => {
  // console.log(req.body)

  const json = req.body
  const eventData = json['event-data']
  const { message, tags } = eventData
  const { headers } = message
  const { subject, to } = headers

  const { data, error } = await supabase.from('mailgun-deliveries').insert([{ json, subject, tags, to }])

  if (error) {
    console.error(error)
    await pushover('mailgun-deliveries webhook error', JSON.stringify(error))
    return res.status(400).send({ error })
  }

  // console.log({ data })

  res.status(200).send({ data })
}
