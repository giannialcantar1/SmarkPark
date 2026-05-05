import { useEffect, useMemo, useState } from 'react'

import { apiGet, apiPost, getCachedApiData } from '../lib/api'

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
  new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))

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

const formatCurrentCost = (value) => {
  const start = parseDate(value)
  if (!start) return formatCurrency(0)
  const totalMinutes = Math.max(0, Math.floor((Date.now() - start.getTime()) / 60000))
  if (totalMinutes <= 15) return formatCurrency(5)
  if (totalMinutes <= 60) return formatCurrency(15)
  const billedHours = Math.min(12, Math.ceil(totalMinutes / 60))
  return formatCurrency(billedHours >= 12 ? 120 : billedHours * 15)
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
  page: {
    width: '100%',
    maxWidth: 1440,
    margin: '0 auto',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    color: C.text,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 20,
    alignItems: 'flex-start',
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  eyebrow: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    color: C.dim,
    marginBottom: 12,
    fontWeight: 700,
  },
  title: {
    margin: 0,
    fontFamily: "'Syne', sans-serif",
    fontSize: 'clamp(1.9rem, 3vw, 2.4rem)',
    fontWeight: 800,
    lineHeight: 1,
    letterSpacing: '-0.04em',
    background: 'linear-gradient(135deg, #e2e8f0 30%, var(--accent) 100%)',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
  },
  subtitle: { margin: '10px 0 0', color: C.dim, fontSize: '1rem' },
  actions: { display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' },
  actionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 22px',
    borderRadius: 999,
    border: `1px solid ${C.border}`,
    background: C.card,
    color: C.text,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  metrics: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 16,
    marginBottom: 20,
  },
  metricCard: {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 20,
    padding: 22,
  },
  metricLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: C.dim,
    marginBottom: 12,
    fontWeight: 700,
  },
  metricValue: (color = C.text) => ({
    fontFamily: "'Syne', sans-serif",
    fontSize: 'clamp(1.45rem, 2.4vw, 2rem)',
    fontWeight: 800,
    letterSpacing: '-0.03em',
    color,
    lineHeight: 1,
  }),
  metricHint: { marginTop: 8, color: C.dim, fontSize: 13 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 320px',
    gap: 18,
    alignItems: 'start',
  },
  listCard: {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 20,
    overflow: 'hidden',
  },
  toolbar: {
    padding: '20px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    alignItems: 'center',
    borderBottom: '1px solid rgba(99,179,237,0.06)',
    flexWrap: 'wrap',
  },
  search: {
    flex: 1,
    minWidth: 240,
    background: C.cardDeep,
    border: `1px solid ${C.border}`,
    borderRadius: 14,
    padding: '12px 16px',
    color: C.text,
    fontSize: 14,
    outline: 'none',
  },
  list: { display: 'grid', gap: 0 },
  row: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1.2fr 0.9fr 0.9fr auto',
    gap: 16,
    alignItems: 'center',
    padding: '18px 24px',
    borderBottom: '1px solid rgba(99,179,237,0.06)',
  },
  plate: {
    fontFamily: "'Syne', sans-serif",
    fontWeight: 700,
    fontSize: 18,
    color: C.accent,
    letterSpacing: '-0.03em',
  },
  sub: { marginTop: 4, color: C.dim, fontSize: 13 },
  sideCard: {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 20,
    padding: 22,
  },
  sideTitle: {
    margin: 0,
    fontFamily: "'Syne', sans-serif",
    fontWeight: 700,
    fontSize: 24,
    letterSpacing: '-0.03em',
  },
  rateRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 14,
    padding: '12px 0',
    borderBottom: '1px solid rgba(99,179,237,0.06)',
    fontSize: 14,
  },
  note: { marginTop: 14, color: C.dim, fontSize: 13, lineHeight: 1.5 },
  releaseBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 18px',
    borderRadius: 999,
    border: 'none',
    background: C.accent,
    color: '#08101e',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 12px 24px rgba(56,189,248,0.15)',
  },
  empty: { padding: 36, textAlign: 'center', color: C.dim },
  feedbackError: {
    borderRadius: 14,
    padding: '12px 16px',
    marginBottom: 16,
    background: 'rgba(248,113,113,0.14)',
    border: '1px solid rgba(248,113,113,0.25)',
    color: '#fecaca',
    fontWeight: 600,
  },
  feedbackSuccess: {
    borderRadius: 14,
    padding: '12px 16px',
    marginBottom: 16,
    background: 'rgba(52,211,153,0.14)',
    border: '1px solid rgba(52,211,153,0.22)',
    color: '#bbf7d0',
    fontWeight: 600,
  },
}

const Icon = ({ name, size = 18 }) => (
  <span className="material-symbols-outlined" style={{ fontSize: size, lineHeight: 1 }}>
    {name}
  </span>
)

