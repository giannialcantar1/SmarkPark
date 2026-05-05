import { useEffect, useMemo, useState } from 'react'

import ModalEntry from '../components/ModalEntry'
import useApi from '../hooks/useApi'
import { getActiveSessions, getDashboardStats, getParkingSpaces, getVehicles } from '../services/api'

import NotificationsBell from '../components/NotificationsBell'

const WEEK_LABELS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom']

function formatMoney(value) {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0)
}

function formatCompactMoney(value) {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(value) || 0)
}

function formatPercent(value) {
  return `${Math.round(Number(value) || 0)}%`
}

function formatTime(value) {
  if (!value) return '--:--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--:--'
  return new Intl.DateTimeFormat('es-DO', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatDateLabel(value) {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit',
    month: 'short',
  }).format(date)
}

function getSpaceStatus(space) {
  const raw = String(space?.status || space?.estado || '').trim().toLowerCase()
  return raw.includes('ocup') ? 'occupied' : 'available'
}

function getSpaceFloor(space) {
  return String(space?.floor || space?.nivel_mostrar || space?.tipo || space?.piso || 'N/D')
    .trim()
    .toUpperCase()
}

function getSpaceCode(space) {
  return String(space?.code || space?.codigo || space?.nombre || space?.id || 'N/D').trim()
}

function getVehicleStatus(vehicle) {
  return String(vehicle?.status || vehicle?.estado || '').trim().toLowerCase()
}

function isActiveVehicle(vehicle) {
  const status = getVehicleStatus(vehicle)
  if (vehicle?.is_active === true) return true
  if (vehicle?.salida || vehicle?.exit_time || vehicle?.hora_salida) return false
  return ['dentro', 'activo', 'active', 'inside'].includes(status)
}

function getVehicleAmount(vehicle) {
  return Number(vehicle?.monto_total ?? vehicle?.total_amount ?? vehicle?.amount ?? 0) || 0
}

function getVehicleDate(vehicle) {
  return (
    vehicle?.hora_salida ||
    vehicle?.exit_time ||
    vehicle?.hora_entrada ||
    vehicle?.entry_time ||
    vehicle?.created_at ||
    null
  )
}

function isSameDay(dateA, dateB) {
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  )
}

function getWeekStart(baseDate) {
  const date = new Date(baseDate)
  const dayIndex = (date.getDay() + 6) % 7
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - dayIndex)
  return date
}

function buildRevenueTrend(vehicles) {
  const today = new Date()
  const weekStart = getWeekStart(today)
  const values = new Array(7).fill(0)

  vehicles.forEach((vehicle) => {
    const amount = getVehicleAmount(vehicle)
    const rawDate = vehicle?.hora_salida || vehicle?.exit_time || vehicle?.created_at
    if (!amount || !rawDate) return

    const date = new Date(rawDate)
    if (Number.isNaN(date.getTime()) || date < weekStart) return

    const bucket = Math.floor((date.getTime() - weekStart.getTime()) / 86400000)
    if (bucket >= 0 && bucket < 7) {
      values[bucket] += amount
    }
  })

  const maxValue = Math.max(...values, 1)

  return WEEK_LABELS.map((label, index) => ({
    label,
    value: values[index],
    height: Math.max(12, Math.round((values[index] / maxValue) * 100)),
    active: index === ((today.getDay() + 6) % 7),
  }))
}

function getSessionAmount(session) {
  return Number(
    session?.monto_total ??
      session?.amount_to_pay ??
      session?.amount ??
      session?.costo ??
      session?.total_amount ??
      0,
  ) || 0
}

function getSessionDate(session) {
  return (
    session?.salida ||
    session?.exit_time ||
    session?.hora_fin ||
    session?.created_at ||
    session?.entrada ||
    session?.entry_time ||
    null
  )
}

function buildSessionRevenueTrend(sessions, fallbackVehicles) {
  const source = Array.isArray(sessions) && sessions.length ? sessions : fallbackVehicles
  const today = new Date()
  const weekStart = getWeekStart(today)
  const values = new Array(7).fill(0)

  source.forEach((item) => {
    const amount = getSessionAmount(item) || getVehicleAmount(item)
    const rawDate = getSessionDate(item) || getVehicleDate(item)
    if (!amount || !rawDate) return

    const date = new Date(rawDate)
    if (Number.isNaN(date.getTime()) || date < weekStart) return

    const bucket = Math.floor((date.getTime() - weekStart.getTime()) / 86400000)
    if (bucket >= 0 && bucket < 7) values[bucket] += amount
  })

  const maxValue = Math.max(...values, 1)

  return WEEK_LABELS.map((label, index) => ({
    label,
    value: values[index],
    height: Math.max(12, Math.round((values[index] / maxValue) * 100)),
    active: index === ((today.getDay() + 6) % 7),
  }))
}

