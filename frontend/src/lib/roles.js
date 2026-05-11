export const ROLES = {
  ADMIN: 'admin',
  PORTERO: 'portero',
  OPERADOR: 'operador',
  SEGURIDAD: 'seguridad',
  MANTENIMIENTO: 'mantenimiento',
  USUARIO: 'usuario',
}

export function normalizeRole(role) {
  const normalized = String(role || '').trim().toLowerCase()
  return normalized === 'user' ? ROLES.USUARIO : normalized
}

export function normalizeApprovalStatus(status) {
  const normalized = String(status || '').trim().toLowerCase()
  if (['pending', 'pending_approval', 'pendiente', 'pendiente_aprobacion'].includes(normalized)) {
    return 'pendiente_aprobacion'
  }
  if (['approved', 'aprobado', 'active', 'activo'].includes(normalized)) {
    return 'aprobado'
  }
  if (['rejected', 'rechazado'].includes(normalized)) {
    return 'rechazado'
  }
  return normalized
}

export function isPendingApproval(status) {
  return normalizeApprovalStatus(status) === 'pendiente_aprobacion'
}

export function getDefaultRouteForRole(role, status) {
  if (isPendingApproval(status)) return '/pending-activation'
  const currentRole = normalizeRole(role)
  if (currentRole === ROLES.USUARIO) return '/vehicles'
  if (currentRole === ROLES.ADMIN) return '/dashboard'
  if ([ROLES.PORTERO, ROLES.OPERADOR, ROLES.SEGURIDAD, ROLES.MANTENIMIENTO].includes(currentRole)) return '/gate'
  return '/pending-activation'
}

export function hasAnyRole(role, allowedRoles = []) {
  if (!allowedRoles?.length) return true
  return allowedRoles.map(normalizeRole).includes(normalizeRole(role))
}


