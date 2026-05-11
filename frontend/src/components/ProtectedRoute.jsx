import { Navigate, Outlet, useLocation } from 'react-router-dom'

import AuthLoadingScreen from './AuthLoadingScreen'
import { useAuth } from '../contexts/AuthContext'
import { hasAnyRole, isPendingApproval } from '../lib/roles'

export default function ProtectedRoute({ allowedRoles = [] }) {
  const { isAuthenticated, loading, user } = useAuth()
  const location = useLocation()

  if (loading) {
    return <AuthLoadingScreen message="Verificando sesión..." />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (isPendingApproval(user?.status || user?.approval_status)) {
    return <Navigate to="/pending-activation" replace state={{ from: location }} />
  }

  if (!hasAnyRole(user?.role || user?.user_metadata?.role, allowedRoles)) {
    return <Navigate to="/no-access" replace state={{ from: location }} />
  }

  return <Outlet />
}
