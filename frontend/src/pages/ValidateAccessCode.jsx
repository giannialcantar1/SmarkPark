import { useEffect, useMemo, useState } from 'react'

import { apiGet, apiPost, getCachedApiData } from '../lib/api'

const C = {
  card: 'var(--surface)',
  cardDeep: 'var(--surface2)',
  text: 'var(--text)',
  textSoft: 'var(--text-dim)',
  border: 'var(--border)',
  accent: 'var(--accent)',
  accent2: 'var(--accent2)',
  success: '#3fb950',
  danger: '#f85149',
}

const styles = {
  page: {
    width: '100%',
    maxWidth: 1440,
    margin: '0 auto',
    color: C.text,
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 18,
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  title: {
    margin: 0,
    fontSize: 'clamp(2rem, 4vw, 3rem)',
    fontWeight: 800,
    color: '#fff',
  },
  subtitle: { margin: '8px 0 0', color: C.textSoft, fontSize: 15 },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '9px 14px',
    borderRadius: 999,
    background: 'rgba(56,189,248,0.12)',
    border: '1px solid rgba(56,189,248,0.24)',
    color: '#bae6fd',
    fontWeight: 700,
    fontSize: 13,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(320px, 420px) minmax(0, 1fr)',
    gap: 18,
    alignItems: 'start',
  },
  stack: {
    display: 'grid',
    gap: 18,
  },
  card: {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 18,
    overflow: 'hidden',
  },
  cardHead: {
    padding: '18px 20px',
    borderBottom: `1px solid ${C.border}`,
  },
  cardTitle: { margin: 0, fontSize: 16, fontWeight: 700, color: '#fff' },
  cardSub: { margin: '6px 0 0', color: C.textSoft, fontSize: 12 },
  cardBody: { padding: 20 },
  formGrid: { display: 'grid', gap: 14 },
  label: { display: 'grid', gap: 7, fontSize: 13, fontWeight: 600, color: C.textSoft },
  input: {
    width: '100%',
    border: `1px solid ${C.border}`,
    background: C.cardDeep,
    borderRadius: 10,
    padding: '11px 13px',
    color: '#fff',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  codeInput: {
    width: '100%',
    border: `1px solid ${C.border}`,
    background: C.cardDeep,
    borderRadius: 12,
    padding: '16px 18px',
    color: '#fff',
    fontSize: 28,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    textAlign: 'center',
    letterSpacing: '0.24em',
    fontWeight: 800,
  },
  buttonPrimary: (disabled) => ({
    borderRadius: 10,
    border: 'none',
    background: disabled ? 'rgba(56,189,248,0.35)' : C.accent,
    color: '#042034',
    padding: '11px 18px',
    fontWeight: 800,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
  }),
  buttonGhost: {
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    background: C.cardDeep,
    color: C.textSoft,
    padding: '10px 14px',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  feedbackError: {
    borderRadius: 12,
    padding: '12px 14px',
    marginBottom: 14,
    background: 'rgba(248,81,73,0.12)',
    border: '1px solid rgba(248,81,73,0.28)',
    color: '#fecaca',
    fontWeight: 600,
    fontSize: 13,
  },
  feedbackOk: {
    borderRadius: 12,
    padding: '12px 14px',
    marginBottom: 14,
    background: 'rgba(63,185,80,0.12)',
    border: '1px solid rgba(63,185,80,0.28)',
    color: '#bbf7d0',
    fontWeight: 600,
    fontSize: 13,
  },
  listWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' },
  th: {
    textAlign: 'left',
    padding: '14px 18px',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: C.textSoft,
    borderBottom: `1px solid ${C.border}`,
    background: 'rgba(56,189,248,0.04)',
  },
  td: {
    padding: '14px 18px',
    fontSize: 13,
    color: '#fff',
    borderTop: '1px solid rgba(148,163,184,0.08)',
    verticalAlign: 'middle',
  },
  codeBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 94,
    padding: '8px 12px',
    borderRadius: 10,
    background: 'rgba(56,189,248,0.14)',
    color: '#bae6fd',
    border: '1px solid rgba(56,189,248,0.28)',
    fontWeight: 800,
    letterSpacing: '0.18em',
  },
  empty: { padding: 34, textAlign: 'center', color: C.textSoft, fontSize: 14 },
  resultBox: {
    display: 'grid',
    gap: 10,
    borderRadius: 14,
    padding: 16,
    background: 'rgba(56,189,248,0.08)',
    border: '1px solid rgba(56,189,248,0.2)',
  },
  resultRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    fontSize: 13,
  },
}

