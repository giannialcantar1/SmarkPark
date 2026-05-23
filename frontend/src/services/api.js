const API_BASE_URL = (import.meta.env.VITE_API_URL?.trim() || 'http://127.0.0.1:5000')
  .replace('http://localhost:5000', 'http://127.0.0.1:5000')
  .replace(/\/$/, '')

export const TOKEN_STORAGE_KEY = 'smartpark_token'
export const USER_STORAGE_KEY = 'smartpark_current_user'
export const SESSION_TOKEN = '__session__'
let supabaseClientPromise = null

export class ApiError extends Error {
  constructor(message, { status = 500, payload = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

async function bestEffort(callable, fallback = null) {
  try {
    return await callable()
  } catch (error) {
    return fallback
  }
}

function isBrowser() {
  return typeof window !== 'undefined'
}

async function getSupabaseClient() {
  if (!supabaseClientPromise) {
    supabaseClientPromise = import('../lib/supabase').then((module) => module.supabase)
  }

  return supabaseClientPromise
}

function dispatchBrowserEvent(name, detail) {
  if (!isBrowser()) return
  window.dispatchEvent(new CustomEvent(name, { detail }))
}

function safeJsonParse(value, fallback = null) {
  try {
    return JSON.parse(value)
  } catch (error) {
    return fallback
  }
}

function normalizeRole(role) {
  const value = String(role || '').trim().toLowerCase()
  return value === 'user' ? 'usuario' : value
}

export function normalizeUser(user) {
  if (!user) return null

  const name = user.full_name || user.name || user.nombre || user.email || 'Usuario'
  const garageId = user.garage_id || user.garageId || ''

  return {
    ...user,
    name,
    full_name: name,
    garage_id: garageId,
    role: normalizeRole(user.role),
  }
}

export function getStoredToken() {
  if (!isBrowser()) return ''
  return window.localStorage.getItem(TOKEN_STORAGE_KEY) || ''
}

export function getStoredUser() {
  if (!isBrowser()) return null
  return normalizeUser(safeJsonParse(window.localStorage.getItem(USER_STORAGE_KEY), null))
}

export function clearStoredGarageId() {
  if (!isBrowser()) return
  window.localStorage.removeItem('smartpark_garage_id')
}

function getStoredGarageId() {
  if (!isBrowser()) return ''

  const directGarageId = window.localStorage.getItem('smartpark_garage_id') || ''
  const storedUser = getStoredUser()
  const fallbackGarageId = String(storedUser?.garage_id || storedUser?.garageId || '').trim()

  if (fallbackGarageId) {
    if (directGarageId !== fallbackGarageId) {
      window.localStorage.setItem('smartpark_garage_id', fallbackGarageId)
    }
    return fallbackGarageId
  }

  if (directGarageId) return directGarageId

  return ''
}

function getGarageScopedPath(path, fallbackPath) {
  const garageId = getStoredGarageId()
  return garageId ? path.replace(':garageId', encodeURIComponent(garageId)) : fallbackPath
}

export function setStoredAuth(token, user) {
  if (!isBrowser()) return
  const normalizedUser = normalizeUser(user)
  if (token) {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token)
  }
  if (normalizedUser) {
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(normalizedUser))
  }
  clearStoredGarageId()
  if (normalizedUser?.garage_id) {
    window.localStorage.setItem('smartpark_garage_id', normalizedUser.garage_id)
  }
  dispatchBrowserEvent('smartpark:auth-changed', { token, user: normalizedUser })
}

export function clearStoredAuth() {
  if (!isBrowser()) return
  window.localStorage.removeItem(TOKEN_STORAGE_KEY)
  window.localStorage.removeItem(USER_STORAGE_KEY)
  clearStoredGarageId()
  dispatchBrowserEvent('smartpark:auth-changed', { token: '', user: null })
}

async function getFreshSessionToken() {
  if (!isBrowser()) return ''

  const supabase = await getSupabaseClient()
  const { data } = await supabase.auth.getSession()
  let session = data?.session ?? null
  const expiresAt = Number(session?.expires_at || 0)
  const expiresSoon = expiresAt > 0 && expiresAt * 1000 - Date.now() < 5 * 60 * 1000

  if (session?.refresh_token && expiresSoon) {
    const refreshed = await supabase.auth.refreshSession({ refresh_token: session.refresh_token })
    session = refreshed.data?.session ?? session
  }

  if (session?.access_token) {
    setStoredAuth(session.access_token, normalizeUser({
      id: session.user?.id || null,
      email: session.user?.email || '',
      name: session.user?.user_metadata?.full_name || session.user?.user_metadata?.name || session.user?.email,
      full_name: session.user?.user_metadata?.full_name || session.user?.user_metadata?.name || session.user?.email,
      role: session.user?.user_metadata?.role || session.user?.role || 'usuario',
      garage_id: session.user?.user_metadata?.garage_id || '',
      user_metadata: session.user?.user_metadata || {},
    }))
  }

  return session?.access_token || ''
}

async function getAuthTokenForRequest({ token, requiresAuth }) {
  if (!requiresAuth) return token || ''
  if (token) return token

  const storedToken = getStoredToken()
  if (storedToken) return storedToken

  const freshToken = await bestEffort(getFreshSessionToken, '')
  return freshToken || ''
}

export async function getFreshAuthToken() {
  return getAuthTokenForRequest({ requiresAuth: true })
}

function isExpiredTokenResponse(response, payload) {
  if (response.status !== 401) return false
  const message = String(payload?.error || payload?.message || payload?.mensaje || '').toLowerCase()
  return message.includes('token') && (message.includes('expir') || message.includes('invalid') || message.includes('invalido'))
}

export async function refreshStoredTokenAfterExpiredResponse() {
  if (!isBrowser()) return ''
  const supabase = await getSupabaseClient()
  const { data } = await supabase.auth.refreshSession()
  const session = data?.session ?? null

  if (!session?.access_token) return ''

  setStoredAuth(session.access_token, normalizeUser({
    id: session.user?.id || null,
    email: session.user?.email || '',
    name: session.user?.user_metadata?.full_name || session.user?.user_metadata?.name || session.user?.email,
    full_name: session.user?.user_metadata?.full_name || session.user?.user_metadata?.name || session.user?.email,
    role: session.user?.user_metadata?.role || session.user?.role || 'usuario',
    garage_id: session.user?.user_metadata?.garage_id || '',
    user_metadata: session.user?.user_metadata || {},
  }))
  return session.access_token
}


async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || ''
  if (response.status === 204) return null
  if (contentType.includes('application/json')) {
    return response.json()
  }
  const text = await response.text()
  return text ? { message: text } : null
}