function buildRecentActivity(statsActivity, vehicles) {
  if (Array.isArray(statsActivity) && statsActivity.length) {
    return statsActivity.slice(0, 6).map((item, index) => ({
      id: `${item.vehicle}-${item.time}-${index}`,
      plate: item.vehicle,
      owner: item.owner,
      type: item.type === 'exit' ? 'Salida' : 'Entrada',
      time: item.time,
      badgeClass: item.type === 'exit' ? 'exit' : 'entry',
      detail: item.type === 'exit' ? 'Vehículo procesado para salida' : 'Vehículo ingresado al recinto',
    }))
  }

  return vehicles.slice(0, 6).map((vehicle, index) => {
    const status = getVehicleStatus(vehicle)
    const isInside = status === 'dentro'
    const eventDate = getVehicleDate(vehicle)

    return {
      id: `${vehicle?.placa || vehicle?.plate || 'veh'}-${index}`,
      plate: vehicle?.placa || vehicle?.plate || 'N/D',
      owner: vehicle?.propietario || vehicle?.owner || vehicle?.owner_name || 'Sin propietario',
      type: isInside ? 'Entrada' : 'Salida',
      time: formatTime(eventDate),
      badgeClass: isInside ? 'entry' : 'exit',
      detail: formatDateLabel(eventDate),
    }
  })
}

