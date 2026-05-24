import { Suspense, lazy, useEffect, useMemo, useState } from 'react'

import NotificationsBell from '../components/NotificationsBell'
import { apiGet, getCachedApiData } from '../lib/api'

const ModalEntry = lazy(() => import('../components/ModalEntry'))

const formatSince = (value) => {
  if (!value) return 'Sin hora registrada'
  const start = new Date(value)
  if (Number.isNaN(start.getTime())) return 'Sin hora registrada'
  const totalMinutes = Math.max(0, Math.floor((Date.now() - start.getTime()) / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}h ${String(minutes).padStart(2, '0')}m`
}

const formatCurrency = (value) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 2 }).format(Number(value || 0))

const calculateCost = (value, hourlyRate) => {
  if (!value) return 'RD$ 0.00'
  const start = new Date(value)
  if (Number.isNaN(start.getTime())) return 'RD$ 0.00'
  const totalMinutes = Math.max(0, Math.floor((Date.now() - start.getTime()) / 60000))
  const billedHours = Math.max(1, Math.ceil(totalMinutes / 60))
  return formatCurrency(billedHours * Number(hourlyRate || 0))
}

const normalizeSpace = (space = {}) => ({
  id: space.id,
  nombre: space.nombre || space.numero_mostrar || space.codigo || '',
  tipo: space.tipo || space.nivel_mostrar || '',
  estado: space.estado || (space.ocupado ? 'ocupado' : 'disponible'),
  ocupado: Boolean(space.ocupado) || String(space.estado || '').toLowerCase() === 'ocupado',
})

const normalizeVehicle = (vehicle = {}) => ({
  id: vehicle.id,
  placa: vehicle.placa || '',
  modelo: vehicle.modelo || vehicle.model || '',
  color: vehicle.color || '',
  propietario: vehicle.propietario || vehicle.owner || '',
  spaceId: vehicle.espacio_id || vehicle.space_id || '',
  status: vehicle.status || vehicle.estado || '',
  horaEntrada: vehicle.entry_time || vehicle.hora_entrada || null,
})

const buildOccupancyData = (spacesPayload, vehiclesPayload) => {
  const allSpaces = Array.isArray(spacesPayload?.data) ? spacesPayload.data.map(normalizeSpace) : []
  const activeVehicles = (Array.isArray(vehiclesPayload?.data) ? vehiclesPayload.data : [])
    .map(normalizeVehicle)
    .filter((v) => v.status === 'dentro' && v.spaceId)
  const occupancy = new Map()
  activeVehicles.forEach((v) => occupancy.set(String(v.spaceId), v))
  const mergedSpaces = allSpaces.map((space) => {
    const ocupado = occupancy.has(String(space.id)) || space.ocupado
    return { ...space, ocupado, estado: ocupado ? 'ocupado' : 'disponible' }
  })
  return { mergedSpaces, occupancy }
}

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
  page: { width: '100%', maxWidth: 1440, margin: '0 auto', fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" },
  topbar: { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginBottom: 0 },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: C.textSoft, marginBottom: 2 },
  breadcrumbAccent: { color: C.accent },
  pageSub: { margin: '4px 0 14px', color: C.textSoft, fontSize: '0.9rem' },
  statsBar: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 },
  statPill: (accent) => ({ background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${accent}`, borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }),
  statIco: (accent) => ({ width: 36, height: 36, borderRadius: 9, background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent, fontSize: 18, flexShrink: 0 }),
  statVal: { fontSize: 22, fontWeight: 800, lineHeight: 1 },
  statLbl: { fontSize: 11, color: C.textSoft, marginTop: 2 },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' },
  cardsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 },
  ocupadoCard: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardSpaceBadge: { background: 'rgba(9,131,200,0.18)', color: C.accent, fontWeight: 800, fontSize: 13, borderRadius: 7, padding: '4px 10px', letterSpacing: '0.03em' },
  cardTime: { fontSize: 11, color: C.textSoft, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 },
  cardVehicle: { display: 'flex', alignItems: 'center', gap: 10, background: C.cardDeep, borderRadius: 10, padding: '10px 12px' },
  cardVehicleIco: { width: 34, height: 34, borderRadius: 8, background: 'rgba(9,131,200,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.accent, fontSize: 20, flexShrink: 0 },
  cardPlaca: { fontSize: 14, fontWeight: 800, color: '#fff', lineHeight: 1 },
  cardDetalle: { fontSize: 11, color: C.textSoft, marginTop: 2 },
  cardInfo: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  infoItem: { background: C.cardDeep, borderRadius: 8, padding: '8px 10px' },
  infoLabel: { fontSize: 10, color: C.textSoft, marginBottom: 2 },
  infoVal: { fontSize: 12, fontWeight: 700, color: '#fff' },
  costBadge: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: `1px solid ${C.border}` },
  costLabel: { fontSize: 10, color: C.textSoft, marginBottom: 2 },
  costVal: { fontSize: 16, fontWeight: 800, color: C.success },
  emptyCard: { gridColumn: '1 / -1', background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '48px 24px', textAlign: 'center', color: C.textSoft, fontSize: 14 },
  skeleton: { borderRadius: 10, background: 'linear-gradient(90deg,#041f3a 0%,#0a3460 50%,#041f3a 100%)', backgroundSize: '200% 100%', animation: 'shimmer 1.25s linear infinite' },
  sideCard: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', marginBottom: 14 },
  sideCardHead: { display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: `1px solid ${C.border}` },
  sideCardIco: { width: 32, height: 32, borderRadius: 8, background: 'rgba(9,131,200,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.accent, fontSize: 17, flexShrink: 0 },
  sideCardTitle: { fontSize: 14, fontWeight: 700, color: '#fff', margin: 0 },
  sideCardBody: { padding: '14px 18px' },
  tarifaRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.border}`, fontSize: 13 },
  tarifaLabel: { color: C.textSoft },
  tarifaVal: { color: '#fff', fontWeight: 800 },
  tarifaNote: { fontSize: 11, color: C.textSoft, marginTop: 10, lineHeight: 1.5 },
  floorTabs: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 },
  floorTab: (active) => ({ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, border: `1px solid ${active ? 'rgba(9,131,200,0.5)' : C.border}`, background: active ? 'rgba(9,131,200,0.2)' : 'transparent', color: active ? C.accent : C.textSoft, cursor: 'pointer', fontFamily: 'inherit' }),
  miniMap: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))', gap: 6, marginBottom: 12 },
  miniSlot: (ocupado) => ({ height: 40, borderRadius: 6, border: `1px solid ${ocupado ? 'rgba(248,81,73,0.4)' : 'rgba(63,185,80,0.35)'}`, background: ocupado ? 'rgba(248,81,73,0.12)' : 'rgba(63,185,80,0.10)', color: ocupado ? C.danger : C.success, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, letterSpacing: '0.03em' }),
  miniEmpty: { fontSize: 12, color: C.textSoft, textAlign: 'center', padding: '16px 0' },
  legend: { display: 'flex', gap: 14, fontSize: 11, color: C.textSoft },
  legendDot: (color) => ({ width: 9, height: 9, borderRadius: 3, background: color, display: 'inline-block', marginRight: 5 }),
  feedbackError: { borderRadius: 12, padding: '12px 16px', marginBottom: 16, background: 'rgba(110,16,16,0.28)', border: '1px solid rgba(248,81,73,0.45)', color: '#ffb4b1', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 },
  filterBar: { display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  filterTab: (active) => ({ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, border: `1px solid ${active ? 'rgba(9,131,200,0.5)' : C.border}`, background: active ? 'rgba(9,131,200,0.2)' : C.card, color: active ? C.accent : C.textSoft, cursor: 'pointer', fontFamily: 'inherit' }),
  activeBadge: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(63,185,80,0.12)', color: '#3fb950', border: '1px solid rgba(63,185,80,0.3)' },
  activeDot: { width: 6, height: 6, borderRadius: '50%', background: '#3fb950', animation: 'pulse 1.5s infinite' },
}

const Icon = ({ name, size = 18 }) => (
  <span className="material-symbols-outlined" style={{ fontSize: size, verticalAlign: 'middle', lineHeight: 1, flexShrink: 0 }}>
    {name}
  </span>
)

export default function OccupiedSpaces() {
  const cachedSpaces   = getCachedApiData('/api/parking-spaces')
  const cachedVehicles = getCachedApiData('/api/vehiculos')
  const cachedSettings = getCachedApiData('/api/auth/settings')
  const cachedOccupancyData = cachedSpaces && cachedVehicles ? buildOccupancyData(cachedSpaces, cachedVehicles) : null

  const [spaces, setSpaces]                   = useState(cachedOccupancyData?.mergedSpaces || [])
  const [occupancyBySpace, setOccupancyBySpace] = useState(cachedOccupancyData?.occupancy || new Map())
  const [hourlyRate, setHourlyRate] = useState(() => Number(cachedSettings?.data?.hourly_rate || 50) || 50)
  const [loading, setLoading]   = useState(!cachedOccupancyData)
  const [error, setError]       = useState(null)
  const [nivelActivo, setNivelActivo] = useState('Todos')
  const [isEntryOpen, setIsEntryOpen] = useState(false)

  const loadData = async ({ showLoader = true, forceFresh = true } = {}) => {
    if (showLoader) setLoading(true)
    setError(null)
    try {
      const [sp, vp] = await Promise.all([
        apiGet('/api/parking-spaces', { forceFresh }),
        apiGet('/api/vehiculos', { forceFresh }),
      ])
      const { mergedSpaces, occupancy } = buildOccupancyData(sp, vp)
      setSpaces(mergedSpaces)
      setOccupancyBySpace(occupancy)
      apiGet('/api/auth/settings', { forceFresh })
        .then((settings) => setHourlyRate(Number(settings?.data?.hourly_rate || 50) || 50))
        .catch(() => null)
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los espacios.')
      setSpaces([])
      setOccupancyBySpace(new Map())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData({ showLoader: !cachedOccupancyData })
    const intervalId = window.setInterval(() => loadData({ showLoader: false, forceFresh: true }), 5000)
    const handleDataRefresh = () => loadData({ showLoader: false, forceFresh: true })
    const handleOpenEntry   = () => setIsEntryOpen(true)
    window.addEventListener('smartpark:data-refresh', handleDataRefresh)
    window.addEventListener('smartpark:open-entry-modal', handleOpenEntry)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('smartpark:data-refresh', handleDataRefresh)
      window.removeEventListener('smartpark:open-entry-modal', handleOpenEntry)
    }
  }, [])

  const cards = useMemo(() =>
    spaces
      .filter((sp) => sp.ocupado)
      .map((sp) => {
        const v = occupancyBySpace.get(String(sp.id)) || {}
        return {
          id: v.id || sp.id,
          spaceId: sp.id,
          nombre: sp.nombre || 'Sin espacio',
          tipo: sp.tipo || '',
          placa: v.placa || 'Sin placa',
          modelo: v.modelo || 'Vehículo',
          color: v.color || '',
          propietario: v.propietario || 'Sin propietario',
          since: formatSince(v.horaEntrada),
          cost: calculateCost(v.horaEntrada, hourlyRate),
        }
      }),
    [occupancyBySpace, spaces, hourlyRate],
  )

  const niveles = useMemo(() => {
    const found = [...new Set(spaces.map((s) => s.tipo).filter(Boolean))].sort()
    return ['Todos', ...found]
  }, [spaces])

  const mapItems = useMemo(() =>
    spaces
      .filter((s) => nivelActivo === 'Todos' || s.tipo === nivelActivo)
      .map((s) => ({ id: s.id, nombre: s.nombre, ocupado: s.ocupado })),
    [spaces, nivelActivo],
  )

  const cardsFiltradas = useMemo(() =>
    nivelActivo === 'Todos' ? cards : cards.filter((c) => c.tipo === nivelActivo),
    [cards, nivelActivo],
  )

  const totalSpaces  = spaces.length
  const ocupados     = spaces.filter((s) => s.ocupado).length
  const libres       = totalSpaces - ocupados
  const pctOcupado   = totalSpaces > 0 ? Math.round((ocupados / totalSpaces) * 100) : 0

  return (
    <div style={s.page}>
      <style>{`
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      `}</style>

      {/* Topbar */}
      <div style={s.topbar}>
        <style>{`
          .sp-bell-fix .module-icon-btn {
            width:42px!important;height:42px!important;min-width:42px!important;min-height:42px!important;
            padding:0!important;border-radius:10px!important;background:${C.card}!important;
            border:1px solid rgba(90,202,249,0.10)!important;
            display:inline-flex!important;align-items:center!important;justify-content:center!important;font-size:20px!important;
          }
        `}</style>
        <button
          type="button"
          title="Asignar parqueo"
          onClick={() => setIsEntryOpen(true)}
          style={{ width: 42, height: 42, borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, color: C.textSoft, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <Icon name="add_circle" size={20} />
        </button>
        <div className="sp-bell-fix"><NotificationsBell /></div>
      </div>

      {/* Header */}
      <div style={s.breadcrumb}>
        SmartPark <span style={s.breadcrumbAccent}>/</span>
        <span style={s.breadcrumbAccent}>Espacios Ocupados</span>
      </div>
      <h1>Espacios Ocupados</h1>
      <p style={s.pageSub}>Visualiza los vehículos activos y el estado de los espacios en tiempo real.</p>

      {/* Stats */}
      {!loading && (
        <div style={s.statsBar}>
          {[
            { label: 'Total espacios',  value: totalSpaces,      icon: 'local_parking',  color: C.accent  },
            { label: 'Ocupados',        value: ocupados,         icon: 'directions_car', color: C.danger  },
            { label: 'Disponibles',     value: libres,           icon: 'check_circle',   color: C.success },
            { label: 'Tasa ocupación',  value: `${pctOcupado}%`, icon: 'percent',        color: C.warning },
          ].map(({ label, value, icon, color }) => (
            <div key={label} style={s.statPill(color)}>
              <div style={s.statIco(color)}><Icon name={icon} size={18} /></div>
              <div>
                <div style={{ ...s.statVal, color }}>{value}</div>
                <div style={s.statLbl}>{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={s.feedbackError}><Icon name="error" size={16} />{error}</div>
      )}

      {/* Two-column layout */}
      <div style={s.twoCol}>

        {/* LEFT: Cards */}
        <div>
          {!loading && niveles.length > 1 && (
            <div style={s.filterBar}>
              {niveles.map((n) => (
                <button key={n} type="button" style={s.filterTab(nivelActivo === n)} onClick={() => setNivelActivo(n)}>
                  {n === 'Todos' ? 'Todos los pisos' : `Piso ${n}`}
                </button>
              ))}
            </div>
          )}

          <div style={s.cardsGrid}>
            {loading && Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ ...s.skeleton, height: 180 }} />
            ))}

            {!loading && cardsFiltradas.length === 0 && (
              <div style={s.emptyCard}>
                <Icon name="directions_car" size={36} />
                <p style={{ margin: '12px 0 0', fontWeight: 600 }}>No hay espacios ocupados actualmente.</p>
                <p style={{ margin: '6px 0 0', fontSize: 12 }}>Los vehículos registrados aparecerán aquí.</p>
              </div>
            )}

            {!loading && cardsFiltradas.map((item) => (
              <article key={item.id} style={s.ocupadoCard}>
                {/* Top: space badge + active badge */}
                <div style={s.cardTop}>
                  <span style={s.cardSpaceBadge}>{item.nombre}</span>
                  <span style={s.activeBadge}>
                    <span style={s.activeDot} />Activo
                  </span>
                </div>

                {/* Vehicle info */}
                <div style={s.cardVehicle}>
                  <div style={s.cardVehicleIco}><Icon name="directions_car" size={20} /></div>
                  <div>
                    <div style={s.cardPlaca}>{item.placa}</div>
                    <div style={s.cardDetalle}>
                      {item.modelo}{item.color ? ` · ${item.color}` : ''}
                    </div>
                  </div>
                </div>

                {/* Detail grid */}
                <div style={s.cardInfo}>
                  <div style={s.infoItem}>
                    <div style={s.infoLabel}>Propietario</div>
                    <div style={s.infoVal}>{item.propietario}</div>
                  </div>
                  <div style={s.infoItem}>
                    <div style={s.infoLabel}>Tiempo</div>
                    <div style={s.infoVal}>{item.since}</div>
                  </div>
                </div>

                {/* Cost row — info only, no button */}
                <div style={s.costBadge}>
                  <div>
                    <div style={s.costLabel}>Costo estimado</div>
                    <div style={s.costVal}>{item.cost}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.textSoft }}>
                    <Icon name="schedule" size={13} />{item.since}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* RIGHT: Side panel */}
        <div>
          <div style={s.sideCard}>
            <div style={s.sideCardHead}>
              <div style={s.sideCardIco}><Icon name="payments" size={17} /></div>
              <h2 style={s.sideCardTitle}>Tarifas vigentes</h2>
            </div>
            <div style={s.sideCardBody}>
              {[['Tarifa por hora', `${formatCurrency(hourlyRate)}/hr`], ['Horas cobrables', 'Redondeo por hora iniciada']].map(([label, value], i, rows) => (
                <div key={label} style={{ ...s.tarifaRow, borderBottom: i === rows.length - 1 ? 'none' : `1px solid ${C.border}` }}>
                  <span style={s.tarifaLabel}>{label}</span>
                  <strong style={s.tarifaVal}>{value}</strong>
                </div>
              ))}
              <p style={s.tarifaNote}>* Misma tarifa usada en Cobros y al registrar la salida.</p>
            </div>
          </div>

          <div style={s.sideCard}>
            <div style={s.sideCardHead}>
              <div style={s.sideCardIco}><Icon name="map" size={17} /></div>
              <h2 style={s.sideCardTitle}>Mapa de planta</h2>
            </div>
            <div style={s.sideCardBody}>
              {niveles.length > 1 && (
                <div style={s.floorTabs}>
                  {niveles.map((n) => (
                    <button key={n} type="button" style={s.floorTab(nivelActivo === n)} onClick={() => setNivelActivo(n)}>
                      {n === 'Todos' ? 'Todos' : `Piso ${n}`}
                    </button>
                  ))}
                </div>
              )}
              {mapItems.length === 0 ? (
                <div style={s.miniEmpty}>No hay espacios registrados.</div>
              ) : (
                <div style={s.miniMap}>
                  {mapItems.map((item) => (
                    <div key={item.id} style={s.miniSlot(item.ocupado)} title={item.nombre}>
                      {item.nombre}
                    </div>
                  ))}
                </div>
              )}
              <div style={s.legend}>
                <span><span style={s.legendDot('rgba(248,81,73,0.8)')} />Ocupado</span>
                <span><span style={s.legendDot('rgba(63,185,80,0.8)')} />Disponible</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Suspense fallback={null}>
        <ModalEntry
          isOpen={isEntryOpen}
          onClose={() => setIsEntryOpen(false)}
          onSuccess={() => loadData({ showLoader: false, forceFresh: true })}
        />
      </Suspense>
    </div>
  )
}
