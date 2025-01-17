import Cookies from 'cookies'
import jwt from 'jsonwebtoken'
import { NextApiRequest, NextApiResponse } from 'next'

import { cookie_name } from '../../src/admin/auth'
import { firebase, pushover } from './_services'

const { JWT_SECRET } = process.env

export type JWT_Payload = {
  email: string
  name: string
}

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const { code }: { code: string } = req.body
  let { email }: { email: string } = req.body
  email = email.toLowerCase()

  // Is this email an approved election manager?
  const adminDoc = firebase.firestore().collection('admins').doc(email)
  const admin = await adminDoc.get()

  if (admin.exists) {
    // Is this a valid login code for them?
    const [session] = (await adminDoc.collection('logins').where('login_code', '==', code).get()).docs
    if (session) {
      // Is the session within the last hour?
      const { created_at } = { ...session.data() } as { created_at: { toDate: () => Date } }
      const date = created_at.toDate()
      const diff = Number(new Date()) - Number(date)
      const minutes_since = diff / 1000 / 60

      // Has login code expired?
      if (minutes_since > 60) return res.status(412).send({ error: 'Expired login code' })

      setJWT({ email, name: admin?.data()?.name, req, res })

      return res.status(200).send({ message: 'Success! Setting jwt cookie.' })
    }
  }

  pushover('Invalid admin login code', `${email} attempted w/ code '${code}'`)

  return res.status(401).send({ error: `Invalid login code` })
}

export function setJWT({
  email,
  name = 'MissingName',
  req,
  res,
}: {
  email: string
  name?: string
  req: NextApiRequest
  res: NextApiResponse
}) {
  if (!JWT_SECRET) return res.status(501).send({ error: `Missing process.env JWT_SECRET` })

  const payload: JWT_Payload = { email, name }

  // Set authentication cookie
  const cookies = new Cookies(req, res)
  const signed_jwt = jwt.sign(payload, JWT_SECRET)
  // 2038 is max 32-bit date: https://stackoverflow.com/questions/532635/javascript-cookie-with-no-expiration-date
  cookies.set(cookie_name, signed_jwt, { expires: new Date('Tue, 19 Jan 2038 03:14:07 UTC') })
}
