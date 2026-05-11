import {
  clearStoredAuth,
  getFreshAuthToken,
  getStoredUser,
  refreshStoredTokenAfterExpiredResponse,
} from '../services/api'

const API_BASE_URL = import.meta.env.VITE_API_URL?.trim() ?? ''
const NORMALIZED_API_BASE_URL = API_BASE_URL.replace('http://localhost:5000', 'http://127.0.0.1:5000')
const BACKEND_API_URL = (NORMALIZED_API_BASE_URL || 'http://127.0.0.1:5000').replace(/\/$/, '')
const GARAGE_STORAGE_KEY = 'smartpark_garage_id'
const API_CACHE_PREFIX = 'smartpark_api_cache'
const DEFAULT_CACHE_POLICY = {
  freshMs: 60 * 1000,
  staleMs: 15 * 60 * 1000,
}

const CACHE_POLICIES = {
  '/api/auth/me': { freshMs: 2 * 60 * 1000, staleMs: 20 * 60 * 1000 },
  '/api/auth/settings': { freshMs: 5 * 60 * 1000, staleMs: 30 * 60 * 1000 },
  '/api/configuracion': { freshMs: 5 * 60 * 1000, staleMs: 30 * 60 * 1000 },
  '/api/dashboard/stats': { freshMs: 20 * 1000, staleMs: 5 * 60 * 1000 },
  '/api/notificaciones': { freshMs: 15 * 1000, staleMs: 2 * 60 * 1000 },
  '/api/alertas-acceso': { freshMs: 15 * 1000, staleMs: 2 * 60 * 1000 },
  '/api/parking-spaces': { freshMs: 30 * 1000, staleMs: 10 * 60 * 1000 },
  '/api/parking-spaces/stats': { freshMs: 30 * 1000, staleMs: 10 * 60 * 1000 },
  '/api/parking-sessions': { freshMs: 30 * 1000, staleMs: 10 * 60 * 1000 },
  '/api/parking-sessions/active': { freshMs: 20 * 1000, staleMs: 5 * 60 * 1000 },
  '/api/payments': { freshMs: 30 * 1000, staleMs: 10 * 60 * 1000 },
  '/api/vehiculos': { freshMs: 30 * 1000, staleMs: 10 * 60 * 1000 },
  '/api/vehicles': { freshMs: 30 * 1000, staleMs: 10 * 60 * 1000 },
  '/api/vehicles/logs': { freshMs: 30 * 1000, staleMs: 10 * 60 * 1000 },
  '/api/visitantes/activos': { freshMs: 30 * 1000, staleMs: 10 * 60 * 1000 },
  '/api/visitantes/historial': { freshMs: 30 * 1000, staleMs: 10 * 60 * 1000 },
}

const responseCache = new Map()
const inflightRequests = new Map()

const ROUTE_MAP = {
  '/api/parking-spaces': '/api/parking-spaces',
  '/api/parking-spaces/stats': '/api/parking-spaces/stats',

  '/api/vehiculos': '/api/vehicles',
  '/api/vehiculos/entrada': '/api/parking-sessions/entry',
  '/api/vehiculos/salida': '/api/parking-sessions/exit',
  '/api/vehiculos/logs': '/api/vehicles/logs',
  '/api/vehicles': '/api/vehicles',
  '/api/vehicles/garage': '/api/vehicles/garage',
  '/api/vehicles/logs': '/api/vehicles/logs',

  '/api/parking-sessions/active': '/api/parking-sessions/active',
  '/api/parking-sessions': '/api/parking-sessions',
  '/api/parking-sessions/entry': '/api/parking-sessions/entry',
  '/api/parking-sessions/exit': '/api/parking-sessions/exit',

  '/api/dashboard/stats': '/api/dashboard/stats',
  '/api/payments': '/api/payments',

  '/api/usuarios': '/api/users',
  '/api/usuarios/': '/api/users',
  '/api/users': '/api/users',

  '/api/reports/occupancy': '/api/reports/occupancy',
  '/api/reports/income': '/api/reports/income',
  '/api/reports/vehicles': '/api/reports/vehicles',
  '/api/reports/users': '/api/reports/users',

  '/api/notificaciones': '/api/notificaciones',
  '/api/alertas-acceso': '/api/alertas-acceso',
  '/api/access-codes/generate': '/api/access-codes/generate',
  '/api/access-codes/validate': '/api/access-codes/validate',
  '/api/access-codes/pending': '/api/access-codes/pending',
  '/api/monthly-plans/create': '/api/monthly-plans/create',
  '/api/monthly-plans/user': '/api/monthly-plans/user',
  '/api/monthly-plans/pay': '/api/monthly-plans/pay',
  '/api/monthly-plans/pending': '/api/monthly-plans/pending',
  '/api/morosidad/usuarios': '/api/morosidad/usuarios',
  '/api/morosidad/stats': '/api/morosidad/stats',
  '/api/reservas/crear': '/api/reservas/crear',
  '/api/reservas/user': '/api/reservas/user',
  '/api/reservas/disponibles': '/api/reservas/disponibles',
  '/api/reservas/cancelar': '/api/reservas/cancelar',
  '/api/reservas/convertir-entrada': '/api/reservas/convertir-entrada',
  '/api/visitantes/entrada': '/api/visitantes/entrada',
  '/api/visitantes/salida': '/api/visitantes/salida',
  '/api/visitantes/activos': '/api/visitantes/activos',
  '/api/visitantes/historial': '/api/visitantes/historial',

  '/api/auth/me': '/api/auth/me',
  '/api/auth/settings': '/api/auth/settings',
  '/api/configuracion': '/api/configuracion',
  '/api/configuracion/password': '/api/configuracion/password',
  '/api/configuracion/eliminar-cuenta': '/api/configuracion/eliminar-cuenta',
}

