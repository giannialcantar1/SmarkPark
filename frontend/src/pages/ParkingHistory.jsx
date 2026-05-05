import { useEffect, useMemo, useState } from 'react'

import { apiGet, getCachedApiData } from '../lib/api'

const PAGE_SIZE = 8

const normalizeSpace = (space = {}) => ({
  id: String(space.id || ''),
  codigo: space.codigo || space.numero_mostrar || space.nombre || '',
})

const formatDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(date)
}

const formatMoney = (value) => {
  const amount = Number(value || 0)
  return new Intl.NumberFormat('es-DO', {
    style: 'currency', currency: 'DOP', maximumFractionDigits: 0,
  }).format(amount)
}

const formatDuration = (entrada, salida) => {
  if (!entrada) return '-'
  const start = new Date(entrada)
  const end = salida ? new Date(salida) : new Date()
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '-'
  const totalMinutes = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}h ${String(minutes).padStart(2, '0')}m`
}

const durationToMinutes = (value) => {
  const match = String(value || '').match(/(\d+)h\s*(\d+)m/)
  if (match) return Number(match[1]) * 60 + Number(match[2])
  const parts = String(value || '').split(':')
  if (parts.length >= 2) return Number(parts[0] || 0) * 60 + Number(parts[1] || 0)
  return 0
}

const buildHistorialRows = (vehiculosPayload, espaciosPayload, sesionesPayload = null) => {
  const sesiones = Array.isArray(sesionesPayload?.data) ? sesionesPayload.data : []
  const vehiculos = sesiones.length ? sesiones : Array.isArray(vehiculosPayload?.data) ? vehiculosPayload.data : []
  const espacios = Array.isArray(espaciosPayload?.data) ? espaciosPayload.data.map(normalizeSpace) : []
  const espaciosMap = new Map(espacios.map((s) => [String(s.id), s.codigo || String(s.id).slice(0, 8)]))

  return vehiculos
    .map((item) => {
      const activo = String(item.status || item.estado || '').toLowerCase() === 'dentro'
      const fechaReferencia = item.hora_salida || item.hora_entrada || item.created_at
      const rawUbicacion = item.espacio || item.espacio_id || item.space_id || ''
      const ubicacion =
        espaciosMap.get(String(rawUbicacion)) ||
        (rawUbicacion ? String(rawUbicacion).slice(0, 8) : 'Sin espacio')

      return {
        id: item.id || item.session_id || `${item.placa}-${fechaReferencia || Date.now()}`,
        fechaRaw: fechaReferencia,
        fecha: formatDateTime(fechaReferencia),
        ubicacion,
        vehiculo: item.modelo ? `${item.modelo}` : item.placa || 'Sin placa',
        placa: item.placa || '',
        duracion: formatDuration(item.hora_entrada || item.entry_time, item.hora_salida || item.exit_time),
        costo: item.hora_salida || item.exit_time ? formatMoney(item.monto_total || item.total_amount) : 'Pendiente',
        estado: activo ? 'En curso' : 'Completado',
        activo,
      }
    })
    .sort((a, b) => new Date(b.fechaRaw || 0) - new Date(a.fechaRaw || 0))
}

/* --- Palette --- */
const C = {
  bg:        'var(--bg)',
  card:      'var(--surface)',
  cardDeep:  'var(--surface2)',
  primary:   'var(--accent)',
  accent:    'var(--accent2)',
  textSoft:  'var(--text-dim)',
  border:    'var(--border)',
  borderMid: 'rgba(90,202,249,0.20)',
  success:   '#3fb950',
  danger:    '#f85149',
  warning:   'var(--accent)',
}

const s = {
  page: {
    width: '100%',
    maxWidth: 1440,
    margin: '0 auto',
    fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
  },

  /* header */
  breadcrumb: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 14, fontWeight: 600, color: C.textSoft, marginBottom: 4,
  },
  breadcrumbAccent: { color: C.accent },
  pageTitle: {
    margin: 0,
    fontSize: 'clamp(2rem,4.5vw,3.4rem)',
    fontWeight: 800, fontFamily: "'Syne', sans-serif", background: 'linear-gradient(135deg, #e2e8f0 30%, var(--accent) 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
    lineHeight: 1.05, letterSpacing: '-0.5px',
  },
  pageSub: { margin: '6px 0 20px', color: C.textSoft, fontSize: '1rem' },

  /* stats */
  statsBar: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
    marginBottom: 20,
  },
  statCard: (accent) => ({
    background: C.card,
    border: `1px solid ${C.border}`,
    borderLeft: `3px solid ${accent}`,
    borderRadius: 14,
    padding: '18px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  }),
  statIco: (accent) => ({
    width: 40, height: 40, borderRadius: 10,
    background: `${accent}18`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: accent, fontSize: 20, flexShrink: 0,
  }),
  statLabel: {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
    color: C.textSoft, textTransform: 'uppercase', marginBottom: 6,
  },
  statValue: {
    fontSize: 26, fontWeight: 800, fontFamily: "'Syne', sans-serif", background: 'linear-gradient(135deg, #e2e8f0 30%, var(--accent) 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
    lineHeight: 1, letterSpacing: '-0.5px',
  },
  statSub: { fontSize: 11, color: C.textSoft, marginTop: 4 },

  /* error */
  errorBox: {
    borderRadius: 12, padding: '12px 16px', marginBottom: 16,
    background: 'rgba(110,16,16,0.28)', border: '1px solid rgba(248,81,73,0.45)',
    color: '#ffb4b1', fontWeight: 600, fontSize: 13,
    display: 'flex', alignItems: 'center', gap: 8,
  },

  /* table card */
  tableCard: {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 16,
    overflow: 'hidden',
  },
  tableHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 24px',
    borderBottom: `1px solid ${C.border}`,
  },
  tableTitle: { fontSize: 14, fontWeight: 700, color: '#fff', margin: 0 },
  tableSub: { fontSize: 12, color: C.textSoft, marginTop: 2 },
  tableCount: {
    fontSize: 12, color: C.textSoft,
    background: C.cardDeep,
    border: `1px solid ${C.border}`,
    borderRadius: 20,
    padding: '4px 12px',
    fontWeight: 600,
  },

  /* search bar */
  searchBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 24px',
    borderBottom: `1px solid ${C.border}`,
  },
  searchInput: {
    flex: 1,
    background: C.cardDeep,
    border: `1px solid ${C.borderMid}`,
    borderRadius: 8,
    color: '#fff',
    padding: '8px 14px 8px 36px',
    fontSize: 13,
    outline: 'none',
    fontFamily: 'inherit',
  },
  searchIcon: {
    position: 'absolute',
    left: 12, top: '50%', transform: 'translateY(-50%)',
    color: C.textSoft, fontSize: 16, pointerEvents: 'none',
  },

  /* col headers */
  colHeader: {
    display: 'grid',
    gridTemplateColumns: '1.6fr 1fr 1.4fr 1fr 1fr 1fr',
    gap: 0,
    padding: '10px 24px',
    background: 'rgba(5,32,62,0.6)',
    borderBottom: `1px solid ${C.border}`,
  },
  colTh: {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
    color: C.textSoft, textTransform: 'uppercase',
  },

  /* row */
  tableRow: (hover) => ({
    display: 'grid',
    gridTemplateColumns: '1.6fr 1fr 1.4fr 1fr 1fr 1fr',
    gap: 0,
    padding: '14px 24px',
    borderBottom: `1px solid rgba(90,202,249,0.05)`,
    alignItems: 'center',
    background: hover ? 'rgba(9,131,200,0.04)' : 'transparent',
    transition: 'background 0.15s',
    cursor: 'default',
  }),
  tdDate: { fontSize: 12, color: C.textSoft },
  tdLocation: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    fontSize: 12, fontWeight: 600, color: '#fff',
  },
  vehicleBlock: { display: 'flex', alignItems: 'center', gap: 8 },
  plateBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 6,
    fontSize: 10, fontWeight: 700,
    background: 'rgba(9,131,200,0.15)',
    color: C.accent,
    border: `1px solid rgba(9,131,200,0.28)`,
    letterSpacing: '0.05em',
    flexShrink: 0,
  },
  vehicleModel: { fontSize: 12, fontWeight: 600, color: '#fff' },
  tdDuration: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    fontSize: 12, color: C.textSoft,
  },
  tdCost: { fontSize: 13, fontWeight: 700, color: '#fff' },
  pendingCost: { fontSize: 12, color: C.accent, fontWeight: 600 },

  badge: (activo) => ({
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '3px 10px',
    borderRadius: 20,
    fontSize: 11, fontWeight: 700,
    background: activo ? 'rgba(90,202,249,0.12)' : 'rgba(63,185,80,0.12)',
    color: activo ? C.accent : C.success,
    border: `1px solid ${activo ? 'rgba(90,202,249,0.3)' : 'rgba(63,185,80,0.3)'}`,
  }),
  badgeDot: (activo) => ({
    width: 6, height: 6, borderRadius: '50%',
    background: activo ? C.accent : C.success,
    animation: activo ? 'pulse 1.5s infinite' : 'none',
  }),

  /* empty */
  empty: {
    padding: '52px 24px',
    textAlign: 'center',
    color: C.textSoft,
  },
  emptyIco: {
    width: 48, height: 48, borderRadius: 12,
    background: 'rgba(9,131,200,0.1)',
    border: `1px solid rgba(9,131,200,0.2)`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 12px', color: C.accent, fontSize: 24,
  },

  /* footer / pagination */
  tableFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 24px',
    borderTop: `1px solid ${C.border}`,
    gap: 12,
    flexWrap: 'wrap',
  },
  footerInfo: { fontSize: 12, color: C.textSoft },
  pagination: { display: 'flex', gap: 6, alignItems: 'center' },
  pageBtn: (active, disabled) => ({
    minWidth: 34, height: 34,
    padding: '0 10px',
    borderRadius: 8,
    background: active ? C.primary : C.cardDeep,
    color: active ? '#fff' : C.textSoft,
    border: `1px solid ${active ? 'rgba(9,131,200,0.5)' : C.border}`,
    fontWeight: 700, fontSize: 12,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }),

  skeleton: {
    borderRadius: 10,
    background: 'linear-gradient(90deg,#041f3a 0%,#0a3460 50%,#041f3a 100%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.25s linear infinite',
  },
}

const Icon = ({ name, size = 16 }) => (
  <span className="material-symbols-outlined"
    style={{ fontSize: size, verticalAlign: 'middle', lineHeight: 1, flexShrink: 0 }}>
    {name}
  </span>
)

export default function HistorialParqueos() {
  const cachedVehiculos = getCachedApiData('/api/vehiculos')
  const cachedSpaces = getCachedApiData('/api/parking-spaces')
  const cachedSessions = getCachedApiData('/api/parking-sessions')
  const hasCachedData = Boolean((cachedSessions || cachedVehiculos) && cachedSpaces)

  const [rows, setRows] = useState(() =>
    hasCachedData ? buildHistorialRows(cachedVehiculos, cachedSpaces, cachedSessions) : [],
  )
  const [loading, setLoading] = useState(() => !hasCachedData)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [hoveredRow, setHoveredRow] = useState(null)

  useEffect(() => {
    const load = async ({ showLoader = true } = {}) => {
      if (showLoader) setLoading(true)
      setError(null)
      try {
        const [vp, ep, sp] = await Promise.all([
          apiGet('/api/vehiculos'),
          apiGet('/api/parking-spaces'),
          apiGet('/api/parking-sessions'),
        ])
        setRows(buildHistorialRows(vp, ep, sp))
      } catch (err) {
        setError(err.message || 'No se pudo cargar el historial.')
      } finally {
        setLoading(false)
      }
    }
    load({ showLoader: !hasCachedData })
  }, [])

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter((r) =>
      r.vehiculo.toLowerCase().includes(q) ||
      r.placa.toLowerCase().includes(q) ||
      r.ubicacion.toLowerCase().includes(q) ||
      r.estado.toLowerCase().includes(q),
    )
  }, [rows, search])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages))
  }, [totalPages])

  useEffect(() => { setPage(1) }, [search])

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredRows.slice(start, start + PAGE_SIZE)
  }, [page, filteredRows])

  const summary = useMemo(() => {
    const total = rows.length
    const totalGastado = rows.reduce((sum, r) => {
      if (r.costo === 'Pendiente') return sum
      return sum + Number(String(r.costo).replace(/[^\d.-]/g, '') || 0)
    }, 0)
    const totalMinutes = rows.reduce((sum, r) => sum + durationToMinutes(r.duracion), 0)
    const avg = total ? Math.round(totalMinutes / total) : 0
    return {
      total,
      totalGastado: formatMoney(totalGastado),
      duracionPromedio: `${Math.floor(avg / 60)}h ${String(avg % 60).padStart(2, '0')}m`,
      enCurso: rows.filter((r) => r.activo).length,
    }
  }, [rows])

  const visibleStart = filteredRows.length ? (page - 1) * PAGE_SIZE + 1 : 0
  const visibleEnd = Math.min(page * PAGE_SIZE, filteredRows.length)

  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages = new Set([1, totalPages, page, page - 1, page + 1].filter((p) => p >= 1 && p <= totalPages))
    return [...pages].sort((a, b) => a - b)
  }, [page, totalPages])

  return (
    <div style={s.page}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      `}</style>

      {/* -- Header -- */}
      <div style={s.breadcrumb}>
        SmartPark
        <span style={s.breadcrumbAccent}>/</span>
        <span style={s.breadcrumbAccent}>Historial de Parqueos</span>
      </div>
      <h1>Historial de Parqueos</h1>
      <p style={s.pageSub}>Consulta el registro detallado de entradas y salidas.</p>

      {/* -- Stats -- */}
      <div style={s.statsBar}>
        {[
          { label: 'Total sesiones',    value: summary.total,            icon: 'history',       accent: C.accent   },
          { label: 'Total recaudado',   value: summary.totalGastado,     icon: 'payments',      accent: C.success  },
          { label: 'Duración promedio', value: summary.duracionPromedio, icon: 'avg_pace',      accent: C.primary  },
        ].map(({ label, value, icon, accent }) => (
          <div key={label} style={s.statCard(accent)}>
            <div style={s.statIco(accent)}><Icon name={icon} size={20} /></div>
            <div>
              <div style={s.statLabel}>{label}</div>
              <div style={{ ...s.statValue, color: accent === C.accent ? '#fff' : accent }}>{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* -- Error -- */}
      {error && (
        <div style={s.errorBox}>
          <Icon name="error" size={16} />{error}
        </div>
      )}

      {/* -- Table card -- */}
      <div style={s.tableCard}>

        {/* card header */}
        <div style={s.tableHead}>
          <div>
            <h2 style={s.tableTitle}>Registro de movimientos</h2>
            <p style={s.tableSub}>Entradas y salidas ordenadas por fecha</p>
          </div>
          <span style={s.tableCount}>{filteredRows.length} registros</span>
        </div>

        {/* search */}
        <div style={s.searchBar}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={s.searchIcon} className="material-symbols-outlined">search</span>
            <input
              type="text"
              placeholder="Buscar por placa, vehículo, ubicación..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={s.searchInput}
            />
          </div>
        </div>

        {/* col headers */}
        <div style={s.colHeader}>
          {['Fecha', 'Ubicación', 'Vehículo', 'Duración', 'Costo', 'Estado'].map((h) => (
            <span key={h} style={s.colTh}>{h}</span>
          ))}
        </div>

        {/* skeleton */}
        {loading && (
          <div style={{ padding: '16px 24px', display: 'grid', gap: 10 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ ...s.skeleton, height: 48 }} />
            ))}
          </div>
        )}

        {/* empty */}
        {!loading && paginatedRows.length === 0 && (
          <div style={s.empty}>
            <div style={s.emptyIco}><Icon name="history" size={22} /></div>
            <div style={{ fontWeight: 600, color: '#fff', marginBottom: 4 }}>
              {search ? 'No se encontraron resultados' : 'No hay registros disponibles'}
            </div>
            <div style={{ fontSize: 12 }}>
              {search ? 'Intenta con otra búsqueda.' : 'Los movimientos aparecerán aquí una vez registrados.'}
            </div>
          </div>
        )}

        {/* rows */}
        {!loading && paginatedRows.map((item) => (
          <div
            key={item.id}
            style={s.tableRow(hoveredRow === item.id)}
            onMouseEnter={() => setHoveredRow(item.id)}
            onMouseLeave={() => setHoveredRow(null)}
          >
            {/* Fecha */}
            <span style={s.tdDate}>{item.fecha}</span>

            {/* Ubicación */}
            <span style={s.tdLocation}>
              <Icon name="location_on" size={13} />
              {item.ubicacion}
            </span>

            {/* Vehículo */}
            <div style={s.vehicleBlock}>
              {item.placa && <span style={s.plateBadge}>{item.placa.slice(0, 7)}</span>}
              <span style={s.vehicleModel}>{item.vehiculo}</span>
            </div>

            {/* Duración */}
            <span style={s.tdDuration}>
              <Icon name="schedule" size={13} />
              {item.duracion}
            </span>

            {/* Costo */}
            <span style={item.costo === 'Pendiente' ? s.pendingCost : s.tdCost}>
              {item.costo}
            </span>

            {/* Estado */}
            <span style={s.badge(item.activo)}>
              <span style={s.badgeDot(item.activo)} />
              {item.estado}
            </span>
          </div>
        ))}

        {/* footer */}
        <div style={s.tableFooter}>
          <span style={s.footerInfo}>
            {filteredRows.length === 0
              ? 'Sin resultados'
              : `Mostrando ${visibleStart}-${visibleEnd} de ${filteredRows.length}`}
          </span>

          <div style={s.pagination}>
            <button
              type="button"
              style={s.pageBtn(false, page === 1)}
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <Icon name="chevron_left" size={16} />
            </button>

            {pageNumbers.map((num, idx) => {
              const prev = pageNumbers[idx - 1]
              return (
                <span key={num} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {prev && num - prev > 1 && (
                    <span style={{ color: C.textSoft, fontSize: 12, padding: '0 2px' }}>...</span>
                  )}
                  <button
                    type="button"
                    style={s.pageBtn(page === num, false)}
                    onClick={() => setPage(num)}
                  >
                    {num}
                  </button>
                </span>
              )
            })}

            <button
              type="button"
              style={s.pageBtn(false, page === totalPages)}
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <Icon name="chevron_right" size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}





