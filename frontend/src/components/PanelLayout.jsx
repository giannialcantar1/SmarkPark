import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'

import NotificationsBell from './NotificationsBell'
import { useAuth } from '../contexts/AuthContext'
import { ROLES, normalizeRole } from '../lib/roles'

const menuLinks = {
  dashboard:          { to: '/dashboard',         label: 'Dashboard',              icon: 'dashboard' },
  gate:               { to: '/gate',              label: 'Panel de Porteria',      icon: 'shield_person' },
  accessCodes:        { to: '/access-codes',      label: 'Acceso por Codigo',      icon: 'pin' },
  assignParking:      { to: '/parking/assign',    label: 'Asignar Parqueo',        icon: 'directions_car' },
  monthlyPlans:       { to: '/monthly-plans',     label: 'Planes Mensuales',       icon: 'payments' },
  morosidad:          { to: '/morosidad',         label: 'Morosidad',              icon: 'warning' },
  reservations:       { to: '/reservas',          label: 'Reservas',               icon: 'event_available' },
  visitors:           { to: '/visitors',          label: 'Visitantes',             icon: 'person_add' },
  occupiedSpaces:     { to: '/parking/occupied',  label: 'Espacios Ocupados',      icon: 'garage' },
  releaseParking:     { to: '/parking/release',   label: 'Liberar Espacio',        icon: 'door_open' },
  vehicles:           { to: '/vehicles',          label: 'Vehiculos',              icon: 'airport_shuttle' },
  vehicleManagement:  { to: '/vehicles/manage',   label: 'Gestion de Vehiculos',   icon: 'edit_square' },
  parkingHistory:     { to: '/parking/history',   label: 'Historial de Parqueos',  icon: 'history' },
  vehicleHistory:     { to: '/vehicles/history',  label: 'Vehicle History',        icon: 'history_toggle_off' },
  users:              { to: '/users',             label: 'Usuarios',               icon: 'manage_accounts' },
  payments:           { to: '/payments',          label: 'Payments',               icon: 'payments' },
  reports:            { to: '/reports',           label: 'Reportes',               icon: 'description' },
  accessAlerts:       { to: '/access-alerts',     label: 'Alertas de Acceso',      icon: 'security' },
  settings:           { to: '/settings',          label: 'Configuracion',          icon: 'settings' },
}

const menuOrderByRole = {
  [ROLES.ADMIN]: [
    menuLinks.dashboard,
    menuLinks.gate,
    menuLinks.accessCodes,
    'separator',
    menuLinks.assignParking,
    menuLinks.reservations,
    menuLinks.visitors,
    menuLinks.occupiedSpaces,
    menuLinks.releaseParking,
    'separator',
    menuLinks.vehicles,
    menuLinks.vehicleManagement,
    menuLinks.parkingHistory,
    menuLinks.vehicleHistory,
    'separator',
    menuLinks.users,
    menuLinks.payments,
    menuLinks.monthlyPlans,
    menuLinks.morosidad,
    menuLinks.reports,
    menuLinks.accessAlerts,
    'separator',
    menuLinks.settings,
  ],
  [ROLES.PORTERO]: [
    menuLinks.dashboard,
    menuLinks.gate,
    menuLinks.accessCodes,
    menuLinks.assignParking,
    menuLinks.visitors,
    menuLinks.occupiedSpaces,
    menuLinks.parkingHistory,
    menuLinks.settings,
  ],
  [ROLES.USUARIO]: [
    menuLinks.vehicles,
    menuLinks.payments,
    menuLinks.reservations,
    menuLinks.settings,
  ],
}

const roleLabels = {
  [ROLES.ADMIN]:   'Administrator',
  [ROLES.PORTERO]: 'Gate Operator',
  [ROLES.USUARIO]: 'User',
}

// Routes where the page handles its own bell
const INLINE_BELL_ROUTES = new Set([
  '/dashboard',
  '/parking/assign',
  '/parking/occupied',
  '/vehicles',
  '/vehicles/manage',
])

