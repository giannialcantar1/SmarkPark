import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import ModalEntry from '../components/ModalEntry'
import ModalExit from '../components/ModalExit'
import { apiGet, getCachedApiData } from '../lib/api'
import { DEFAULT_FLOORS, buildFloorIndex, getSpaceFloor } from '../lib/floors'

/* --- helpers ----------------------------------------------- */
function toDate(value) {
  if (!value) return null
  const date = new Date(String(value).replace('Z', '+00:00'))
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDateTime(value) {
  const date = toDate(value)
  if (!date) return '-'
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatDuration(entryDate) {
  if (!entryDate) return '--'
  const now = new Date()
  const diffMs = now - entryDate
  if (diffMs < 0) return '--'
  const totalMins = Math.floor(diffMs / 60000)
  const hrs = Math.floor(totalMins / 60)
  const mins = totalMins % 60
  if (hrs === 0) return `${mins}m`
  return `${hrs}h ${mins}m`
}

function normalizeSpace(space = {}) {
  return {
    ...space,
    id: String(space.id || ''),
    estado: String(space.estado || '').toLowerCase(),
    nivel: getSpaceFloor(space),
    label: space.numero_mostrar || space.codigo || space.nombre || 'Sin codigo',
  }
}

function normalizeVehicle(vehicle = {}, index = 0) {
  const entryDate = toDate(vehicle.hora_entrada || vehicle.entry_time || vehicle.created_at)
  return {
    id: vehicle.id ?? `${vehicle.placa ?? 'vehiculo'}-${index}`,
    placa: vehicle.placa || 'Sin placa',
    modelo: vehicle.modelo || 'Vehiculo',
    propietario: vehicle.propietario || vehicle.owner || 'Sin propietario',
    espacioId: String(vehicle.espacio_id || vehicle.space_id || ''),
    espacioRaw: vehicle.espacio || vehicle.space_label || vehicle.ubicacion || '',
    fechaEntrada: entryDate,
    fechaEntradaLabel: formatDateTime(entryDate),
    costo: vehicle.costo ?? vehicle.cost ?? null,
    estado: vehicle.estado_visita || vehicle.status || 'activo',
  }
}

/* --- inline styles (nueva paleta) ------------------------- */
const C = {
  bg:        'var(--bg)',
  card:      'var(--surface)',
  primary:   'var(--accent)',
  accent:    'var(--accent2)',
  textSoft:  'var(--text-dim)',
  border:    'var(--border)',
  borderMid: 'rgba(90,202,249,0.20)',
}

const s = {
  /* layout */
  page: {
    width: '100%',
    maxWidth: 1440,
    margin: '0 auto',
    fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
  },

  /* topbar */
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 20,
    marginBottom: 16,   /* ? menos margen para subir el bloque */
    flexWrap: 'wrap',
    paddingTop: 0,      /* ? asegura que no haya padding extra arriba */
  },
  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 15,           /* ? mas grande (era 12) */
    fontWeight: 600,        /* ? un poco de peso */
    color: C.textSoft,
    marginBottom: 6,
    letterSpacing: '0.02em',
  },
  breadcrumbAccent: { color: C.accent },
  pageTitle: {
    margin: 0,
    fontSize: 'clamp(2.2rem,5vw,3.6rem)',
    fontWeight: 800,
    color: '#fff',
    lineHeight: 1.05,
    letterSpacing: '-0.5px',
  },
  pageSub: {
    margin: '8px 0 0',
    color: C.textSoft,
    fontSize: '1.05rem',    /* ? un poco mas grande (era 1rem) */
    fontWeight: 400,
  },

  /* btn pair */
  btnPair: {
    display: 'flex',
    alignItems: 'center',
    borderRadius: 12,
    overflow: 'hidden',
    border: `1px solid ${C.borderMid}`,
    flexShrink: 0,
  },
  btnEntry: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 22px',
    background: C.primary,
    color: '#fff',
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
    border: 'none',
    borderRight: '1px solid rgba(255,255,255,0.15)',
    letterSpacing: '0.01em',
  },
  btnExit: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 22px',
    background: 'transparent',
    color: C.accent,
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
    border: 'none',
    letterSpacing: '0.01em',
  },

  /* kpi row */
  kpiRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))',
    gap: 14,
    marginBottom: 20,
  },
  kpiCard: (accentColor) => ({
    background: C.card,
    borderRadius: 14,
    padding: '20px 22px',
    border: `1px solid ${C.border}`,
    borderRight: `3px solid ${accentColor}`,
    position: 'relative',
  }),
  kpiLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.09em',
    color: C.textSoft,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  kpiValue: (color = '#fff') => ({
    fontSize: 'clamp(2.4rem,4vw,3.4rem)',
    fontWeight: 800,
    color,
    lineHeight: 1,
    letterSpacing: '-1px',
    margin: '0 0 6px',
  }),
  kpiSub: {
    fontSize: 11,
    color: C.textSoft,
  },
  kpiTrend: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    paddingTop: 10,
    borderTop: `1px solid rgba(90,202,249,0.12)`,
    fontSize: 11,
    color: C.textSoft,
  },
  trendAccent: { color: C.accent, fontWeight: 700 },

  /* content row */
  contentRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 300px',
    gap: 16,
    marginBottom: 16,
    alignItems: 'start',
  },

  /* panel card */
  panelCard: {
    background: C.card,
    borderRadius: 16,
    border: `1px solid ${C.border}`,
    overflow: 'hidden',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '18px 22px',
    borderBottom: `1px solid ${C.border}`,
  },
  cardTitle: { fontSize: 14, fontWeight: 700, color: '#fff', margin: 0 },
  cardSub: { fontSize: 12, color: C.textSoft, marginTop: 3 },
  cardLink: {
    fontSize: 12,
    color: C.accent,
    fontWeight: 600,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
  },
  cardBody: { padding: '18px 22px' },

  /* floors grid */
  floorsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))',
    gap: 10,
  },
  floorCard: {
    background: 'var(--bg)',
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    overflow: 'hidden',
  },
  floorHead: {
    padding: '10px 12px 8px',
    borderBottom: `1px solid rgba(90,202,249,0.08)`,
  },
  floorTag: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  floorName: { fontSize: 11, fontWeight: 800, fontFamily: "'Syne', sans-serif", background: 'linear-gradient(135deg, #e2e8f0 30%, var(--accent) 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', letterSpacing: '0.05em' },
  floorDot: (active) => ({
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: active ? C.accent : 'rgba(90,202,249,0.25)',
  }),
  floorBarWrap: {
    marginTop: 8,
    height: 3,
    background: 'rgba(90,202,249,0.1)',
    borderRadius: 2,
  },
  floorBar: (pct) => ({
    height: 3,
    borderRadius: 2,
    background: C.primary,
    width: `${pct}%`,
    transition: 'width 0.4s',
  }),
  floorBody: { padding: '10px 12px' },
  floorRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' },
  floorLabel: { fontSize: 10, color: C.textSoft },
  floorValOcc: { fontSize: 12, fontWeight: 700, color: C.accent },
  floorValAvail: { fontSize: 12, fontWeight: 700, color: '#fff' },
  floorPct: {
    fontSize: 9,
    color: C.textSoft,
    marginTop: 6,
    paddingTop: 6,
    borderTop: 'rgba(90,202,249,0.06) solid 1px',
    textAlign: 'right',
  },

  /* mini stats */
  miniGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  miniCard: {
    background: 'var(--bg)',
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    padding: 14,
  },
  miniIco: {
    width: 28,
    height: 28,
    borderRadius: 7,
    background: 'rgba(9,131,200,0.18)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    color: C.accent,
    fontSize: 16,
  },
  miniNum: { fontSize: 22, fontWeight: 800, fontFamily: "'Syne', sans-serif", background: 'linear-gradient(135deg, #e2e8f0 30%, var(--accent) 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', letterSpacing: '-0.5px' },
  miniLbl: { fontSize: 10, color: C.textSoft, marginTop: 2 },

  /* vehicles table */
  vehiclesCard: {
    background: C.card,
    borderRadius: 16,
    border: `1px solid ${C.border}`,
    overflow: 'hidden',
  },
  tableWrap: { padding: '0 0 4px', overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' },
  th: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.08em',
    color: C.textSoft,
    textTransform: 'uppercase',
    padding: '16px 22px 12px',
    textAlign: 'left',
    background: 'rgba(5,32,62,0.6)',
  },
  td: {
    padding: '13px 22px',
    fontSize: 13,
    color: '#fff',
    borderTop: `1px solid rgba(90,202,249,0.06)`,
    verticalAlign: 'middle',
  },
  plateBadge: {
    display: 'inline-block',
    padding: '3px 9px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 700,
    background: 'rgba(9,131,200,0.15)',
    color: C.accent,
    border: `1px solid rgba(9,131,200,0.28)`,
    letterSpacing: '0.05em',
  },
  vehicleBlock: { display: 'flex', alignItems: 'center', gap: 10 },
  vehicleText: { display: 'grid', gap: 2 },
  vehicleModel: { fontSize: 13, fontWeight: 600, color: '#fff', margin: 0 },
  vehiclePlate: { fontSize: 11, color: C.textSoft, margin: 0 },

  /* status badge */
  statusBadge: (estado) => {
    const map = {
      activo:    { bg: 'rgba(90,202,249,0.12)', color: C.accent,      border: 'rgba(90,202,249,0.3)' },
      salida:    { bg: 'rgba(248,81,73,0.12)',  color: '#f85149',      border: 'rgba(248,81,73,0.3)' },
      completado:{ bg: 'rgba(63,185,80,0.12)', color: '#3fb950',      border: 'rgba(63,185,80,0.3)' },
    }
    const theme = map[String(estado).toLowerCase()] || map.activo
    return {
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 700,
      background: theme.bg,
      color: theme.color,
      border: `1px solid ${theme.border}`,
      letterSpacing: '0.03em',
      textTransform: 'capitalize',
    }
  },

  /* empty state */
  emptyState: { textAlign: 'center', padding: '36px 22px' },
  emptyIco: {
    width: 40,
    height: 40,
    borderRadius: 10,
    background: 'rgba(9,131,200,0.1)',
    border: `1px solid rgba(9,131,200,0.2)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 12px',
    color: C.accent,
    fontSize: 20,
  },
  emptyLbl: { fontSize: 13, color: C.textSoft },
  emptySub: { fontSize: 11, color: 'rgba(186,222,239,0.45)', marginTop: 4 },

  /* error */
  errorBox: {
    borderRadius: 12,
    padding: '14px 18px',
    marginBottom: 18,
    background: 'rgba(110,16,16,0.28)',
    border: '1px solid rgba(248,81,73,0.45)',
    color: '#ffb4b1',
    fontWeight: 600,
    fontSize: 14,
  },

  /* skeleton */
  skeleton: {
    borderRadius: 10,
    background: 'linear-gradient(90deg,#0d1117 0%,#1a212a 50%,#0d1117 100%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.25s linear infinite',
  },
}

/* --- icon helpers ------------------------------------------ */
const Icon = ({ name, size = 16 }) => (
  <span
    className="material-symbols-outlined"
    style={{ fontSize: size, verticalAlign: 'middle', lineHeight: 1, flexShrink: 0 }}
  >
    {name}
  </span>
)

/* --- sub-components --------------------------------------- */
function KpiCard({ label, value, sub, trend, trendVal, accentColor }) {
  return (
    <div style={s.kpiCard(accentColor)}>
      <div style={s.kpiLabel}>{label}</div>
      <p style={s.kpiValue(accentColor === C.accent ? C.accent : '#fff')}>{value}</p>
      <div style={s.kpiSub}>{sub}</div>
      <div style={s.kpiTrend}>
        <span style={s.trendAccent}>{trendVal}</span>
        <span>{trend}</span>
      </div>
    </div>
  )
}

function FloorCard({ floor, total, ocupados, disponibles }) {
  const pct = total > 0 ? Math.round((ocupados / total) * 100) : 0
  return (
    <div style={s.floorCard}>
      <div style={s.floorHead}>
        <div style={s.floorTag}>
          <span style={s.floorName}>Piso {floor}</span>
          <span style={s.floorDot(ocupados > 0)} />
        </div>
        <div style={s.floorBarWrap}>
          <div style={s.floorBar(pct)} />
        </div>
      </div>
      <div style={s.floorBody}>
        <div style={s.floorRow}>
          <span style={s.floorLabel}>Ocupados</span>
          <span style={s.floorValOcc}>{ocupados}</span>
        </div>
        <div style={s.floorRow}>
          <span style={s.floorLabel}>Disponibles</span>
          <span style={s.floorValAvail}>{disponibles}</span>
        </div>
        <div style={s.floorPct}>{pct}% uso</div>
      </div>
    </div>
  )
}

function MiniStat({ icon, value, label }) {
  return (
    <div style={s.miniCard}>
      <div style={s.miniIco}>
        <Icon name={icon} size={14} />
      </div>
      <div style={s.miniNum}>{value}</div>
      <div style={s.miniLbl}>{label}</div>
    </div>
  )
}

/* --- main component --------------------------------------- */
export default function GatePanel() {
  const navigate = useNavigate()
  const cachedSpaces = getCachedApiData('/api/parking-spaces')
  const cachedVehicles = getCachedApiData('/api/vehiculos')

  const [parqueos, setParqueos] = useState(() =>
    Array.isArray(cachedSpaces?.data) ? cachedSpaces.data.map(normalizeSpace) : [],
  )
  const [vehicles, setVehicles] = useState(() =>
    Array.isArray(cachedVehicles?.data)
      ? cachedVehicles.data.map((v, i) => normalizeVehicle(v, i))
      : [],
  )
  const [loadingParqueos, setLoadingParqueos] = useState(() => !cachedSpaces)
  const [loadingVehicles, setLoadingVehicles] = useState(() => !cachedVehicles)
  const [error, setError] = useState(null)
  const [isEntryOpen, setIsEntryOpen] = useState(false)
  const [isExitOpen, setIsExitOpen] = useState(false)
  const [selectedPlate, setSelectedPlate] = useState('')
  const [isMapOpen, setIsMapOpen] = useState(false)

  const loadData = async ({ showLoader = true, forceFresh = true } = {}) => {
    if (showLoader) {
      setLoadingParqueos(true)
      setLoadingVehicles(true)
    }

    try {
      const [spacesPayload, vehiclesPayload] = await Promise.all([
        apiGet('/api/parking-spaces', { forceFresh }),
        apiGet('/api/vehiculos', { forceFresh }),
      ])
      setParqueos(Array.isArray(spacesPayload?.data) ? spacesPayload.data.map(normalizeSpace) : [])
      setVehicles(
        Array.isArray(vehiclesPayload?.data)
          ? vehiclesPayload.data.map((v, i) => normalizeVehicle(v, i))
          : [],
      )
      setError(null)
    } catch (err) {
      setError(err.message || 'No fue posible cargar el panel de porteria.')
    } finally {
      setLoadingParqueos(false)
      setLoadingVehicles(false)
    }
  }

  useEffect(() => {
    loadData({ showLoader: !cachedSpaces || !cachedVehicles })

    const intervalId = window.setInterval(() => {
      loadData({ showLoader: false, forceFresh: true })
    }, 5000)

    const handleDataRefresh = () => {
      loadData({ showLoader: false, forceFresh: true })
    }

    window.addEventListener('smartpark:data-refresh', handleDataRefresh)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('smartpark:data-refresh', handleDataRefresh)
    }
  }, [])

  const occupiedSpaces = useMemo(
    () => parqueos.filter((s) => s.estado === 'ocupado').length,
    [parqueos],
  )
  const availableSpaces = Math.max(0, parqueos.length - occupiedSpaces)
  const occupancyPct = parqueos.length > 0 ? Math.round((occupiedSpaces / parqueos.length) * 100) : 0

  const floorSummary = useMemo(() => {
    const index = buildFloorIndex(parqueos)
    const floors = index.floors.length ? index.floors : DEFAULT_FLOORS
    return floors.map((floor) => {
      const spaces = parqueos.filter((sp) => sp.nivel === floor)
      const ocupados = spaces.filter((sp) => sp.estado === 'ocupado').length
      return { floor, total: spaces.length, ocupados, disponibles: Math.max(0, spaces.length - ocupados) }
    })
  }, [parqueos])

  const espaciosMap = useMemo(
    () => new Map(parqueos.map((sp) => [sp.id, sp.label || 'Sin espacio'])),
    [parqueos],
  )

  const latestEntries = useMemo(() => {
    return [...vehicles]
      .filter((v) => v.fechaEntrada)
      .sort((a, b) => (b.fechaEntrada?.getTime() || 0) - (a.fechaEntrada?.getTime() || 0))
      .slice(0, 5)
      .map((v) => ({
        ...v,
        espacio:
          espaciosMap.get(v.espacioId) ||
          v.espacioRaw ||
          (v.espacioId ? v.espacioId.slice(0, 8) : 'Sin espacio'),
      }))
  }, [espaciosMap, vehicles])

  return (
    <div className="module-page porteria-page" style={s.page}>
      {/* -- Header -- */}
      <div className="porteria-header">
        <div>
          <div style={s.breadcrumb}>
            SmartPark
            <span style={s.breadcrumbAccent}>/</span>
            <span style={s.breadcrumbAccent}>Portería</span>
          </div>
          <h1>Panel de Portería</h1>
          <p>Gestiona ingresos, salidas y el estado del garaje en tiempo real.</p>
        </div>

        <div className="porteria-header__actions">
          <div style={s.btnPair}>
            <button
              type="button"
              style={s.btnEntry}
              onClick={() => setIsEntryOpen(true)}
            >
              <Icon name="login" size={15} />
              Registrar Entrada
            </button>
            <button
              type="button"
              style={s.btnExit}
              onClick={() => {
                setSelectedPlate('')
                setIsExitOpen(true)
              }}
            >
              <Icon name="logout" size={15} />
              Registrar Salida
            </button>
          </div>
        </div>
      </div>

      {/* -- Error -- */}
      {error && <div style={s.errorBox}>{error}</div>}

      {/* -- KPI cards -- */}
      <div style={s.kpiRow}>
        <KpiCard
          label="Espacios Ocupados"
          value={loadingParqueos ? '--' : occupiedSpaces}
          sub="Activos en este momento"
          trendVal="--"
          trend="Sin movimientos hoy"
          accentColor={C.primary}
        />
        <KpiCard
          label="Espacios Disponibles"
          value={loadingParqueos ? '--' : availableSpaces}
          sub={`De un total de ${parqueos.length} espacios`}
          trendVal={loadingParqueos ? '--' : `${100 - occupancyPct}%`}
          trend="capacidad libre"
          accentColor={C.accent}
        />
        <KpiCard
          label="Ingresos Hoy"
          value={loadingVehicles ? '--' : vehicles.length}
          sub="Vehiculos registrados"
          trendVal="--"
          trend="Sin filtro de fecha aun"
          accentColor="rgba(90,202,249,0.4)"
        />
        <KpiCard
          label="Ocupacion General"
          value={loadingParqueos ? '--' : `${occupancyPct}%`}
          sub="Del total de espacios"
          trendVal={occupancyPct > 80 ? 'Alta' : occupancyPct > 40 ? 'Media' : 'Baja'}
          trend="demanda actual"
          accentColor="rgba(9,131,200,0.35)"
        />
      </div>

      {/* -- Content row: floors + mini stats -- */}
      <div style={s.contentRow}>
        {/* Floor summary */}
        <div style={s.panelCard}>
          <div style={s.cardHeader}>
            <div>
              <h2 style={s.cardTitle}>Resumen por piso</h2>
              <p style={s.cardSub}>Ocupacion y disponibilidad en tiempo real</p>
            </div>
            <button 
              type="button" 
              style={{...s.cardLink, background: 'none', border: 'none', cursor: 'pointer'}}
              onClick={() => setIsMapOpen(true)}
            >
              Ver mapa completo
            </button>
          </div>
          <div style={s.cardBody}>
            {loadingParqueos ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} style={{ ...s.skeleton, height: 110 }} />
                ))}
              </div>
            ) : (
              <div style={s.floorsGrid}>
                {floorSummary.map((item) => (
                  <FloorCard key={item.floor} {...item} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mini stats */}
        <div style={s.panelCard}>
          <div style={s.cardHeader}>
            <div>
              <h2 style={s.cardTitle}>Estado general</h2>
              <p style={s.cardSub}>Metricas clave del garaje</p>
            </div>
          </div>
          <div style={s.cardBody}>
            <div style={s.miniGrid}>
              <MiniStat icon="directions_car" value={loadingVehicles ? '--' : vehicles.length} label="Total vehiculos" />
              <MiniStat icon="speed" value={loadingParqueos ? '--' : `${occupancyPct}%`} label="Ocupacion" />
              <MiniStat icon="schedule" value="--" label="Tiempo medio" />
              <MiniStat icon="payments" value="$0" label="Ingresos hoy" />
            </div>
          </div>
        </div>
      </div>

      {/* -- Vehicles table -- */}
      <div style={s.vehiclesCard}>
        <div style={s.cardHeader}>
          <div>
            <h2 style={s.cardTitle}>Ultimos 5 vehiculos ingresados</h2>
            <p style={s.cardSub}>Registro de entradas recientes</p>
          </div>
          <button
            type="button"
            style={s.cardLink}
            onClick={() => navigate('/parking/history')}
          >
            Ver historial completo
          </button>
        </div>

        <div style={s.tableWrap}>
          {loadingVehicles ? (
            <div style={{ padding: '18px 22px' }}>
              <div style={{ ...s.skeleton, height: 48, marginBottom: 10 }} />
              <div style={{ ...s.skeleton, height: 48 }} />
            </div>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={{ ...s.th, width: '18%' }}>Fecha</th>
                  <th style={{ ...s.th, width: '14%' }}>Ubicación</th>
                  <th style={{ ...s.th, width: '22%' }}>Vehículo</th>
                  <th style={{ ...s.th, width: '14%' }}>Duración</th>
                  <th style={{ ...s.th, width: '14%' }}>Costo</th>
                  <th style={{ ...s.th, width: '18%', textAlign: 'center' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {latestEntries.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 0 }}>
                      <div style={s.emptyState}>
                        <div style={s.emptyIco}>
                          <Icon name="directions_car" size={18} />
                        </div>
                        <div style={s.emptyLbl}>Aun no hay ingresos registrados</div>
                        <div style={s.emptySub}>Los vehiculos apareceran aqui al registrar una entrada</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  latestEntries.map((entry) => (
                    <tr key={entry.id}>
                      {/* Fecha */}
                      <td style={{ ...s.td, color: C.textSoft, fontSize: 12 }}>
                        {entry.fechaEntradaLabel}
                      </td>

                      {/* Ubicación */}
                      <td style={s.td}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          fontSize: 12,
                          color: '#fff',
                          fontWeight: 600,
                        }}>
                          <Icon name="location_on" size={13} />
                          {entry.espacio}
                        </span>
                      </td>

                      {/* Vehículo */}
                      <td style={s.td}>
                        <div style={s.vehicleBlock}>
                          <span style={s.plateBadge}>{entry.placa.slice(0, 4)}</span>
                          <div style={s.vehicleText}>
                            <p style={s.vehicleModel}>{entry.modelo}</p>
                            <p style={s.vehiclePlate}>{entry.placa}</p>
                          </div>
                        </div>
                      </td>

                      {/* Duración */}
                      <td style={{ ...s.td, color: C.textSoft, fontSize: 12 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Icon name="schedule" size={13} />
                          {formatDuration(entry.fechaEntrada)}
                        </span>
                      </td>

                      {/* Costo */}
                      <td style={{ ...s.td, color: '#fff', fontWeight: 700 }}>
                        {entry.costo != null ? `$${Number(entry.costo).toFixed(2)}` : '--'}
                      </td>

                      {/* Estado */}
                      <td style={{ ...s.td, textAlign: 'center' }}>
                        <span style={s.statusBadge(entry.estado)}>
                          {entry.estado === 'activo' ? 'Activo' : entry.estado === 'salida' ? 'Salida' : entry.estado}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {isMapOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.82)', display: 'grid', placeItems: 'center', padding: 24, zIndex: 1000 }} onClick={() => setIsMapOpen(false)}>
          <div style={{ width: 'min(980px, 100%)', maxHeight: '88vh', overflow: 'auto', background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 24 }} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 18 }}>
              <div>
                <h2 style={{ margin: 0, color: '#fff', fontSize: 24, fontWeight: 800 }}>Mapa completo</h2>
                <p style={{ margin: '6px 0 0', color: C.textSoft }}>Disponibilidad de todos los pisos en tiempo real.</p>
              </div>
              <button type="button" style={{ ...s.cardLink, fontSize: 13 }} onClick={() => setIsMapOpen(false)}>
                Cerrar
              </button>
            </div>
            <div style={{ display: 'grid', gap: 16 }}>
              {floorSummary.map((item) => {
                const spacesForFloor = parqueos.filter((space) => space.nivel === item.floor)
                return (
                  <section key={item.floor} style={{ background: 'var(--bg)', border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <strong style={{ color: '#fff' }}>Piso {item.floor}</strong>
                      <span style={{ color: C.textSoft, fontSize: 12 }}>{item.ocupados} ocupados / {item.total} espacios</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 10 }}>
                      {spacesForFloor.map((space) => (
                        <div key={space.id} style={{ borderRadius: 10, padding: '12px 8px', border: `1px solid ${space.estado === 'ocupado' ? 'rgba(248,81,73,0.35)' : 'rgba(63,185,80,0.35)'}`, background: space.estado === 'ocupado' ? 'rgba(248,81,73,0.12)' : 'rgba(63,185,80,0.12)', color: space.estado === 'ocupado' ? '#f85149' : '#3fb950', textAlign: 'center', fontSize: 11, fontWeight: 700 }}>
                          <div>{space.label}</div>
                          <div style={{ marginTop: 4, fontSize: 10 }}>{space.estado === 'ocupado' ? 'Ocupado' : 'Libre'}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <ModalEntry
        isOpen={isEntryOpen}
        onClose={() => setIsEntryOpen(false)}
        onSuccess={() => loadData({ showLoader: false, forceFresh: true })}
      />

      <ModalExit
        isOpen={isExitOpen}
        initialPlate={selectedPlate}
        onClose={() => {
          setIsExitOpen(false)
          setSelectedPlate('')
        }}
        onSuccess={() => loadData({ showLoader: false, forceFresh: true })}
      />
    </div>
  )
}




