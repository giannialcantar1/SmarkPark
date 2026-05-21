import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import PageSkeleton from './components/PageSkeleton'
import { ROLES } from './lib/roles'

const AuthScopeRoute = lazy(() => import('./components/AuthScopeRoute'))
const ProtectedPanelOutlet = lazy(() => import('./components/ProtectedPanelOutlet'))
const AccessAlerts = lazy(() => import('./pages/AccessAlerts'))
const QRAccess = lazy(() => import('./pages/QRAccess'))
const AssignParking = lazy(() => import('./pages/AssignParking'))
const MonthlyPlans = lazy(() => import('./pages/MonthlyPlans'))
const MonthlyPayments = lazy(() => import('./pages/MonthlyPayments'))
const Morosidad = lazy(() => import('./pages/Morosidad'))
const Payments = lazy(() => import('./pages/Payments'))
const Reservations = lazy(() => import('./pages/Reservations'))
const Settings = lazy(() => import('./pages/Settings'))
const UserSubscriptions = lazy(() => import('./pages/UserSubscriptions'))
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
    <PageSkeleton compact />
  )
}

function withSuspense(element) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={withSuspense(<Landing />)} />
        <Route path="/login" element={withSuspense(<Login />)} />
        <Route path="/register" element={withSuspense(<Register />)} />
        <Route path="/verify" element={withSuspense(<Verify />)} />
        <Route path="/verify-otp" element={withSuspense(<VerifyOTP />)} />
        <Route path="/pending-activation" element={withSuspense(<PendingActivation />)} />

        <Route element={withSuspense(<AuthScopeRoute />)}>
          <Route path="/staff-register" element={withSuspense(<PersonnelRegistration mode="public" />)} />
          <Route path="/no-access" element={withSuspense(<NoAccess />)} />

          <Route element={withSuspense(<ProtectedPanelOutlet allowedRoles={[ROLES.ADMIN, ROLES.PORTERO, ROLES.OPERADOR, ROLES.SEGURIDAD, ROLES.MANTENIMIENTO]} />)}>
            <Route path="/dashboard" element={withSuspense(<Dashboard />)} />
            <Route path="/gate" element={withSuspense(<GatePanel />)} />
            <Route path="/qr-access" element={withSuspense(<QRAccess />)} />
            <Route path="/visitors" element={withSuspense(<Visitors />)} />
            <Route path="/parking/history" element={withSuspense(<ParkingHistory />)} />
            <Route path="/parking/occupied" element={withSuspense(<OccupiedSpaces />)} />
            <Route path="/parking/release" element={withSuspense(<ReleaseParking />)} />
          </Route>

          <Route element={withSuspense(<ProtectedPanelOutlet allowedRoles={[ROLES.ADMIN, ROLES.PORTERO, ROLES.OPERADOR, ROLES.SEGURIDAD, ROLES.MANTENIMIENTO, ROLES.USUARIO]} />)}>
            <Route path="/parking/assign" element={withSuspense(<AssignParking />)} />
            <Route path="/vehicles" element={withSuspense(<Vehicles />)} />
            <Route path="/payments" element={withSuspense(<Payments />)} />
            <Route path="/reservas" element={withSuspense(<Reservations />)} />
            <Route path="/settings" element={withSuspense(<Settings />)} />
            <Route path="/user/subscriptions" element={withSuspense(<UserSubscriptions />)} />
          </Route>

          <Route element={withSuspense(<ProtectedPanelOutlet allowedRoles={[ROLES.ADMIN]} />)}>
            <Route path="/parking/spaces" element={withSuspense(<ParkingSpaces />)} />
            <Route path="/vehicles/manage" element={withSuspense(<VehicleManagement />)} />
            <Route path="/users" element={withSuspense(<UserManagement />)} />
            <Route path="/vehicles/history" element={withSuspense(<VehicleHistory />)} />
            <Route path="/reports" element={withSuspense(<Reports />)} />
            <Route path="/monthly-plans" element={withSuspense(<MonthlyPlans />)} />
            <Route path="/monthly-payments" element={withSuspense(<MonthlyPayments />)} />
            <Route path="/morosidad" element={withSuspense(<Morosidad />)} />
            <Route path="/access-alerts" element={withSuspense(<AccessAlerts />)} />
            <Route path="/vehicle-logs" element={withSuspense(<VehicleLogs />)} />
            <Route path="/login-sessions" element={withSuspense(<LoginSessions />)} />
            <Route path="/otp-codes" element={withSuspense(<OTPCodes />)} />
            <Route path="/personnel" element={withSuspense(<PersonnelRegistration mode="admin" />)} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
