import { Outlet } from 'react-router-dom'

import { AuthProvider } from '../contexts/AuthContext'

export default function AuthScopeRoute() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}