const CACHEABLE_PATHS = new Set([
  '/api/auth/me',
  '/api/auth/settings',
  '/api/configuracion',
  '/api/alertas-acceso',
  '/api/access-codes/pending',
  '/api/dashboard/stats',
  '/api/monthly-plans/pending',
  '/api/morosidad/usuarios',
  '/api/morosidad/stats',
  '/api/notificaciones',
  '/api/parking-spaces',
  '/api/parking-spaces/stats',
  '/api/parking-sessions/active',
  '/api/parking-sessions',
  '/api/payments',
  '/api/usuarios/',
  '/api/users/',
  '/api/visitantes/activos',
  '/api/visitantes/historial',
  '/api/vehiculos',
  '/api/vehicles',
  '/api/vehicles/logs',
])

function resolveRoute(path) {
  if (path === '/api/vehiculos/') return '/api/vehicles'
  if (path === '/api/usuarios/') return '/api/users'

  const updateUserRoleMatch = path.match(/^\/api\/usuarios\/([^/]+)\/rol\/?$/)
  if (updateUserRoleMatch) {
    return `/api/users/${updateUserRoleMatch[1]}`
  }

  const notificationReadMatch = path.match(/^\/api\/notificaciones\/([^/]+)\/leer\/?$/)
  if (notificationReadMatch) {
    return `/api/notificaciones/mark-read/${notificationReadMatch[1]}`
  }

  if (ROUTE_MAP[path]) return ROUTE_MAP[path]

  for (const [frontend, backend] of Object.entries(ROUTE_MAP)) {
    if (path.startsWith(`${frontend}/`)) {
      const suffix = path.slice(frontend.length)
      return `${backend}${suffix}`
    }
  }

  return path
}

function getGarageId() {
  if (typeof window === 'undefined') return ''

  const storedGarageId = window.localStorage.getItem(GARAGE_STORAGE_KEY) || ''
  if (storedGarageId) return storedGarageId

  const storedUser = getStoredUser()
  const fallbackGarageId = String(storedUser?.garage_id || storedUser?.garageId || '').trim()
  if (fallbackGarageId) {
    window.localStorage.setItem(GARAGE_STORAGE_KEY, fallbackGarageId)
    return fallbackGarageId
  }

  return ''
}

function normalizeParkingSpace(row = {}) {
  const code = row.numero ?? row.codigo ?? row.code ?? row.nombre ?? row.numero_mostrar ?? ''
  const floor = row.piso ?? row.nivel ?? row.nivel_mostrar ?? row.floor ?? ''
  const status = String(row.status ?? row.estado ?? '').toLowerCase()
  const occupied = Boolean(row.ocupado ?? row.occupied) || ['ocupado', 'occupied'].includes(status)

  return {
    ...row,
    id: row.id,
    garage_id: row.garage_id,
    codigo: code,
    nombre: code,
    numero: code,
    numero_mostrar: code,
    nivel: floor,
    piso: floor,
    nivel_mostrar: floor,
    tipo: row.tipo ?? row.space_type ?? row.tipo_espacio ?? '',
    estado: occupied ? 'ocupado' : 'disponible',
    status: occupied ? 'occupied' : 'available',
    ocupado: occupied,
    occupied,
    vehiculo_id: row.vehiculo_id ?? row.vehicle_id ?? null,
    creado_en: row.created_at ?? null,
  }
}

