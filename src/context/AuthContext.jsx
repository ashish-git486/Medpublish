// Centralized authentication state for the whole app.
//
// Wrap the app in <AuthProvider> once (see App.jsx) and read auth state
// anywhere with `useAuth()`. This is the ONLY place that should call
// supabase.auth.* directly — components should not duplicate session
// handling logic.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'

const AuthContext = createContext(undefined)

async function fetchProfile(userId) {
  if (!userId) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('MedPublish: failed to load profile', error)
    return null
  }
  return data
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function init() {
      const {
        data: { session: initialSession },
      } = await supabase.auth.getSession()

      if (!isMounted) return
      setSession(initialSession)
      setLoading(false)

      if (initialSession?.user) {
        setProfileLoading(true)
        const loadedProfile = await fetchProfile(initialSession.user.id)
        if (isMounted) {
          setProfile(loadedProfile)
          setProfileLoading(false)
        }
      }
    }

    init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!isMounted) return
      setSession(nextSession)

      if (nextSession?.user) {
        setProfileLoading(true)
        const loadedProfile = await fetchProfile(nextSession.user.id)
        if (isMounted) {
          setProfile(loadedProfile)
          setProfileLoading(false)
        }
      } else {
        setProfile(null)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signUpWithEmail = useCallback(async ({ email, password, fullName }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    })
    return { data, error }
  }, [])

  const signInWithEmail = useCallback(async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    })
    return { data, error }
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  }, [])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      role: profile?.role ?? null,
      isAuthenticated: Boolean(session?.user),
      loading, // initial session check
      profileLoading, // profile row fetch, can lag behind `loading`
      signUpWithEmail,
      signInWithEmail,
      signInWithGoogle,
      signOut,
    }),
    [session, profile, loading, profileLoading, signUpWithEmail, signInWithEmail, signInWithGoogle, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (ctx === undefined) {
    throw new Error('useAuth must be used within an <AuthProvider>')
  }
  return ctx
}
