import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { supabase } from '../lib/supabase'
import {
  apiRequest,
  clearStoredAuth,
  getStoredToken,
  getStoredUser,
  normalizeUser,
  register as registerUser,
  setStoredAuth,
} from '../services/api'

const AuthContext = createContext(null)

function buildSessionUser(session) {
  const sessionUser = session?.user
  const metadata = sessionUser?.user_metadata || {}

  return normalizeUser({
    id: sessionUser?.id || null,
    email: sessionUser?.email || '',
    name: metadata.full_name || metadata.name || sessionUser?.email || 'Usuario',
    full_name: metadata.full_name || metadata.name || sessionUser?.email || 'Usuario',
    role: metadata.role || sessionUser?.role || 'usuario',
    garage_id: metadata.garage_id || '',
    avatar_url: metadata.avatar_url || metadata.picture || '',
    user_metadata: metadata,
  })
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(() => getStoredUser())
  const [loading, setLoading] = useState(true)

  const syncSession = useCallback(async (nextSession) => {
    if (!nextSession?.access_token || !nextSession?.user) {
      clearStoredAuth()
      setSession(null)
      setUser(null)
      return null
    }

    const fallbackUser = buildSessionUser(nextSession)
    setSession(nextSession)
    setUser(fallbackUser)
    setStoredAuth(nextSession.access_token, fallbackUser)

    try {
      const profile = await apiRequest('/api/auth/me', {
        method: 'GET',
        token: nextSession.access_token,
        requiresAuth: true,
        skipAuthRedirect: true,
      })

      const mergedUser = normalizeUser({
        ...fallbackUser,
        ...profile,
        user_metadata: {
          ...(nextSession.user.user_metadata || {}),
          role: profile?.role || fallbackUser?.role,
          garage_id: profile?.garage_id || fallbackUser?.garage_id,
          name: profile?.name || fallbackUser?.name,
          full_name: profile?.name || fallbackUser?.full_name,
        },
      })

      setUser(mergedUser)
      setStoredAuth(nextSession.access_token, mergedUser)
      return mergedUser
    } catch {
      return fallbackUser
    }
  }, [])

  useEffect(() => {
    let active = true

    const initialize = async () => {
      const { data } = await supabase.auth.getSession()
      if (!active) return
      await syncSession(data.session ?? null)
      if (active) setLoading(false)
    }

    initialize()

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!active) return
      await syncSession(nextSession ?? null)
      if (active) setLoading(false)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [syncSession])

  const login = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error

    const authenticatedUser = await syncSession(data.session ?? null)
    return { session: data.session ?? null, user: authenticatedUser }
  }, [syncSession])

  const register = useCallback(async (email, password, name, company = {}) => {
    return registerUser(email, password, name, company)
  }, [])

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut()
    } finally {
      await syncSession(null)
    }
  }, [syncSession])

  const setAuthenticatedUser = useCallback((nextUser) => {
    setUser((currentUser) => {
      const mergedUser = normalizeUser({ ...(currentUser || {}), ...(nextUser || {}) })
      setStoredAuth(session?.access_token || getStoredToken(), mergedUser)
      return mergedUser
    })
  }, [session?.access_token])

  const value = useMemo(() => ({
    user,
    currentUser: user,
    token: session?.access_token ?? getStoredToken() ?? null,
    loading,
    isAuthenticated: Boolean(session?.access_token || getStoredToken()),
    session,
    login,
    register,
    logout,
    setAuthenticatedUser,
  }), [user, session, loading, login, register, logout, setAuthenticatedUser])

  return createElement(AuthContext.Provider, { value }, children)
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return context
}
