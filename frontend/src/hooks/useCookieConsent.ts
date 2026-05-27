import { useState, useCallback } from 'react'

export type CookieConsent = 'accepted' | 'rejected' | null

const STORAGE_KEY = 'cookie_consent'

function readConsent(): CookieConsent {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (value === 'accepted' || value === 'rejected') return value
    return null
  } catch {
    return null
  }
}

export function useCookieConsent() {
  const [consent, setConsent] = useState<CookieConsent>(readConsent)

  const accept = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, 'accepted')
    } catch {}
    setConsent('accepted')
  }, [])

  const reject = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, 'rejected')
    } catch {}
    setConsent('rejected')
  }, [])

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {}
    setConsent(null)
  }, [])

  return { consent, accept, reject, reset, isPending: consent === null }
}