export default function LiberarParqueos() {
  const cachedVehicles = getCachedApiData('/api/vehiculos')
  const cachedSpaces = getCachedApiData('/api/parking-spaces')
  const hasCache = Boolean(cachedVehicles && cachedSpaces)

  const [vehiculos, setVehiculos] = useState(() => cachedVehicles?.data || [])
  const [parqueos, setParqueos] = useState(() => cachedSpaces?.data || [])
  const [loading, setLoading] = useState(() => !hasCache)
  const [savingPlate, setSavingPlate] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')

  const loadData = async ({ showLoader = true } = {}) => {
    if (showLoader) setLoading(true)
    setError('')
    try {
      const [vehiculosPayload, parqueosPayload] = await Promise.all([
        apiGet('/api/vehiculos', { forceFresh: true }),
        apiGet('/api/parking-spaces', { forceFresh: true }),
      ])
      setVehiculos(Array.isArray(vehiculosPayload?.data) ? vehiculosPayload.data : [])
      setParqueos(Array.isArray(parqueosPayload?.data) ? parqueosPayload.data : [])
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las liberaciones.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData({ showLoader: !hasCache })

    const intervalId = window.setInterval(() => {
      loadData({ showLoader: false })
    }, 5000)

    const handleDataRefresh = () => loadData({ showLoader: false })
    window.addEventListener('smartpark:data-refresh', handleDataRefresh)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('smartpark:data-refresh', handleDataRefresh)
    }
  }, [])

  const rows = useMemo(() => {
    const spacesMap = new Map((parqueos || []).map((space) => {
      const normalized = normalizeSpace(space)
      return [normalized.id, normalized]
    }))

    return (vehiculos || [])
      .map(normalizeVehicle)
      .filter((vehicle) => vehicle.status === 'dentro')
      .map((vehicle) => {
        const space = spacesMap.get(vehicle.spaceId)
        return {
          ...vehicle,
          floor: space?.floor || '',
          location: space?.label || vehicle.rawLocation || 'Sin espacio',
          duration: formatDuration(vehicle.entry),
          cost: formatCurrentCost(vehicle.entry),
        }
      })
      .filter((vehicle) => {
        if (!search.trim()) return true
        const term = search.toLowerCase()
        return [vehicle.placa, vehicle.modelo, vehicle.propietario, vehicle.location]
          .join(' ')
          .toLowerCase()
          .includes(term)
      })
  }, [vehiculos, parqueos, search])

  const occupiedSpaces = useMemo(
    () => (parqueos || []).map(normalizeSpace).filter((space) => space.occupied).length,
    [parqueos],
  )
  const totalSpaces = Array.isArray(parqueos) ? parqueos.length : 0
  const availableSpaces = Math.max(0, totalSpaces - occupiedSpaces)
  const occupancyPct = totalSpaces ? Math.round((occupiedSpaces / totalSpaces) * 100) : 0

  const handleRelease = async (placa) => {
    setSavingPlate(placa)
    setError('')
    setSuccess('')
    try {
      const response = await apiPost('/api/vehiculos/salida', { placa })
      setSuccess(response?.mensaje || `Salida registrada para ${placa}.`)
      await loadData({ showLoader: false })
      // FIX: Disparar evento para actualización inmediata del dashboard
      window.dispatchEvent(new CustomEvent('dashboard-refresh'))
    } catch (err) {
      setError(err.message || 'No se pudo registrar la salida.')
    } finally {
      setSavingPlate('')
    }
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
            <Icon name="refresh" size={16} />
            Actualizar lista
          </button>
        </div>
      </header>

      {error && <div style={styles.feedbackError}>{error}</div>}
      {success && <div style={styles.feedbackSuccess}>{success}</div>}

      <section style={styles.metrics}>
        <article style={styles.metricCard}>
          <div style={styles.metricLabel}>Parqueos ocupados</div>
          <div style={styles.metricValue(C.danger)}>{loading ? '--' : occupiedSpaces}</div>
          <div style={styles.metricHint}>Espacios activos pendientes de salida.</div>
        </article>
        <article style={styles.metricCard}>
          <div style={styles.metricLabel}>Parqueos disponibles</div>
          <div style={styles.metricValue(C.success)}>{loading ? '--' : availableSpaces}</div>
          <div style={styles.metricHint}>Listos para nuevas entradas.</div>
        </article>
        <article style={styles.metricCard}>
          <div style={styles.metricLabel}>Ocupación actual</div>
          <div style={styles.metricValue(C.accent2)}>{loading ? '--' : `${occupancyPct}%`}</div>
          <div style={styles.metricHint}>Basado en el total de espacios registrados.</div>
        </article>
      </section>

      <section style={styles.grid}>
        <div style={styles.listCard}>
          <div style={styles.toolbar}>
            <input
              type="search"
              placeholder="Buscar por placa, modelo, propietario o espacio..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              style={styles.search}
            />
          </div>

          <div style={styles.list}>
            {loading ? (
              <div style={styles.empty}>Cargando parqueos ocupados...</div>
            ) : rows.length === 0 ? (
              <div style={styles.empty}>No hay parqueos ocupados para liberar.</div>
            ) : (
              rows.map((row) => (
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
                      onClick={() => handleRelease(row.placa)}
                      disabled={savingPlate === row.placa}
                    >
                      <Icon name="logout" size={16} />
                      {savingPlate === row.placa ? 'Procesando...' : 'Registrar salida'}
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        <aside style={styles.sideCard}>
          <h2 style={styles.sideTitle}>Tarifas vigentes</h2>
          <div style={{ marginTop: 14 }}>
            {[
              ['Fracción (15 min)', 'RD$ 5.00'],
              ['Hora completa', 'RD$ 15.00'],
              ['Día completo (12h+)', 'RD$ 120.00'],
            ].map(([label, value]) => (
              <div key={label} style={styles.rateRow}>
                <span style={{ color: C.dim }}>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <p style={styles.note}>
            Los montos mostrados en las tarjetas son estimados. La salida registra el total real y libera el espacio automáticamente.
          </p>
        </aside>
      </section>
    </div>
  )
}