function normalizeParkingSpacesPayload(payload) {
  const items = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : []
  return {
    ...(payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {}),
    success: payload?.success ?? true,
    data: items.map(normalizeParkingSpace),
  }
}

function normalizeVehicle(row = {}) {
  const entryTime = row.hora_entrada ?? row.entry_time ?? row.entrada ?? row.hora_inicio ?? null
  const exitTime = row.hora_salida ?? row.exit_time ?? row.salida ?? row.hora_fin ?? null
  const status = String(row.status ?? row.estado ?? '').trim().toLowerCase()
  const isActive =
    row.is_active === true ||
    (!exitTime && ['dentro', 'activo', 'active', 'inside'].includes(status))
  const amount =
    Number(row.monto_total ?? row.total_amount ?? row.amount ?? row.costo ?? row.amount_to_pay ?? 0) || 0
  const durationMinutes =
    Number(row.duration_minutes ?? row.duracion ?? row.tiempo_total_minutos ?? row.duracion_minutos ?? 0) || 0

  return {
    ...row,
    placa: String(row.placa ?? row.plate ?? '').trim().toUpperCase(),
    plate: String(row.plate ?? row.placa ?? '').trim().toUpperCase(),
    propietario: row.propietario ?? row.owner_name ?? row.owner ?? row.nombre ?? '',
    owner_name: row.owner_name ?? row.propietario ?? row.owner ?? row.nombre ?? '',
    marca: row.marca ?? row.brand ?? '',
    brand: row.brand ?? row.marca ?? '',
    modelo: row.modelo ?? row.model ?? '',
    model: row.model ?? row.modelo ?? '',
    tipo: row.tipo ?? row.type ?? row.vehicle_type ?? '',
    type: row.type ?? row.tipo ?? row.vehicle_type ?? '',
    hora_entrada: entryTime,
    entry_time: entryTime,
    hora_salida: exitTime,
    exit_time: exitTime,
    duracion: durationMinutes,
    duration_minutes: durationMinutes,
    monto_total: amount,
    total_amount: amount,
    amount,
    estado: isActive ? 'dentro' : 'fuera',
    status: isActive ? 'dentro' : 'fuera',
    is_active: isActive,
  }
}

function normalizeVehiclesPayload(payload) {
  const items = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : []
  return {
    ...(payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {}),
    success: payload?.success ?? true,
    data: items.map(normalizeVehicle),
  }
}

function normalizeSession(row = {}) {
  const entryTime = row.hora_entrada ?? row.entry_time ?? row.entrada ?? row.hora_inicio ?? null
  const exitTime = row.hora_salida ?? row.exit_time ?? row.salida ?? row.hora_fin ?? null
  const amount =
    Number(row.monto_total ?? row.total_amount ?? row.amount ?? row.costo ?? row.amount_to_pay ?? 0) || 0
  const durationMinutes =
    Number(row.duration_minutes ?? row.duracion ?? row.tiempo_total_minutos ?? row.duracion_minutos ?? 0) || 0
  const active = !exitTime && ['active', 'activo', 'dentro', 'inside'].includes(String(row.status ?? row.estado ?? '').toLowerCase())

  return {
    ...row,
    placa: String(row.placa ?? row.plate ?? '').trim().toUpperCase(),
    plate: String(row.plate ?? row.placa ?? '').trim().toUpperCase(),
    propietario: row.propietario ?? row.owner_name ?? row.owner ?? '',
    owner_name: row.owner_name ?? row.propietario ?? row.owner ?? '',
    modelo: row.modelo ?? row.model ?? '',
    model: row.model ?? row.modelo ?? '',
    hora_entrada: entryTime,
    entry_time: entryTime,
    hora_salida: exitTime,
    exit_time: exitTime,
    duracion: durationMinutes,
    duration_minutes: durationMinutes,
    monto_total: amount,
    total_amount: amount,
    amount,
    estado: active ? 'dentro' : 'fuera',
    status: active ? 'dentro' : 'fuera',
    is_active: active,
  }
}

function normalizeSessionsPayload(payload) {
  const items = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : []
  return {
    ...(payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {}),
    success: payload?.success ?? true,
    data: items.map(normalizeSession),
  }
}