export default function Dashboard() {
  const [isEntryOpen, setIsEntryOpen] = useState(false)
  const [activeFloor, setActiveFloor] = useState('A')
  const [lastUpdate, setLastUpdate] = useState(new Date())

  const statsApi = useApi(getDashboardStats, { immediate: true, retries: 0, initialData: {} })
  const spacesApi = useApi(getParkingSpaces, { immediate: true, retries: 0, initialData: [] })
  const vehiclesApi = useApi(getVehicles, { immediate: true, retries: 0, initialData: [] })
  const activeSessionsApi = useApi(getActiveSessions, { immediate: true, retries: 0, initialData: [] })

  // FIX: Actualización automática cada 5 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      statsApi.execute()
      spacesApi.execute()
      vehiclesApi.execute()
      activeSessionsApi.execute()
      setLastUpdate(new Date())
    }, 5000) // 5 segundos
    
    return () => clearInterval(interval)
  }, [])

  // FIX: Escuchar evento personalizado para actualización inmediata
  useEffect(() => {
    const handleImmediateRefresh = () => {
      statsApi.execute()
      spacesApi.execute()
      vehiclesApi.execute()
      activeSessionsApi.execute()
      setLastUpdate(new Date())
    }
    
    window.addEventListener('dashboard-refresh', handleImmediateRefresh)
    return () => window.removeEventListener('dashboard-refresh', handleImmediateRefresh)
  }, [])

  // FIX: Actualizar contador de "Hace X segundos" cada segundo
  const [secondsAgo, setSecondsAgo] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsAgo(Math.floor((new Date() - lastUpdate) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [lastUpdate])

  const stats = statsApi.data || {}
  const spaces = Array.isArray(spacesApi.data) ? spacesApi.data : []
  const vehicles = Array.isArray(vehiclesApi.data) ? vehiclesApi.data : []
  const activeSessions = Array.isArray(activeSessionsApi.data) ? activeSessionsApi.data : []

  const occupancy = useMemo(() => {
    const totalSpaces = Math.max(Number(stats.totalSpaces || 0), spaces.length, activeSessions.length)
    const occupiedSpaces = Math.max(
      Number(stats.occupiedSpaces || 0),
      spaces.filter((space) => getSpaceStatus(space) === 'occupied').length,
      activeSessions.length,
    )
    const availableSpaces =
      Number(stats.availableSpaces || 0) || Math.max(totalSpaces - occupiedSpaces, 0)
    const occupancyPercentage =
      Number(stats.occupancyPercentage || 0) ||
      (totalSpaces ? Math.round((occupiedSpaces / totalSpaces) * 100) : 0)

    return {
      totalSpaces,
      occupiedSpaces,
      availableSpaces,
      occupancyPercentage,
    }
  }, [activeSessions.length, spaces, stats])

  const activeVehicles = useMemo(() => {
    const fromStats = Number(stats.totalVehicles || 0)
    if (fromStats) return fromStats
    if (activeSessions.length) return activeSessions.length
    return vehicles.filter(isActiveVehicle).length
  }, [activeSessions.length, stats.totalVehicles, vehicles])

  const todayIncome = useMemo(() => {
    if (Number(stats.todayIncome || 0)) return Number(stats.todayIncome || 0)

    const today = new Date()
    const incomeSources = [...activeSessions, ...vehicles]
    return incomeSources.reduce((accumulator, item) => {
      const amount = getSessionAmount(item) || getVehicleAmount(item)
      const rawDate = getSessionDate(item) || getVehicleDate(item)
      if (!amount || !rawDate) return accumulator

      const date = new Date(rawDate)
      if (Number.isNaN(date.getTime()) || !isSameDay(date, today)) return accumulator
      return accumulator + amount
    }, 0)
  }, [activeSessions, stats.todayIncome, vehicles])

  const floors = useMemo(() => {
    const fromStats = Array.isArray(stats.floorStats) ? stats.floorStats.map((item) => String(item.floor)) : []
    const fromSpaces = spaces.map((space) => getSpaceFloor(space))
    const unique = [...new Set([...fromStats, ...fromSpaces].filter(Boolean))]
    return unique.length ? unique.sort() : ['A', 'B', 'C', 'D']
  }, [spaces, stats.floorStats])

  useEffect(() => {
    if (!floors.includes(activeFloor)) {
      setActiveFloor(floors[0] || 'A')
    }
  }, [activeFloor, floors])

  const floorStats = useMemo(() => {
    // Si el backend devuelve datos válidos, usarlos
    if (Array.isArray(stats.floorStats) && stats.floorStats.length) {
      return stats.floorStats
    }

    // Fallback: calcular desde los espacios
    return floors.map((floor) => {
      const floorSpaces = spaces.filter((space) => getSpaceFloor(space) === floor)
      const occupied = floorSpaces.filter((space) => getSpaceStatus(space) === 'occupied').length
      const available = Math.max(floorSpaces.length - occupied, 0)
      const percentage = floorSpaces.length ? Math.round((occupied / floorSpaces.length) * 100) : 0

      return { floor, occupied, available, percentage }
    })
  }, [floors, spaces, stats.floorStats])

  const activeFloorSpaces = useMemo(() => {
    return spaces
      .filter((space) => getSpaceFloor(space) === activeFloor)
      .sort((left, right) => getSpaceCode(left).localeCompare(getSpaceCode(right), undefined, { numeric: true }))
  }, [activeFloor, spaces])

  const revenueTrend = useMemo(() => {
    // FIX: Usar weeklyIncome del backend (stats.weeklyIncome)
    if (stats?.weeklyIncome) {
      const WEEK_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
      const maxValue = Math.max(...Object.values(stats.weeklyIncome), 1)
      return WEEK_LABELS.map((label, index) => {
        const dayName = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][index]
        const value = stats.weeklyIncome[dayName] || 0
        return {
          label,
          value,
          height: Math.max(12, Math.round((value / maxValue) * 100)),
          active: index === ((new Date()).getDay() + 6) % 7,
        }
      })
    }
    // Fallback: calcular desde sesiones/vehículos
    if (activeSessions.length) return buildSessionRevenueTrend(activeSessions, vehicles)
    return buildRevenueTrend(vehicles)
  }, [activeSessions, vehicles, stats.weeklyIncome])
  const recentActivity = useMemo(
    () => buildRecentActivity(stats.recentActivity, vehicles),
    [stats.recentActivity, vehicles],
  )

  const topError = spacesApi.error || vehiclesApi.error || activeSessionsApi.error
  const notificationCount = topError ? 1 : 0

  const metricCards = [
    {
      label: 'Espacios ocupados',
      value: occupancy.occupiedSpaces,
      sublabel: `${formatPercent(occupancy.occupancyPercentage)} de ocupación actual`,
      accent: 'cyan',
      progress: occupancy.occupancyPercentage,
      icon: 'garage_home',
    },
    {
      label: 'Espacios disponibles',
      value: occupancy.availableSpaces,
      sublabel: `${occupancy.totalSpaces} espacios registrados`,
      accent: 'green',
      progress:
        occupancy.totalSpaces ? Math.round((occupancy.availableSpaces / occupancy.totalSpaces) * 100) : 0,
      icon: 'local_parking',
    },
    {
      label: 'Vehículos dentro ahora',
      value: activeVehicles,
      sublabel: 'Vehículos actualmente estacionados',
      accent: 'amber',
      progress:
        occupancy.totalSpaces ? Math.min(100, Math.round((activeVehicles / occupancy.totalSpaces) * 100)) : 0,
      icon: 'directions_car',
    },
    {
      label: 'Ingresos del día',
      value: formatCompactMoney(todayIncome),
      sublabel: 'Cobros completados hoy',
      accent: 'violet',
      progress: occupancy.occupancyPercentage,
      icon: 'payments',
    },
    {
      label: 'Planes mensuales',
      value: Number(stats.monthlyPlansActive || 0),
      sublabel: 'Planes activos configurados',
      accent: 'cyan',
      progress: Math.min(100, Number(stats.monthlyPlansActive || 0) * 10),
      icon: 'calendar_month',
    },
    {
      label: 'Pagos pendientes',
      value: Number(stats.monthlyPlansPending || 0),
      sublabel: `${Number(stats.monthlyPlansOverdue || 0)} vencidos`,
      accent: 'amber',
      progress: Math.min(100, Number(stats.monthlyPlansPending || 0) * 10),
      icon: 'warning',
    },
  ]

  const handleRefresh = async () => {
    await Promise.all([
      statsApi.execute(),
      spacesApi.execute(),
      vehiclesApi.execute(),
      activeSessionsApi.execute(),
    ]).catch(() => null)
    setLastUpdate(new Date())
  }

  return (
    <>
      <div className="dashboard-pro">
        <section className="dashboard-pro__hero">
          {/* Fila superior: botones */}
          <div className="dashboard-pro__hero-top">

            {/* Botones lado derecho superior */}
            <div className="dashboard-pro__hero-actions">
              <button type="button" className="dashboard-pro__primary-btn" onClick={() => setIsEntryOpen(true)}>
                <span className="material-symbols-outlined">add</span>
                Nueva Entrada
              </button>

              <style>{`.sp-bell-fix .module-icon-btn{width:42px!important;height:42px!important;min-width:42px!important;min-height:42px!important;padding:0!important;border-radius:10px!important;background:var(--surface, #1e293b)!important;border:1px solid rgba(90,202,249,0.10)!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;font-size:20px!important}`}</style>
              <div className="sp-bell-fix">
                <NotificationsBell />
              </div>

              <button
                type="button"
                className="dashboard-pro__icon-btn"
                onClick={handleRefresh}
                title="Actualizar dashboard"
                aria-label="Actualizar dashboard"
              >
                <span className="material-symbols-outlined">refresh</span>
              </button>

              <button
                type="button"
                className="dashboard-pro__icon-btn"
                onClick={() => alert('Ayuda del Dashboard: Supervisa la ocupación y movimientos en tiempo real.')}
                title="Ayuda"
                aria-label="Ayuda"
              >
                <span className="material-symbols-outlined">help</span>
              </button>
            </div>
          </div>

          {/* Título más abajo */}
          <div className="dashboard-pro__hero-copy">
            <p className="dashboard-pro__eyebrow">Panel SmartPark</p>
            <h1>Dashboard</h1>
            <p>
              Supervisa la ocupación, los movimientos y los ingresos del garaje en tiempo real.
            </p>
          </div>
        </section>

        {topError && (
          <div className="dashboard-pro__banner dashboard-pro__banner--error">
            <div>
              <strong>Hay servicios pendientes por responder.</strong>
              <p>{topError}</p>
            </div>
            <button type="button" className="dashboard-pro__link-btn" onClick={handleRefresh}>
              Actualizar
            </button>
          </div>
        )}

        <section className="dashboard-pro__metrics">
          {metricCards.map((card) => (
            <article key={card.label} className={`dashboard-pro__metric dashboard-pro__metric--${card.accent}`}>
              <div className="dashboard-pro__metric-top">
                <div>
                  <span className="dashboard-pro__metric-label">{card.label}</span>
                  <strong className="dashboard-pro__metric-value">
                    {card.value}
                  </strong>
                </div>
                <span className="dashboard-pro__metric-icon material-symbols-outlined">{card.icon}</span>
              </div>

              <div className="dashboard-pro__metric-progress">
                <span style={{ width: `${Math.max(8, card.progress)}%` }} />
              </div>
              <p className="dashboard-pro__metric-sub">{card.sublabel}</p>
            </article>
          ))}
        </section>

        <section className="dashboard-pro__content">
          <div className="dashboard-pro__main">
            <article className="dashboard-pro__panel">
              <div className="dashboard-pro__panel-head">
                <div>
                  <p className="dashboard-pro__eyebrow">Actividad</p>
                  <h2>Flujo reciente de vehículos</h2>
                </div>
                <button type="button" className="dashboard-pro__link-btn" onClick={handleRefresh}>
                  Ver actualizado
                </button>
              </div>

              <div className="dashboard-pro__table">
                <div className="dashboard-pro__table-head">
                  <span>Vehículo</span>
                  <span>Propietario</span>
                  <span>Movimiento</span>
                  <span>Hora</span>
                </div>

                {recentActivity.length ? (
                  recentActivity.map((item) => (
                    <div key={item.id} className="dashboard-pro__table-row">
                      <div className="dashboard-pro__vehicle-cell">
                        <div className="dashboard-pro__vehicle-avatar">{item.plate.slice(0, 2)}</div>
                        <div>
                          <strong>{item.plate}</strong>
                          <small>{item.detail}</small>
                        </div>
                      </div>

                      <span>{item.owner}</span>
                      <span className={`dashboard-pro__badge dashboard-pro__badge--${item.badgeClass}`}>
                        {item.type}
                      </span>
                      <span>{item.time}</span>
                    </div>
                  ))
                ) : (
                  <div className="dashboard-pro__empty">
                    <span className="material-symbols-outlined">timeline</span>
                    <p>No hay actividad reciente disponible todavía.</p>
                  </div>
                )}
              </div>
            </article>

            <article className="dashboard-pro__panel">
              <div className="dashboard-pro__panel-head">
                <div>
                  <p className="dashboard-pro__eyebrow">Rendimiento</p>
                  <h2>Tendencia semanal de ingresos</h2>
                </div>
                <strong className="dashboard-pro__panel-highlight">{formatMoney(todayIncome)}</strong>
              </div>

              <div className="dashboard-pro__chart">
                {revenueTrend.map((item) => (
                  <div key={item.label} className="dashboard-pro__chart-col" title={`${item.label}: ${formatMoney(item.value)}`}>
                    <div className={`dashboard-pro__chart-bar${item.active ? ' active' : ''}`} style={{ height: `${item.height}%` }}>
                      <span style={{ fontSize: '10px', color: '#fff', position: 'absolute', top: '-18px', left: '50%', transform: 'translateX(-50%)' }}>
                        {item.value > 0 ? `$${Math.round(item.value)}` : ''}
                      </span>
                    </div>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <aside className="dashboard-pro__side">
            <article className="dashboard-pro__panel">
              <div className="dashboard-pro__panel-head dashboard-pro__panel-head--stack">
                <div>
                  <p className="dashboard-pro__eyebrow">Mapa operativo</p>
                  <h2>Disponibilidad por piso</h2>
                </div>
                <div className="dashboard-pro__tabs">
                  {floors.map((floor) => (
                    <button
                      key={floor}
                      type="button"
                      className={`dashboard-pro__tab${floor === activeFloor ? ' is-active' : ''}`}
                      onClick={() => setActiveFloor(floor)}
                    >
                      {floor}
                    </button>
                  ))}
                </div>
              </div>

              <div className="dashboard-pro__map-grid">
                {activeFloorSpaces.length ? (
                  activeFloorSpaces.map((space) => (
                    <div
                      key={space.id || getSpaceCode(space)}
                      className={`dashboard-pro__space dashboard-pro__space--${getSpaceStatus(space)}`}
                    >
                      <strong>{getSpaceCode(space)}</strong>
                      <span>{getSpaceStatus(space) === 'occupied' ? 'Ocupado' : 'Libre'}</span>
                    </div>
                  ))
                ) : (
                  <div className="dashboard-pro__empty dashboard-pro__empty--map">
                    <span className="material-symbols-outlined">grid_view</span>
                    <p>No hay espacios cargados para este piso.</p>
                  </div>
                )}
              </div>

              <div className="dashboard-pro__legend">
                <span>
                  <i className="is-occupied" />
                  Ocupado
                </span>
                <span>
                  <i className="is-available" />
                  Disponible
                </span>
              </div>
            </article>

            <article className="dashboard-pro__panel">
              <div className="dashboard-pro__panel-head">
                <div>
                  <p className="dashboard-pro__eyebrow">Pisos</p>
                  <h2>Estado por nivel</h2>
                </div>
              </div>

              <div className="dashboard-pro__floors">
                {floorStats.map((floor) => (
                  <div key={floor.floor} className="dashboard-pro__floor-row">
                    <div>
                      <strong>Piso {floor.floor}</strong>
                      <small>
                        {floor.occupied} ocupados - {floor.available} libres
                      </small>
                    </div>
                    <span>{formatPercent(floor.percentage)}</span>
                  </div>
                ))}
              </div>
            </article>
          </aside>
        </section>
      </div>

      <ModalEntry
        isOpen={isEntryOpen}
        onClose={() => setIsEntryOpen(false)}
        onSuccess={async () => {
          await handleRefresh()
        }}
      />
    </>
  )
}

