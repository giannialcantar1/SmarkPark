import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import ProtectedRoute from './components/ProtectedRoute'
import PublicRoute from './components/PublicRoute'
import PanelLayout from './components/PanelLayout'
import { AuthProvider } from './contexts/AuthContext'
import { ROLES } from './lib/roles'

import AccessAlerts      from './pages/AccessAlerts'
import ValidateAccessCode from './pages/ValidateAccessCode'
import AssignParking     from './pages/AssignParking'
import MonthlyPlans      from './pages/MonthlyPlans'
import Morosidad         from './pages/Morosidad'
import Payments          from './pages/Payments'
import Reservations      from './pages/Reservations'
import Settings          from './pages/Settings'
import Dashboard         from './pages/Dashboard'
import OccupiedSpaces    from './pages/OccupiedSpaces'
import PendingActivation from './pages/PendingActivation'
import PersonnelRegistration from './pages/PersonnelRegistration'
import UserManagement    from './pages/UserManagement'
import VehicleManagement from './pages/VehicleManagement'
import ParkingHistory    from './pages/ParkingHistory'
import VehicleHistory    from './pages/VehicleHistory'
import Visitors          from './pages/Visitors'
import Landing           from './pages/Landing'
import ReleaseParking    from './pages/ReleaseParking'
import Login             from './pages/Login'
import LoginSessions     from './pages/LoginSessions'
import OTPCodes          from './pages/OTPCodes'
import GatePanel         from './pages/GatePanel'
import ParkingSpaces     from './pages/ParkingSpaces'
import Register          from './pages/Register'
import VerifyOTP         from './pages/VerifyOTP'
import Reports           from './pages/Reports'
import NoAccess          from './pages/NoAccess'
import VehicleLogs       from './pages/VehicleLogs'
import Vehicles          from './pages/Vehicles'
import Verify            from './pages/Verify'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />

          <Route element={<PublicRoute />}>
            <Route path="/login"    element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify"   element={<Verify />} />
            <Route path="/verify-otp" element={<VerifyOTP />} />
          </Route>

          <Route path="/staff-register" element={<PersonnelRegistration mode="public" />} />
          <Route path="/pending-activation" element={<PendingActivation />} />
          <Route path="/no-access"          element={<NoAccess />} />

          {/* Admin + Portero + Personal operativo */}
          <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.PORTERO, ROLES.OPERADOR, ROLES.SEGURIDAD, ROLES.MANTENIMIENTO]} />}>
            <Route path="/dashboard"        element={<PanelLayout><Dashboard /></PanelLayout>} />
            <Route path="/gate"             element={<PanelLayout><GatePanel /></PanelLayout>} />
            <Route path="/access-codes"     element={<PanelLayout><ValidateAccessCode /></PanelLayout>} />
            <Route path="/visitors"         element={<PanelLayout><Visitors /></PanelLayout>} />
            <Route path="/parking/history"  element={<PanelLayout><ParkingHistory /></PanelLayout>} />
            <Route path="/parking/occupied" element={<PanelLayout><OccupiedSpaces /></PanelLayout>} />
            <Route path="/parking/release"  element={<PanelLayout><ReleaseParking /></PanelLayout>} />
          </Route>

          {/* Admin + Portero + Usuario + Personal operativo */}
          <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.PORTERO, ROLES.OPERADOR, ROLES.SEGURIDAD, ROLES.MANTENIMIENTO, ROLES.USUARIO]} />}>
            <Route path="/parking/assign" element={<PanelLayout><AssignParking /></PanelLayout>} />
            <Route path="/vehicles"       element={<PanelLayout><Vehicles /></PanelLayout>} />
            <Route path="/payments"       element={<PanelLayout><Payments /></PanelLayout>} />
            <Route path="/reservas"       element={<PanelLayout><Reservations /></PanelLayout>} />
            <Route path="/settings"       element={<PanelLayout><Settings /></PanelLayout>} />
          </Route>

          {/* Solo Admin */}
          <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]} />}>
            <Route path="/parking/spaces"   element={<PanelLayout><ParkingSpaces /></PanelLayout>} />
            <Route path="/vehicles/manage"  element={<PanelLayout><VehicleManagement /></PanelLayout>} />
            <Route path="/users"            element={<PanelLayout><UserManagement /></PanelLayout>} />
            <Route path="/vehicles/history" element={<PanelLayout><VehicleHistory /></PanelLayout>} />
            <Route path="/reports"          element={<PanelLayout><Reports /></PanelLayout>} />
            <Route path="/monthly-plans"    element={<PanelLayout><MonthlyPlans /></PanelLayout>} />
            <Route path="/morosidad"        element={<PanelLayout><Morosidad /></PanelLayout>} />
            <Route path="/access-alerts"    element={<PanelLayout><AccessAlerts /></PanelLayout>} />
            <Route path="/vehicle-logs"     element={<PanelLayout><VehicleLogs /></PanelLayout>} />
            <Route path="/login-sessions"   element={<PanelLayout><LoginSessions /></PanelLayout>} />
            <Route path="/otp-codes"        element={<PanelLayout><OTPCodes /></PanelLayout>} />
            <Route path="/personnel"        element={<PanelLayout><PersonnelRegistration mode="admin" /></PanelLayout>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