function buildLocalAuthSettings() {
  const user = getStoredUser() || {}

  return {
    success: true,
    data: {
      full_name: user.full_name || user.name || '',
      name: user.name || user.full_name || '',
      email: user.email || '',
      role: user.role || 'usuario',
      garage_id: user.garage_id || '',
      phone: user.phone || '',
      avatar_url: user.avatar_url || '',
      company_name: user.company_name || '',
      company_address: user.company_address || '',
      company_phone: user.company_phone || '',
      hourly_rate: Number(user.hourly_rate || 50) || 50,
      two_factor_enabled: Boolean(user.two_factor_enabled),
    },
  }
}

function normalizeNotificationsPayload(payload) {
  const items = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : []

  return {
    success: true,
    data: items.map((item) => ({
      ...item,
      titulo: item?.titulo || item?.title || 'Notificacion',
      title: item?.title || item?.titulo || 'Notificacion',
      mensaje: item?.mensaje || item?.message || '',
      message: item?.message || item?.mensaje || '',
      leida: Boolean(item?.leida ?? item?.read),
      read: Boolean(item?.read ?? item?.leida),
    })),
  }
}

function normalizeAlertsPayload(payload) {
  const items = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : []
  return { success: true, data: items }
}

function normalizeEntryPayload(payload) {
  if (!payload || payload.data) return payload

  const session = payload.session || {}
  const space = normalizeParkingSpace(payload.space || {})

  return {
    ...payload,
    data: {
      id: session.id || null,
      placa: session.placa || session.plate || '',
      propietario: session.owner_name || session.propietario || '',
      modelo: session.modelo || session.model || '',
      status: 'dentro',
      estado: 'dentro',
      espacio_id: session.espacio_id || session.space_id || space.id || null,
      space_id: session.space_id || session.espacio_id || space.id || null,
      espacio: session.espacio || session.space_code || space.codigo || '',
      hora_entrada: session.entrada || session.entry_time || null,
      entry_time: session.entry_time || session.entrada || null,
    },
  }
}

function normalizeExitPayload(payload) {
  if (!payload) return payload

  const session = payload.session || {}
  const durationMinutes = Number(payload.duration_minutes ?? session.duration_minutes ?? session.duracion ?? 0) || 0
  const totalAmount = Number(payload.amount_to_pay ?? session.amount ?? session.monto_total ?? 0) || 0
  const hoursCharged = Math.max(1, Math.ceil(durationMinutes / 60 || 1))

  return {
    ...payload,
    data: {
      placa: session.placa || session.plate || '',
      hora_salida: session.salida || session.exit_time || null,
      exit_time: session.exit_time || session.salida || null,
      tiempo_total_minutos: durationMinutes,
      duracion: durationMinutes,
      duration_minutes: durationMinutes,
      horas_cobradas: hoursCharged,
      tarifa_por_hora: totalAmount > 0 ? Number((totalAmount / hoursCharged).toFixed(2)) : 0,
      monto_total: totalAmount,
      amount_to_pay: totalAmount,
    },
  }
}

function normalizePayload(path, payload) {
  if (path === '/api/notificaciones') {
    return normalizeNotificationsPayload(payload)
  }

  if (path === '/api/alertas-acceso') {
    return normalizeAlertsPayload(payload)
  }

  if (path === '/api/parking-spaces') {
    return normalizeParkingSpacesPayload(payload)
  }

  if (path === '/api/vehiculos' || path === '/api/vehiculos/' || path === '/api/vehicles') {
    return normalizeVehiclesPayload(payload)
  }

  if (path === '/api/parking-sessions') {
    return normalizeSessionsPayload(payload)
  }

  if (path === '/api/vehiculos/entrada' || path === '/api/parking-sessions/entry') {
    return normalizeEntryPayload(payload)
  }

  if (path === '/api/vehiculos/salida' || path === '/api/parking-sessions/exit') {
    return normalizeExitPayload(payload)
  }

  return payload
}

function getCacheKey(path) {
  return `${API_CACHE_PREFIX}:${getGarageId()}:${path}`
}

function getCachePolicy(path) {
  return CACHE_POLICIES[path] ?? DEFAULT_CACHE_POLICY
}

function isCacheable(path) {
  return CACHEABLE_PATHS.has(path)
}

function removePersistedCache(cacheKey) {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(cacheKey)
}