export default function PanelLayout({ children }) {
  const { logout, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [banner, setBanner] = useState('')
  const [expanded, setExpanded] = useState(false)

  const currentRole = normalizeRole(user?.user_metadata?.role || user?.role)
  const displayName = user?.full_name || user?.name || user?.email || 'User'
  const avatarLetter = (user?.full_name || user?.name || user?.email || 'U')
    .trim()
    .charAt(0)
    .toUpperCase()
  const avatarUrl = user?.avatar_url || ''

  const showBell =
    location.pathname !== '/settings' && !INLINE_BELL_ROUTES.has(location.pathname)

  const visibleLinks = useMemo(() => menuOrderByRole[currentRole] || [], [currentRole])

  useEffect(() => {
    const authMessage = location.state?.authMessage
    if (!authMessage) return
    setBanner(authMessage)
    navigate(location.pathname, { replace: true, state: {} })
  }, [location.pathname, location.state, navigate])

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className={`panel-shell${expanded ? ' expanded' : ''}`}>
      <aside
        className={`panel-sidebar${expanded ? ' expanded' : ''}`}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
      >
        <div className="sidebar-brand">
          <span className="brand-icon">
            <img
              className="brand-logo"
              src="/images/logo-smartpark.png"
              alt="SmartPark Logo"
            />
          </span>
          <div className={`brand-copy${expanded ? ' expanded' : ''}`}>
            <span className="brand-name">SmartPark</span>
            <span className="brand-subtitle brand-subtitle--wide">TOTAL CONTROL</span>
          </div>
        </div>

        <nav className="panel-nav">
          {visibleLinks.map((link, index) =>
            link === 'separator' ? (
              <div
                key={`separator-${index}`}
                className={`panel-nav__separator${expanded ? ' expanded' : ''}`}
                aria-hidden="true"
              />
            ) : (
              <NavLink
                end
                key={link.to}
                className={({ isActive }) => `panel-link${isActive ? ' active' : ''}`}
                to={link.to}
              >
                <span className="panel-link__icon material-symbols-outlined">{link.icon}</span>
                <span className={`panel-link__label${expanded ? ' expanded' : ''}`}>
                  {link.label}
                </span>
              </NavLink>
            ),
          )}
        </nav>

        <div className={`sidebar-profile${expanded ? ' expanded' : ''}`}>
          <div className="profile-pic" aria-hidden="true">
            {avatarUrl ? (
              <img
                className="profile-pic__image"
                src={avatarUrl}
                alt={`${displayName} avatar`}
              />
            ) : (
              avatarLetter || 'U'
            )}
          </div>
          <div className={`sidebar-profile__copy${expanded ? ' expanded' : ''}`}>
            <p className="profile-name">{displayName}</p>
            <p className="profile-role">{roleLabels[currentRole] || 'Pending Activation'}</p>
          </div>
        </div>

        <button
          type="button"
          className={`btn btn-tertiary sidebar-logout${expanded ? ' expanded' : ''}`}
          onClick={handleLogout}
          aria-label="Log out"
        >
          <span className="material-symbols-outlined">logout</span>
          <span className={`sidebar-logout__label${expanded ? ' expanded' : ''}`}>
            Log out
          </span>
        </button>
      </aside>

      <section className="panel-main">
        {showBell && (
          <div className="panel-main__topbar">
            {location.pathname === '/parking/occupied' && (
              <button
                type="button"
                className="module-icon-btn"
                title="Assign parking"
                onClick={() => window.dispatchEvent(new CustomEvent('smartpark:open-entry-modal'))}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                  add_circle
                </span>
              </button>
            )}
            <NotificationsBell />
          </div>
        )}

        {banner && (
          <div className="module-feedback error panel-alert" role="alert">
            {banner}
          </div>
        )}

        {children}
      </section>
    </div>
  )
}
