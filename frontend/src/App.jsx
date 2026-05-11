import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import ProtectedRoute from './components/ProtectedRoute'
import PublicRoute from './components/PublicRoute'
import PanelLayout from './components/PanelLayout'
import { AuthProvider } from './contexts/AuthContext'
import { ROLES } from './lib/roles'

const AccessAlerts = lazy(() => import('./pages/AccessAlerts'))
const ValidateAccessCode = lazy(() => import('./pages/ValidateAccessCode'))
const AssignParking = lazy(() => import('./pages/AssignParking'))
const MonthlyPlans = lazy(() => import('./pages/MonthlyPlans'))
const Morosidad = lazy(() => import('./pages/Morosidad'))
const Payments = lazy(() => import('./pages/Payments'))
const Reservations = lazy(() => import('./pages/Reservations'))
const Settings = lazy(() => import('./pages/Settings'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const OccupiedSpaces = lazy(() => import('./pages/OccupiedSpaces'))
const PendingActivation = lazy(() => import('./pages/PendingActivation'))
const PersonnelRegistration = lazy(() => import('./pages/PersonnelRegistration'))
const UserManagement = lazy(() => import('./pages/UserManagement'))
const VehicleManagement = lazy(() => import('./pages/VehicleManagement'))
const ParkingHistory = lazy(() => import('./pages/ParkingHistory'))
const VehicleHistory = lazy(() => import('./pages/VehicleHistory'))
const Visitors = lazy(() => import('./pages/Visitors'))
const Landing = lazy(() => import('./pages/Landing'))
const ReleaseParking = lazy(() => import('./pages/ReleaseParking'))
const Login = lazy(() => import('./pages/Login'))
const LoginSessions = lazy(() => import('./pages/LoginSessions'))
const OTPCodes = lazy(() => import('./pages/OTPCodes'))
const GatePanel = lazy(() => import('./pages/GatePanel'))
const ParkingSpaces = lazy(() => import('./pages/ParkingSpaces'))
const Register = lazy(() => import('./pages/Register'))
const VerifyOTP = lazy(() => import('./pages/VerifyOTP'))
const Reports = lazy(() => import('./pages/Reports'))
const NoAccess = lazy(() => import('./pages/NoAccess'))
const VehicleLogs = lazy(() => import('./pages/VehicleLogs'))
const Vehicles = lazy(() => import('./pages/Vehicles'))
const Verify = lazy(() => import('./pages/Verify'))

function RouteFallback() {
  return (
    <div
      style={{
        minHeight: '38vh',
        display: 'grid',
        placeItems: 'center',
        color: '#cbd5e1',
        fontWeight: 700,
        letterSpacing: '0.04em',
      }}
    >
      Cargando modulo...
    </div>
  )
}

function withSuspense(element) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>
}

function withPanel(element) {
  return <PanelLayout>{withSuspense(element)}</PanelLayout>
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={withSuspense(<Landing />)} />

          <Route element={<PublicRoute />}>
            <Route path="/login"    element={withSuspense(<Login />)} />
            <Route path="/register" element={withSuspense(<Register />)} />
            <Route path="/verify"   element={withSuspense(<Verify />)} />
            <Route path="/verify-otp" element={withSuspense(<VerifyOTP />)} />
          </Route>

          <Route path="/staff-register" element={withSuspense(<PersonnelRegistration mode="public" />)} />
          <Route path="/pending-activation" element={withSuspense(<PendingActivation />)} />
          <Route path="/no-access"          element={withSuspense(<NoAccess />)} />

          {/* Admin + Portero + Personal operativo */}
          <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.PORTERO, ROLES.OPERADOR, ROLES.SEGURIDAD, ROLES.MANTENIMIENTO]} />}>
            <Route path="/dashboard"        element={withPanel(<Dashboard />)} />
            <Route path="/gate"             element={withPanel(<GatePanel />)} />
            <Route path="/access-codes"     element={withPanel(<ValidateAccessCode />)} />
            <Route path="/visitors"         element={withPanel(<Visitors />)} />
            <Route path="/parking/history"  element={withPanel(<ParkingHistory />)} />
            <Route path="/parking/occupied" element={withPanel(<OccupiedSpaces />)} />
            <Route path="/parking/release"  element={withPanel(<ReleaseParking />)} />
          </Route>

          {/* Admin + Portero + Usuario + Personal operativo */}
          <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.PORTERO, ROLES.OPERADOR, ROLES.SEGURIDAD, ROLES.MANTENIMIENTO, ROLES.USUARIO]} />}>
            <Route path="/parking/assign" element={withPanel(<AssignParking />)} />
            <Route path="/vehicles"       element={withPanel(<Vehicles />)} />
            <Route path="/payments"       element={withPanel(<Payments />)} />
            <Route path="/reservas"       element={withPanel(<Reservations />)} />
            <Route path="/settings"       element={withPanel(<Settings />)} />
          </Route>

          {/* Solo Admin */}
          <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]} />}>
            <Route path="/parking/spaces"   element={withPanel(<ParkingSpaces />)} />
            <Route path="/vehicles/manage"  element={withPanel(<VehicleManagement />)} />
            <Route path="/users"            element={withPanel(<UserManagement />)} />
            <Route path="/vehicles/history" element={withPanel(<VehicleHistory />)} />
            <Route path="/reports"          element={withPanel(<Reports />)} />
            <Route path="/monthly-plans"    element={withPanel(<MonthlyPlans />)} />
            <Route path="/morosidad"        element={withPanel(<Morosidad />)} />
            <Route path="/access-alerts"    element={withPanel(<AccessAlerts />)} />
            <Route path="/vehicle-logs"     element={withPanel(<VehicleLogs />)} />
            <Route path="/login-sessions"   element={withPanel(<LoginSessions />)} />
            <Route path="/otp-codes"        element={withPanel(<OTPCodes />)} />
            <Route path="/personnel"        element={withPanel(<PersonnelRegistration mode="admin" />)} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