function readPersistedCache(cacheKey, cachePolicy, allowStale = false) {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.sessionStorage.getItem(cacheKey)
    if (!raw) return null

    const entry = JSON.parse(raw)
    const ageMs = Date.now() - Number(entry?.timestamp || 0)

    if (!entry?.timestamp || ageMs > cachePolicy.staleMs) {
      removePersistedCache(cacheKey)
      return null
    }

    if (!allowStale && ageMs > cachePolicy.freshMs) return null
    return entry
  } catch {
    removePersistedCache(cacheKey)
    return null
  }
}

function getCachedEntry(path, options = {}) {
  const { allowStale = false } = options
  const cacheKey = getCacheKey(path)
  const cachePolicy = getCachePolicy(path)
  const memoryEntry = responseCache.get(cacheKey)

  if (memoryEntry) {
    const ageMs = Date.now() - Number(memoryEntry.timestamp || 0)
    if (ageMs <= cachePolicy.staleMs) {
      if (allowStale || ageMs <= cachePolicy.freshMs) {
        return memoryEntry
      }
    } else {
      responseCache.delete(cacheKey)
      removePersistedCache(cacheKey)
    }
  }

  const persistedEntry = readPersistedCache(cacheKey, cachePolicy, allowStale)
  if (persistedEntry) {
    responseCache.set(cacheKey, persistedEntry)
    return persistedEntry
  }

  return null
}

function setCachedEntry(path, payload) {
  const cacheKey = getCacheKey(path)
  const entry = { timestamp: Date.now(), payload }

  responseCache.set(cacheKey, entry)
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(cacheKey, JSON.stringify(entry))
  }

  return payload
}

export function getCachedApiData(path) {
  return getCachedEntry(path, { allowStale: true })?.payload ?? null
}

export function invalidateApiCache(paths = []) {
  const targets = Array.isArray(paths) ? paths : [paths]

  targets.forEach((path) => {
    const cacheKey = getCacheKey(path)
    responseCache.delete(cacheKey)
    inflightRequests.delete(cacheKey)

    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(cacheKey)
    }
  })
}

export function clearAllApiCache() {
  responseCache.clear()
  inflightRequests.clear()
  if (typeof window === 'undefined') return

  const keysToRemove = []
  for (let i = 0; i < window.sessionStorage.length; i++) {
    const key = window.sessionStorage.key(i)
    if (key?.startsWith(`${API_CACHE_PREFIX}:`)) keysToRemove.push(key)
  }

  keysToRemove.forEach((key) => window.sessionStorage.removeItem(key))
}

function invalidateByMutation(path) {
  if (path.startsWith('/api/vehiculos') || path.startsWith('/api/vehicles')) {
    invalidateApiCache([
      '/api/dashboard/stats',
      '/api/vehiculos',
      '/api/vehicles',
      '/api/vehicles/logs',
      '/api/parking-sessions',
      '/api/parking-sessions/active',
      '/api/payments',
    ])
  }

  if (path.startsWith('/api/parking-spaces')) {
    invalidateApiCache(['/api/dashboard/stats', '/api/parking-spaces', '/api/parking-spaces/stats'])
  }

  if (path.startsWith('/api/parking-sessions')) {
    invalidateApiCache([
      '/api/dashboard/stats',
      '/api/parking-spaces',
      '/api/parking-spaces/stats',
      '/api/vehiculos',
      '/api/vehicles',
      '/api/vehicles/logs',
      '/api/parking-sessions',
      '/api/parking-sessions/active',
      '/api/payments',
    ])
  }

  if (path.startsWith('/api/auth/settings') || path.startsWith('/api/configuracion')) {
    invalidateApiCache(['/api/auth/settings', '/api/configuracion', '/api/dashboard/stats'])
  }

  if (path.startsWith('/api/alertas-acceso')) {
    invalidateApiCache('/api/alertas-acceso')
  }

  if (path.startsWith('/api/notificaciones')) {
    invalidateApiCache('/api/notificaciones')
  }

  if (path.startsWith('/api/usuarios') || path.startsWith('/api/users')) {
    invalidateApiCache(['/api/usuarios/', '/api/users/'])
  }

  if (path.startsWith('/api/payments')) {
    invalidateApiCache(['/api/payments', '/api/dashboard/stats'])
  }

  if (path.startsWith('/api/visitantes')) {
    invalidateApiCache(['/api/visitantes/activos', '/api/visitantes/historial', '/api/parking-spaces', '/api/parking-spaces/stats'])
  }

  if (path.startsWith('/api/access-codes')) {
    invalidateApiCache(['/api/access-codes/pending', '/api/parking-spaces', '/api/parking-spaces/stats', '/api/vehiculos', '/api/vehicles'])
  }

  if (path.startsWith('/api/monthly-plans')) {
    invalidateApiCache(['/api/monthly-plans/pending', '/api/morosidad/usuarios', '/api/morosidad/stats', '/api/dashboard/stats', '/api/usuarios/', '/api/users/'])
  }

  if (path.startsWith('/api/reservas')) {
    invalidateApiCache(['/api/parking-spaces', '/api/parking-spaces/stats', '/api/dashboard/stats'])
  }

  if (path.startsWith('/api/auth/')) {
    invalidateApiCache('/api/auth/me')
  }
}

