export const ROLES = {
  ADMIN: 'admin',
  PORTERO: 'portero',
  USUARIO: 'usuario',
}

export function normalizeRole(role) {
  const normalized = String(role || '').trim().toLowerCase()
  return normalized === 'user' ? ROLES.USUARIO : normalized
}

export function getDefaultRouteForRole(role) {
  const currentRole = normalizeRole(role)
  if (currentRole === ROLES.USUARIO) return '/vehicles'
  if (currentRole === ROLES.ADMIN) return '/dashboard'
  if (currentRole === ROLES.PORTERO) return '/gate'
  return '/pending-activation'
}

export function hasAnyRole(role, allowedRoles = []) {
  if (!allowedRoles?.length) return true
  return allowedRoles.map(normalizeRole).includes(normalizeRole(role))
}


