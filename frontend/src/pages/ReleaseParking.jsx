import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { apiGet, getCachedApiData } from '../lib/api'

const C = {
  card: 'var(--surface)',
  cardDeep: 'var(--surface2)',
  text: 'var(--text)',
  dim: 'var(--text-dim)',
  border: 'var(--border)',
  accent: 'var(--accent)',
  accent2: 'var(--accent2)',
  success: 'var(--success)',
  danger: 'var(--danger)',
  warning: 'var(--accent)',
}

const formatCurrency = (value) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 2 }).format(Number(value || 0))

const parseDate = (value) => {
  if (!value) return null
  const date = new Date(String(value).replace('Z', '+00:00'))
  return Number.isNaN(date.getTime()) ? null : date
}

const formatDuration = (value) => {
  const start = parseDate(value)
  if (!start) return 'Sin hora'
  const totalMinutes = Math.max(0, Math.floor((Date.now() - start.getTime()) / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (!hours) return `${minutes} min`
  return `${hours}h ${String(minutes).padStart(2, '0')}m`
}

const formatCurrentCost = (value, hourlyRate) => {
  const start = parseDate(value)
  if (!start) return formatCurrency(0)
  const totalMinutes = Math.max(0, Math.floor((Date.now() - start.getTime()) / 60000))
  const billedHours = Math.max(1, Math.ceil(totalMinutes / 60))
  return formatCurrency(billedHours * Number(hourlyRate || 0))
}

const normalizeSpace = (space = {}) => ({
  id: String(space.id || ''),
  label: space.numero_mostrar || space.codigo || space.nombre || 'Sin espacio',
  occupied: Boolean(space.ocupado) || String(space.estado || '').toLowerCase() === 'ocupado',
  floor: String(space.nivel || space.nivel_mostrar || space.tipo || '').trim().toUpperCase(),
})

const normalizeVehicle = (vehicle = {}) => ({
  id: vehicle.id,
  placa: vehicle.placa || 'Sin placa',
  modelo: vehicle.modelo || vehicle.model || 'Vehículo registrado',
  propietario: vehicle.propietario || vehicle.owner || 'Sin propietario',
  spaceId: String(vehicle.espacio_id || vehicle.space_id || ''),
  rawLocation: vehicle.espacio || vehicle.ubicacion || '',
  entry: vehicle.hora_entrada || vehicle.entry_time || null,
  status: String(vehicle.status || vehicle.estado || '').toLowerCase(),
})

const styles = {
  page: { width: '100%', maxWidth: 1440, margin: '0 auto', fontFamily: "'DM Sans', system-ui, sans-serif", color: C.text },
  header: { display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap' },
  eyebrow: { fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.14em', color: C.dim, marginBottom: 12, fontWeight: 700 },
  title: { margin: 0, fontFamily: "'Syne', sans-serif", fontSize: 'clamp(1.9rem, 3vw, 2.4rem)', fontWeight: 800, lineHeight: 1, letterSpacing: '-0.04em', background: 'linear-gradient(135deg, #e2e8f0 30%, var(--accent) 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' },
  subtitle: { margin: '10px 0 0', color: C.dim, fontSize: '1rem' },
  actions: { display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' },
  actionBtn: { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 22px', borderRadius: 999, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  metrics: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 },
  metricCard: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 22 },
  metricLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.dim, marginBottom: 12, fontWeight: 700 },
  metricValue: (color = C.text) => ({ fontFamily: "'Syne', sans-serif", fontSize: 'clamp(1.45rem, 2.4vw, 2rem)', fontWeight: 800, letterSpacing: '-0.03em', color, lineHeight: 1 }),
  metricHint: { marginTop: 8, color: C.dim, fontSize: 13 },
  grid: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 18, alignItems: 'start' },
  listCard: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, overflow: 'hidden' },
  toolbar: { padding: '20px 24px', display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', borderBottom: '1px solid rgba(99,179,237,0.06)', flexWrap: 'wrap' },
  search: { flex: 1, minWidth: 240, background: C.cardDeep, border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px 16px', color: C.text, fontSize: 14, outline: 'none' },
  list: { display: 'grid', gap: 0 },
  row: { display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 0.9fr 0.9fr auto', gap: 16, alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid rgba(99,179,237,0.06)' },
  plate: { fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 18, color: C.accent, letterSpacing: '-0.03em' },
  sub: { marginTop: 4, color: C.dim, fontSize: 13 },
  sideCard: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 22 },
  sideTitle: { margin: 0, fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 24, letterSpacing: '-0.03em' },
  rateRow: { display: 'flex', justifyContent: 'space-between', gap: 14, padding: '12px 0', borderBottom: '1px solid rgba(99,179,237,0.06)', fontSize: 14 },
  note: { marginTop: 14, color: C.dim, fontSize: 13, lineHeight: 1.5 },
  releaseBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '10px 18px', borderRadius: 999, border: 'none',
    background: C.accent, color: '#08101e', fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit',
    boxShadow: '0 12px 24px rgba(56,189,248,0.15)',
    transition: 'filter .2s, box-shadow .2s',
  },
  empty: { padding: 36, textAlign: 'center', color: C.dim },
  feedbackError: { borderRadius: 14, padding: '12px 16px', marginBottom: 16, background: 'rgba(248,113,113,0.14)', border: '1px solid rgba(248,113,113,0.25)', color: '#fecaca', fontWeight: 600 },
  feedbackSuccess: { borderRadius: 14, padding: '12px 16px', marginBottom: 16, background: 'rgba(52,211,153,0.14)', border: '1px solid rgba(52,211,153,0.22)', color: '#bbf7d0', fontWeight: 600 },
}

const Icon = ({ name, size = 18 }) => (
  <span className="material-symbols-outlined" style={{ fontSize: size, lineHeight: 1 }}>{name}</span>
)

export default function LiberarParqueos() {
  const navigate = useNavigate()

  const cachedVehicles = getCachedApiData('/api/vehiculos')
  const cachedSpaces   = getCachedApiData('/api/parking-spaces')
  const cachedSettings = getCachedApiData('/api/auth/settings')
  const hasCache = Boolean(cachedVehicles && cachedSpaces)

  const [vehiculos, setVehiculos] = useState(() => cachedVehicles?.data || [])
  const [parqueos, setParqueos]   = useState(() => cachedSpaces?.data  || [])
  const [hourlyRate, setHourlyRate] = useState(() => Number(cachedSettings?.data?.hourly_rate || 50) || 50)
  const [loading, setLoading]     = useState(() => !hasCache)
  const [error, setError]         = useState('')
  const [search, setSearch]       = useState('')

  const loadData = async ({ showLoader = true } = {}) => {
    if (showLoader) setLoading(true)
    setError('')
    try {
      const [vp, pp] = await Promise.all([
        apiGet('/api/vehiculos', { forceFresh: true }),
        apiGet('/api/parking-spaces', { forceFresh: true }),
      ])
      setVehiculos(Array.isArray(vp?.data) ? vp.data : [])
      setParqueos(Array.isArray(pp?.data) ? pp.data : [])
      apiGet('/api/auth/settings', { forceFresh: true })
        .then((settings) => setHourlyRate(Number(settings?.data?.hourly_rate || 50) || 50))
        .catch(() => null)
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las liberaciones.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData({ showLoader: !hasCache })
    const id = window.setInterval(() => loadData({ showLoader: false }), 5000)
    const onRefresh = () => loadData({ showLoader: false })
    window.addEventListener('smartpark:data-refresh', onRefresh)
    return () => { window.clearInterval(id); window.removeEventListener('smartpark:data-refresh', onRefresh) }
  }, [])

  const rows = useMemo(() => {
    const spacesMap = new Map((parqueos || []).map((space) => {
      const n = normalizeSpace(space)
      return [n.id, n]
    }))
    return (vehiculos || [])
      .map(normalizeVehicle)
      .filter((v) => v.status === 'dentro')
      .map((v) => {
        const space = spacesMap.get(v.spaceId)
        return {
          ...v,
          floor: space?.floor || '',
          location: space?.label || v.rawLocation || 'Sin espacio',
          duration: formatDuration(v.entry),
          cost: formatCurrentCost(v.entry, hourlyRate),
        }
      })
      .filter((v) => {
        if (!search.trim()) return true
        const term = search.toLowerCase()
        return [v.placa, v.modelo, v.propietario, v.location].join(' ').toLowerCase().includes(term)
      })
  }, [vehiculos, parqueos, search, hourlyRate])

  const occupiedSpaces  = useMemo(() => (parqueos || []).map(normalizeSpace).filter((s) => s.occupied).length, [parqueos])
  const totalSpaces     = Array.isArray(parqueos) ? parqueos.length : 0
  const availableSpaces = Math.max(0, totalSpaces - occupiedSpaces)
  const occupancyPct    = totalSpaces ? Math.round((occupiedSpaces / totalSpaces) * 100) : 0

  // Navigate to Payments passing the plate so Cobros can pre-select the vehicle
  const handleGoToPayment = (row) => {
    navigate('/payments', { state: { placa: row.placa } })
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <div style={styles.eyebrow}>Liberaciones</div>
          <h1>Liberar parqueos</h1>
          <p style={styles.subtitle}>Gestiona las salidas activas y libera espacios ocupados en tiempo real.</p>
        </div>
        <div style={styles.actions}>
          <button type="button" style={styles.actionBtn} onClick={() => loadData({ showLoader: false })}>
            <Icon name="refresh" size={16} /> Actualizar lista
          </button>
        </div>
      </header>

      {error && <div style={styles.feedbackError}>{error}</div>}

      <section style={styles.metrics}>
        {[
          { label: 'Parqueos ocupados',    value: occupiedSpaces,     color: C.danger,  hint: 'Espacios activos pendientes de salida.' },
          { label: 'Parqueos disponibles', value: availableSpaces,    color: C.success, hint: 'Listos para nuevas entradas.' },
          { label: 'Ocupación actual',     value: `${occupancyPct}%`, color: C.accent2, hint: 'Basado en el total de espacios registrados.' },
        ].map(({ label, value, color, hint }) => (
          <article key={label} style={styles.metricCard}>
            <div style={styles.metricLabel}>{label}</div>
            <div style={styles.metricValue(color)}>{loading ? '--' : value}</div>
            <div style={styles.metricHint}>{hint}</div>
          </article>
        ))}
      </section>

      <section style={styles.grid}>
        <div style={styles.listCard}>
          <div style={styles.toolbar}>
            <input
              type="search"
              placeholder="Buscar por placa, modelo, propietario o espacio..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={styles.search}
            />
          </div>

          <div style={styles.list}>
            {loading ? (
              <div style={styles.empty}>Cargando parqueos ocupados...</div>
            ) : rows.length === 0 ? (
              <div style={styles.empty}>No hay parqueos ocupados para liberar.</div>
            ) : rows.map((row) => (
              <article key={row.id} style={styles.row}>
                <div>
                  <div style={styles.plate}>{row.placa}</div>
                  <div style={styles.sub}>{row.modelo}</div>
                </div>
                <div>
                  <strong>{row.propietario}</strong>
                  <div style={styles.sub}>{row.floor ? `Piso ${row.floor}` : 'Sin piso'}</div>
                </div>
                <div>
                  <strong>{row.location}</strong>
                  <div style={styles.sub}>Tiempo: {row.duration}</div>
                </div>
                <div>
                  <strong style={{ color: C.success, fontFamily: "'Syne', sans-serif", letterSpacing: '-0.03em' }}>
                    {row.cost}
                  </strong>
                  <div style={styles.sub}>Costo estimado actual</div>
                </div>
                <div style={{ justifySelf: 'end' }}>
                  <button
                    type="button"
                    style={styles.releaseBtn}
                    onClick={() => handleGoToPayment(row)}
                  >
                    <Icon name="payments" size={16} />
                    Ir a Cobros
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside style={styles.sideCard}>
          <h2 style={styles.sideTitle}>Tarifas vigentes</h2>
          <div style={{ marginTop: 14 }}>
            {[['Tarifa por hora', `${formatCurrency(hourlyRate)}/hr`], ['Horas cobrables', 'Redondeo por hora iniciada']].map(([label, value]) => (
              <div key={label} style={styles.rateRow}>
                <span style={{ color: C.dim }}>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <p style={styles.note}>
            El cobro y la generación de factura se realizan desde el módulo de <strong>Cobros</strong>.
          </p>
        </aside>
      </section>
    </div>
  )
}
