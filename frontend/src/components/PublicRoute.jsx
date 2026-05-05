import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'
import { getDefaultRouteForRole } from '../lib/roles'

export default function PublicRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const forceAccess = new URLSearchParams(location.search).get('force') === '1'

  if (forceAccess) {
    return <Outlet />
  }

  if (loading) {
    return null
  }

  if (user) {
    return <Navigate to={getDefaultRouteForRole(user?.role)} replace />
  }

  return <Outlet />
}