async function apiFetch(path, options = {}) {
  const {
    body: rawBody,
    forceFresh: _forceFresh,
    retryOnExpiredToken = true,
    headers: optionHeaders,
    ...fetchOptions
  } = options
  const garageId = getGarageId()
  const token = await getFreshAuthToken()
  const method = String(fetchOptions.method || 'GET').toUpperCase()

  const backendPath = resolveRoute(path)

  let finalPath = backendPath
  if ((path === '/api/vehiculos' || path === '/api/vehiculos/') && garageId) {
    finalPath = `/api/vehicles/garage/${garageId}`
  }

  const requestHeaders = {
    Accept: 'application/json',
    ...(garageId ? { 'X-Garage-ID': garageId } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(optionHeaders ?? {}),
  }

  let body = rawBody
  if (body && !(body instanceof FormData)) {
    requestHeaders['Content-Type'] = 'application/json'
    body = JSON.stringify(body)
  }

  const response = await fetch(`${BACKEND_API_URL}${finalPath}`, {
    ...fetchOptions,
    body,
    headers: requestHeaders,
    credentials: 'include',
  })

  const contentType = response.headers.get('content-type') ?? ''
  const payload =
    contentType.includes('application/json') && response.status !== 204
      ? await response.json()
      : null

  if (!response.ok) {
    if (response.status === 401 && retryOnExpiredToken) {
      const refreshedToken = await refreshStoredTokenAfterExpiredResponse().catch(() => '')
      if (refreshedToken && refreshedToken !== token) {
        return apiFetch(path, {
          ...options,
          retryOnExpiredToken: false,
        })
      }
    }

    if (response.status === 401) {
      clearStoredAuth()
    }

    const message = payload?.error ?? payload?.mensaje ?? payload?.message ?? 'Solicitud fallida'
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message))
  }

  const normalized = normalizePayload(path, payload)
  if (method !== 'GET') {
    invalidateByMutation(path)
  }
  return normalized
}

export async function apiRequest(path, options = {}) {
  return apiFetch(path, options)
}

async function performGet(path, options) {
  return apiFetch(path, { method: 'GET', ...options })
}

export async function apiGet(path, options = {}) {
  const useCache = isCacheable(path) && !options.forceFresh

  if (useCache) {
    const cachedPayload = getCachedApiData(path)
    if (cachedPayload) return cachedPayload

    const cacheKey = getCacheKey(path)
    if (inflightRequests.has(cacheKey)) return inflightRequests.get(cacheKey)

    const request = performGet(path, options)
      .then((payload) => setCachedEntry(path, payload))
      .finally(() => inflightRequests.delete(cacheKey))

    inflightRequests.set(cacheKey, request)
    return request
  }

  return performGet(path, options)
}

export async function primeApiCache(paths = []) {
  const targets = Array.isArray(paths) ? paths : [paths]
  const uniqueTargets = [...new Set(targets.filter(Boolean))]
  const concurrency = 2
  let cursor = 0

  const worker = async () => {
    while (cursor < uniqueTargets.length) {
      const currentIndex = cursor
      cursor += 1
      const path = uniqueTargets[currentIndex]
      await apiGet(path).catch(() => null)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, uniqueTargets.length) }, worker))
}

export async function apiPost(path, body, options = {}) {
  return apiFetch(path, { ...options, method: 'POST', body })
}

export const apiPut = async (path, body, options = {}) => {
  return apiFetch(path, { ...options, method: 'PUT', body })
}

export const apiPatch = async (path, body, options = {}) => {
  return apiFetch(path, { ...options, method: 'PATCH', body })
}

export const apiDelete = async (path, options = {}) => {
  return apiFetch(path, { ...options, method: 'DELETE' })
}

export default {
  apiRequest,
  apiGet,
  apiPost,
  apiPut,
  apiPatch,
  apiDelete,
  primeApiCache,
  invalidateApiCache,
  getCachedApiData,
  clearAllApiCache,
}
