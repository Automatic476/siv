import jwt from 'jsonwebtoken'
import Router, { NextRouter, useRouter } from 'next/router'
import { useEffect } from 'react'
import { useCookies } from 'react-cookie'
import useSWR, { mutate } from 'swr'

import { api } from '../api-helper'

export const cookie_name = 'siv-jwt'
const jwt_api_path = '/api/validate-admin-jwt'

export function logout() {
  // Delete cookie
  document.cookie = `${cookie_name}=; expires=Thu, 01 Jan 1970 00:00:01 GMT;`

  // Invalidate jwt cache
  mutate(jwt_api_path)

  Router.push('/login')
}

export function useLoginRequired(loggedOut: boolean) {
  const router = useRouter()
  const [, setCookie] = useCookies()
  async function checkLoginStatus(router: NextRouter) {
    // If logged out...
    if (loggedOut) {
      const { auth, email } = router.query

      // Redirect to /login if missing `email` or `auth token` in URL
      if (!email || !auth) return router.push('/login')

      // Ask backend if login auth token is valid
      const response = await api('admin-check-login-code', { auth, email })

      // Passed! Set session JWT cookie
      if (response.status === 200) {
        const { jwt } = await response.json()
        // Add session cookie
        // 2038 is max 32-bit date: https://stackoverflow.com/questions/532635/javascript-cookie-with-no-expiration-date
        setCookie(cookie_name, jwt, { expires: new Date('Tue, 19 Jan 2038 03:14:07 UTC') })
        // Invalidate jwt cache
        mutate(jwt_api_path)

        // Remove url parameters
        return router.replace('/admin')
      }

      // Expired session: redirects back to login page w/ custom error
      if (response.status === 412) return router.push(`/login?expired=true&email=${email}`)

      // Else, Invalid login token: redirect back to login w/ error message
      router.push('/login?invalid=true')
    }
  }

  useEffect(() => {
    if (router.isReady) checkLoginStatus(router)
  }, [loggedOut, router.isReady])
}

export function useUser() {
  const [cookies] = useCookies()
  const jwt_cookie = cookies[cookie_name]
  const { data, error, mutate } = useSWR(jwt_api_path, fetcher)

  const loading = !data && !error
  const loggedOut = !jwt_cookie || (error && error.status === 401)

  const decoded_jwt = jwt.decode(jwt_cookie) as Record<string, string>

  return {
    loading,
    loggedOut,
    mutate,
    user: { ...data, ...decoded_jwt },
  }
}

const fetcher = async (url: string) => {
  const res = await fetch(url)

  // If the status code is not in the range 200-299,
  // we still try to parse and throw it.
  if (!res.ok) {
    const error = new Error((await res.json()).error)
    // Attach extra info to the error object.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    error.status = res.status
    throw error
  }

  return res.json()
}