export async function apiRequest(
  path,
  {
    method = 'GET',
    body,
    headers = {},
    token,
    requiresAuth = true,
    skipAuthRedirect = false,
    retryOnExpiredToken = true,
  } = {},
) {
  const authToken = await getAuthTokenForRequest({ token, requiresAuth })
  const garageId = getStoredGarageId()
  const requestHeaders = {
    Accept: 'application/json',
    ...(garageId ? { 'X-Garage-ID': garageId } : {}),
    ...headers,
  }

  if (requiresAuth && authToken && authToken !== SESSION_TOKEN) {
    requestHeaders.Authorization = `Bearer ${authToken}`
  }

  const config = {
    method,
    headers: requestHeaders,
    credentials: 'include',
  }

  if (body instanceof FormData) {
    config.body = body
  } else if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json'
    config.body = JSON.stringify(body)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, config)
  const payload = await parseResponse(response)

  if (!response.ok && retryOnExpiredToken && !token && requiresAuth && isExpiredTokenResponse(response, payload)) {
    const refreshedToken = await bestEffort(refreshStoredTokenAfterExpiredResponse, '')
    if (refreshedToken && refreshedToken !== authToken) {
      return apiRequest(path, {
        method,
        body,
        headers,
        token: refreshedToken,
        requiresAuth,
        skipAuthRedirect,
        retryOnExpiredToken: false,
      })
    }
  }

  if (!response.ok) {
    const message =
      payload?.error ||
      payload?.message ||
      payload?.mensaje ||
      `Solicitud fallida (${response.status})`

    throw new ApiError(message, { status: response.status, payload })
  }

  return payload
}

export async function login(email, password) {
  return apiRequest('/api/auth/login', {
    method: 'POST',
    body: { email, password },
    requiresAuth: false,
    skipAuthRedirect: true,
  })
}

export async function register(email, password, name, company = {}) {
  return apiRequest('/api/auth/register', {
    method: 'POST',
    body: {
      email,
      password,
      name,
      full_name: name,
      confirm_password: password,
      company_name: company.company_name || company.empresa || '',
      company_address: company.company_address || company.direccion || '',
      company_phone: company.company_phone || company.telefonoEmpresa || '',
      parking_spaces_count: company.parking_spaces_count || company.cupos_totales || 20,
      role: 'admin',
    },
    requiresAuth: false,
    skipAuthRedirect: true,
  })
}

export async function registerStaff({ email, password, name, role, garage_code }) {
  return apiRequest('/api/auth/staff-register', {
    method: 'POST',
    body: {
      email,
      password,
      name,
      full_name: name,
      role,
      garage_code,
    },
    requiresAuth: false,
    skipAuthRedirect: true,
  })
}

export async function verifyToken(token = getStoredToken()) {
  if (!token || token === SESSION_TOKEN) {
    return getCurrentUserSession()
  }
  return apiRequest('/api/auth/me', {
    method: 'GET',
    token,
    requiresAuth: true,
    skipAuthRedirect: true,
  })
}

export async function getCurrentUserSession() {
  return apiRequest('/api/auth/me', {
    method: 'GET',
    requiresAuth: true,
    skipAuthRedirect: true,
  })
}

export async function logout() {
  return apiRequest('/api/auth/logout', {
    method: 'POST',
    skipAuthRedirect: true,
  })
}

export async function getParkingSpaces() {
  const payload = await apiRequest('/api/parking-spaces')
  return payload?.data ?? []
}

export async function getVehicles() {
  const payload = await apiRequest(getGarageScopedPath('/api/vehicles/garage/:garageId', '/api/vehicles'))
  return payload?.data ?? []
}

export async function registerEntry(placa) {
  return apiRequest('/api/parking-sessions/entry', {
    method: 'POST',
    body: { placa },
  })
}

export async function registerExit(placa) {
  return apiRequest('/api/parking-sessions/exit', {
    method: 'POST',
    body: { placa },
  })
}

export async function getActiveSessions() {
  const payload = await apiRequest('/api/parking-sessions/active')
  return payload?.data ?? []
}

export async function getDashboardStats() {
  return apiRequest('/api/dashboard/stats')
}