function Icon({ name, size = 18 }) {
  return (
    <span className="material-symbols-outlined" style={{ fontSize: size, lineHeight: 1 }}>
      {name}
    </span>
  )
}

function formatDateTime(value) {
  if (!value) return '--'
  const date = new Date(String(value).replace('Z', '+00:00'))
  if (Number.isNaN(date.getTime())) return '--'
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default function ValidateAccessCode() {
  const cachedVehicles = getCachedApiData('/api/vehiculos')
  const cachedPending = getCachedApiData('/api/access-codes/pending')
  const hasCache = Boolean(cachedVehicles && cachedPending)

  const [vehicles, setVehicles] = useState(() => (Array.isArray(cachedVehicles?.data) ? cachedVehicles.data : []))
  const [pendingCodes, setPendingCodes] = useState(() => (Array.isArray(cachedPending?.data) ? cachedPending.data : []))
  const [loading, setLoading] = useState(() => !hasCache)
  const [generating, setGenerating] = useState(false)
  const [validating, setValidating] = useState(false)
  const [vehicleId, setVehicleId] = useState('')
  const [expiresInMinutes, setExpiresInMinutes] = useState('30')
  const [codeInput, setCodeInput] = useState('')
  const [validatedResult, setValidatedResult] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = async ({ showLoader = true, forceFresh = true } = {}) => {
    if (showLoader) setLoading(true)
    try {
      const [vehiclesPayload, pendingPayload] = await Promise.all([
        apiGet('/api/vehiculos', { forceFresh }),
        apiGet('/api/access-codes/pending', { forceFresh }),
      ])
      setVehicles(Array.isArray(vehiclesPayload?.data) ? vehiclesPayload.data : [])
      setPendingCodes(Array.isArray(pendingPayload?.data) ? pendingPayload.data : [])
      setError('')
    } catch (err) {
      setError(err.message || 'No se pudo cargar el modulo de codigos de acceso.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load({ showLoader: !hasCache })
  }, [])

  const vehicleOptions = useMemo(
    () =>
      vehicles
        .map((vehicle) => ({
          id: vehicle.id,
          plate: String(vehicle.placa || vehicle.plate || '').trim().toUpperCase(),
          owner: vehicle.propietario || vehicle.owner_name || vehicle.owner || 'Sin propietario',
          model: vehicle.modelo || vehicle.model || 'Sin modelo',
        }))
        .sort((a, b) => a.plate.localeCompare(b.plate, 'es')),
    [vehicles],
  )

  const handleGenerate = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    setValidatedResult(null)

    if (!vehicleId) {
      setError('Selecciona un vehiculo para generar el codigo.')
      return
    }

    setGenerating(true)
    try {
      const response = await apiPost('/api/access-codes/generate', {
        vehicle_id: vehicleId,
        expires_in_minutes: Number(expiresInMinutes || 30),
      })
      const code = response?.data?.code || '------'
      setSuccess(`Codigo ${code} listo para acceso manual.`)
      await load({ showLoader: false, forceFresh: true })
    } catch (err) {
      setError(err.message || 'No se pudo generar el codigo de acceso.')
    } finally {
      setGenerating(false)
    }
  }

  const handleValidate = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    const normalizedCode = String(codeInput || '').replace(/\D/g, '').slice(0, 6)
    if (normalizedCode.length !== 6) {
      setError('Ingresa un codigo de 6 digitos.')
      return
    }

    setValidating(true)
    try {
      const response = await apiPost('/api/access-codes/validate', { code: normalizedCode })
      setValidatedResult(response?.data || null)
      setSuccess(response?.message || 'Codigo validado correctamente.')
      setCodeInput('')
      window.dispatchEvent(new CustomEvent('smartpark:data-refresh'))
      await load({ showLoader: false, forceFresh: true })
    } catch (err) {
      setError(err.message || 'No se pudo validar el codigo.')
    } finally {
      setValidating(false)
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Validar Acceso por Codigo</h1>
          <p style={styles.subtitle}>Genera codigos manuales de 6 digitos y valida el ingreso sin lector QR.</p>
        </div>
        <div style={styles.badge}>
          <Icon name="pin" size={16} />
          RF6 - Codigo manual
        </div>
      </header>

      {error && <div style={styles.feedbackError}>{error}</div>}
      {success && <div style={styles.feedbackOk}>{success}</div>}

      <section style={styles.grid}>
        <div style={styles.stack}>
          <div style={styles.card}>
            <div style={styles.cardHead}>
              <h2 style={styles.cardTitle}>Generar codigo</h2>
              <p style={styles.cardSub}>Crea un codigo unico para un vehiculo registrado.</p>
            </div>
            <div style={styles.cardBody}>
              <form onSubmit={handleGenerate} style={styles.formGrid}>
                <label style={styles.label}>
                  <span>Vehiculo registrado</span>
                  <select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} style={styles.input}>
                    <option value="">Selecciona un vehiculo</option>
                    {vehicleOptions.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.plate} - {vehicle.owner} - {vehicle.model}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={styles.label}>
                  <span>Vigencia</span>
                  <select value={expiresInMinutes} onChange={(event) => setExpiresInMinutes(event.target.value)} style={styles.input}>
                    <option value="15">15 minutos</option>
                    <option value="30">30 minutos</option>
                    <option value="60">1 hora</option>
                    <option value="120">2 horas</option>
                  </select>
                </label>

                <button type="submit" style={styles.buttonPrimary(generating)} disabled={generating}>
                  {generating ? 'Generando...' : 'Generar codigo'}
                </button>
              </form>
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.cardHead}>
              <h2 style={styles.cardTitle}>Validar codigo</h2>
              <p style={styles.cardSub}>Ingresa el codigo de 6 digitos para registrar la entrada.</p>
            </div>
            <div style={styles.cardBody}>
              <form onSubmit={handleValidate} style={styles.formGrid}>
                <label style={styles.label}>
                  <span>Codigo manual</span>
                  <input
                    value={codeInput}
                    onChange={(event) => setCodeInput(String(event.target.value || '').replace(/\D/g, '').slice(0, 6))}
                    style={styles.codeInput}
                    placeholder="000000"
                    inputMode="numeric"
                    maxLength={6}
                  />
                </label>

                <button type="submit" style={styles.buttonPrimary(validating)} disabled={validating}>
                  {validating ? 'Validando...' : 'Validar e ingresar'}
                </button>
              </form>
            </div>
          </div>
        </div>

        <div style={styles.stack}>
          <div style={styles.card}>
            <div style={styles.cardHead}>
              <h2 style={styles.cardTitle}>Codigos pendientes</h2>
              <p style={styles.cardSub}>Codigos activos listos para ser usados en porteria.</p>
            </div>
            <div style={styles.listWrap}>
              {loading ? (
                <div style={styles.empty}>Cargando codigos...</div>
              ) : pendingCodes.length === 0 ? (
                <div style={styles.empty}>No hay codigos pendientes.</div>
              ) : (
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ ...styles.th, width: '24%' }}>Codigo</th>
                      <th style={{ ...styles.th, width: '22%' }}>Placa</th>
                      <th style={{ ...styles.th, width: '30%' }}>Propietario</th>
                      <th style={{ ...styles.th, width: '24%' }}>Vence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingCodes.map((item) => (
                      <tr key={item.id}>
                        <td style={styles.td}>
                          <span style={styles.codeBadge}>{item.code}</span>
                        </td>
                        <td style={styles.td}>{item.plate || '--'}</td>
                        <td style={styles.td}>{item.owner_name || '--'}</td>
                        <td style={styles.td}>{formatDateTime(item.expires_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {validatedResult && (
            <div style={styles.card}>
              <div style={styles.cardHead}>
                <h2 style={styles.cardTitle}>Ultima validacion</h2>
                <p style={styles.cardSub}>Resumen del acceso registrado por codigo.</p>
              </div>
              <div style={styles.cardBody}>
                <div style={styles.resultBox}>
                  <div style={styles.resultRow}>
                    <span>Codigo</span>
                    <strong>{validatedResult.code || '--'}</strong>
                  </div>
                  <div style={styles.resultRow}>
                    <span>Placa</span>
                    <strong>{validatedResult.vehicle?.placa || '--'}</strong>
                  </div>
                  <div style={styles.resultRow}>
                    <span>Propietario</span>
                    <strong>{validatedResult.vehicle?.propietario || '--'}</strong>
                  </div>
                  <div style={styles.resultRow}>
                    <span>Entrada</span>
                    <strong>{formatDateTime(validatedResult.session?.entry_time || validatedResult.session?.entrada)}</strong>
                  </div>
                  <div style={styles.resultRow}>
                    <span>Espacio</span>
                    <strong>{validatedResult.space?.numero_mostrar || validatedResult.space?.codigo || '--'}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
