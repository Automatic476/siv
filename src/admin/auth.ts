import Router, { NextRouter, useRouter } from 'next/router'
import { useEffect } from 'react'
import useSWR, { mutate } from 'swr'

import { api } from '../api-helper'

export const cookie_name = 'siv-jwt'
const jwt_api_path = '/api/validate-admin-jwt'

export function promptLogout() {
  const pressed_ok = confirm('Do you wish to logout?')
  if (pressed_ok) logout()
}

async function logout() {
  // Delete cookie
  await fetch('/api/admin-logout')
  Router.push('/login')

  // Invalidate jwt cache
  mutate(jwt_api_path)
}

export async function checkLoginCode({
  clientSideRedirect = true,
  code,
  email,
  onExpired,
  onInvalid,
  router,
}: {
  clientSideRedirect?: boolean
  code: string
  email: string
  onExpired: () => void
  onInvalid: () => void
  router: NextRouter
}) {
  // Ask backend if login code is valid
  const response = await api('admin-check-login-code', { code, email })

  // Passed! Set session JWT cookie
  if (response.status === 200) {
    // Invalidate jwt cache
    mutate(jwt_api_path)

    // Remove url parameters
    // Need to do full reload when transitioning in from /login page's Code Input form, otherwise Tailwind's css screws up formatting.
    clientSideRedirect ? await router.replace('/admin') : (window.location.href = '/admin')
    return
  }

  // Expired session: redirects back to login page w/ custom error
  if (response.status === 412) return onExpired()

  // Else, Invalid login token: redirect back to login w/ error message
  onInvalid()
}

export function useLoginRequired(loggedOut: boolean) {
  const router = useRouter()
  async function checkLoginStatus(router: NextRouter) {
    // If logged out...
    if (loggedOut) {
      const { code, email } = router.query

      // Redirect to /login if missing `email` or `code` in URL
      if (!(typeof email == 'string' && typeof code == 'string')) return router.push('/login')

      await checkLoginCode({
        code,
        email,
        onExpired: () => router.push(`/login?expired=true&email=${email}`),
        onInvalid: () => router.push('/login?invalid=true'),
        router,
      })
    }
  }

  useEffect(() => {
    if (router.isReady) checkLoginStatus(router)
  }, [loggedOut, router.isReady])
}

export function useUser() {
  const { data, error, mutate } = useSWR(jwt_api_path, fetcher)

  const loading = !data && !error
  const loggedOut = error && error.status === 401

  return {
    loading,
    loggedOut,
    mutate,
    user: { ...data },
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
