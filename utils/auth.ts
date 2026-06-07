import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../supabaseClient'

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

/** Session is usable offline if JWT is still valid or a refresh token exists. */
export function isSessionUsableOffline(session: Session | null | undefined): boolean {
  if (!session?.user) return false
  if (session.refresh_token) return true

  const expiresAt = session.expires_at ?? 0
  return expiresAt * 1000 > Date.now()
}

export async function getCachedSession(): Promise<Session | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function getAuthContext(): Promise<{ user: User; session: Session } | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null

  if (isOnline()) {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (!error && user) {
      return { user, session }
    }

    // Transient network/auth errors: fall back to cached session when still usable
    if (isSessionUsableOffline(session)) {
      return { user: session.user, session }
    }
    return null
  }

  if (isSessionUsableOffline(session)) {
    return { user: session.user, session }
  }

  return null
}

export async function getAuthUser(): Promise<User | null> {
  const ctx = await getAuthContext()
  return ctx?.user ?? null
}

export async function refreshSessionIfOnline(): Promise<Session | null> {
  if (!isOnline()) return getCachedSession()

  const { data, error } = await supabase.auth.refreshSession()
  if (error || !data.session) {
    return getCachedSession()
  }
  return data.session
}
