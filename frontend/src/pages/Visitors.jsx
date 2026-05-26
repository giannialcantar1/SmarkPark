import { useEffect, useMemo, useState } from 'react'

import { apiGet, apiPost, getCachedApiData } from '../lib/api'

const DURATIONS = ['1 hora', '2 horas', '3 horas', '4 horas', '6 horas', '8 horas', '12 horas', '24 horas']

const C = {
  card: 'var(--surface)',
  cardDeep: 'var(--surface2)',
  accent: 'var(--accent)',
  accent2: 'var(--accent2)',
  text: 'var(--text)',
  textSoft: 'var(--text-dim)',
  border: 'var(--border)',
  success: '#3fb950',
  danger: '#f85149',
  warning: '#f59e0b',
}

const INITIAL_FORM = {
  fullName: '',
  cedula: '',
  phone: '',
  plate: '',
  model: '',
  spaceId: '',
  duration: '2 horas',
  notes: '',
}

const normalizeText = (value) => String(value || '').trim()
const normalizePlate = (value) => normalizeText(value).toUpperCase()
const onlyDigits = (value, maxLength) => String(value || '').replace(/\D/g, '').slice(0, maxLength)
const PLATE_REGEX = /^[A-Z]{3}\d{4}$/

const formatPlateInput = (value) => {
  const raw = String(value || '').toUpperCase()
  let formatted = ''
  let letterCount = 0
  let digitCount = 0
  for (const char of raw) {
    if (letterCount < 3 && /[A-Z]/.test(char)) {
      formatted += char
      letterCount += 1
    } else if (letterCount === 3 && digitCount < 4 && /[0-9]/.test(char)) {
      formatted += char
      digitCount += 1
    }
    if (letterCount === 3 && digitCount === 4) break
  }
  return formatted
}

const parseDate = (value) => {
  if (!value) return null
  const date = new Date(String(value).replace('Z', '+00:00'))
  return Number.isNaN(date.getTime()) ? null : date
}

const formatDateTime = (value) => {
  const date = parseDate(value)
  if (!date) return '--'
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const formatDuration = (value) => {
  const start = parseDate(value)
  if (!start) return '--'
  const diffMs = Date.now() - start.getTime()
  if (diffMs <= 0) return '--'
  const totalMinutes = Math.floor(diffMs / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (!hours) return `${minutes} min`
  if (!minutes) return `${hours}h`
  return `${hours}h ${minutes}m`
}

const durationToMinutes = (value) => {
  const normalized = normalizeText(value).toLowerCase()
  const amount = Number.parseInt(normalized, 10)
  if (Number.isNaN(amount)) return 120
  if (normalized.includes('24')) return 24 * 60
  if (normalized.includes('12')) return 12 * 60
  if (normalized.includes('8')) return 8 * 60
  if (normalized.includes('6')) return 6 * 60
  if (normalized.includes('4')) return 4 * 60
  if (normalized.includes('3')) return 3 * 60
  if (normalized.includes('2')) return 2 * 60
  return amount * 60
}

const normalizeSpace = (space = {}) => ({
  id: String(space.id || ''),
  label: space.numero_mostrar || space.codigo || space.nombre || 'Sin espacio',
  floor: space.piso || space.nivel || space.nivel_mostrar || space.floor || '',
  occupied:
    Boolean(space.ocupado || space.occupied) ||
    ['ocupado', 'occupied'].includes(String(space.estado || space.status || '').toLowerCase()),
})

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
    gap: 20,
    alignItems: 'flex-start',
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  title: {
    margin: 0,
    fontSize: 'clamp(2rem, 4vw, 3rem)',
    fontWeight: 800,
    color: '#fff',
    lineHeight: 1.05,
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
  metrics: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 14,
    marginBottom: 18,
  },
  metricCard: (accent) => ({
    background: C.card,
    border: `1px solid ${C.border}`,
    borderLeft: `3px solid ${accent}`,
    borderRadius: 16,
    padding: 18,
  }),
  metricLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: C.textSoft,
    fontWeight: 700,
    marginBottom: 10,
  },
  metricValue: {
    fontSize: 'clamp(1.8rem, 3vw, 2.4rem)',
    fontWeight: 800,
    color: '#fff',
    lineHeight: 1,
  },
  metricSub: { marginTop: 8, color: C.textSoft, fontSize: 12 },
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(320px, 420px) minmax(0, 1fr)',
    gap: 18,
    alignItems: 'start',
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
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardTitle: { margin: 0, fontSize: 16, fontWeight: 700, color: '#fff' },
  cardSub: { margin: '6px 0 0', color: C.textSoft, fontSize: 12 },
  cardBody: { padding: 20 },
  helperText: {
    margin: '8px 2px 0',
    color: C.textSoft,
    fontSize: 12,
    lineHeight: 1.4,
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 14,
  },
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
  textarea: {
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
    minHeight: 84,
    resize: 'vertical',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  buttonGhost: {
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    background: C.cardDeep,
    color: C.textSoft,
    padding: '11px 16px',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
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
  visitorTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 9px',
    borderRadius: 999,
    background: 'rgba(245,158,11,0.14)',
    border: '1px solid rgba(245,158,11,0.28)',
    color: '#fcd34d',
    fontSize: 11,
    fontWeight: 800,
  },
  exitButton: (disabled) => ({
    borderRadius: 9,
    border: `1px solid ${disabled ? 'rgba(148,163,184,0.18)' : 'rgba(248,81,73,0.32)'}`,
    background: disabled ? 'rgba(15,23,42,0.42)' : 'rgba(248,81,73,0.12)',
    color: disabled ? 'rgba(148,163,184,0.72)' : '#fda4af',
    padding: '9px 12px',
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
  }),
  empty: { padding: 34, textAlign: 'center', color: C.textSoft, fontSize: 14 },
}

function Icon({ name, size = 18 }) {
  return (
    <span className="material-symbols-outlined" style={{ fontSize: size, lineHeight: 1 }}>
      {name}
    </span>
  )
}

export default function Visitors() {
  const cachedVisitors = getCachedApiData('/api/visitantes/activos')
  const cachedHistory = getCachedApiData('/api/visitantes/historial')
  const cachedSpaces = getCachedApiData('/api/parking-spaces')
  const hasCache = Boolean(cachedVisitors && cachedHistory && cachedSpaces)

  const [visitors, setVisitors] = useState(() => (Array.isArray(cachedVisitors?.data) ? cachedVisitors.data : []))
  const [visitorHistory, setVisitorHistory] = useState(() => (Array.isArray(cachedHistory?.data) ? cachedHistory.data : []))
  const [spaces, setSpaces] = useState(() =>
    (Array.isArray(cachedSpaces?.data) ? cachedSpaces.data : []).map(normalizeSpace),
  )
  const [form, setForm] = useState(INITIAL_FORM)
  const [loading, setLoading] = useState(() => !hasCache)
  const [saving, setSaving] = useState(false)
  const [exitingPlate, setExitingPlate] = useState('')
  const [autofillPlate, setAutofillPlate] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = async ({ showLoader = true, forceFresh = true } = {}) => {
    if (showLoader) setLoading(true)
    setError('')
    try {
      const [visitorsPayload, historyPayload, spacesPayload] = await Promise.all([
        apiGet('/api/visitantes/activos', { forceFresh }),
        apiGet('/api/visitantes/historial', { forceFresh }),
        apiGet('/api/parking-spaces', { forceFresh }),
      ])
      setVisitors(Array.isArray(visitorsPayload?.data) ? visitorsPayload.data : [])
      setVisitorHistory(Array.isArray(historyPayload?.data) ? historyPayload.data : [])
      setSpaces((Array.isArray(spacesPayload?.data) ? spacesPayload.data : []).map(normalizeSpace))
    } catch (err) {
      setError(err.message || 'No se pudo cargar el modulo de visitantes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load({ showLoader: !hasCache })

    const intervalId = window.setInterval(() => {
      load({ showLoader: false, forceFresh: true })
    }, 5000)

    const handleRefresh = () => load({ showLoader: false, forceFresh: true })
    window.addEventListener('smartpark:data-refresh', handleRefresh)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('smartpark:data-refresh', handleRefresh)
    }
  }, [])

  const availableSpaces = useMemo(
    () => spaces.filter((space) => !space.occupied),
    [spaces],
  )

  const visibleSpaces = useMemo(
    () => [...spaces].sort((a, b) => String(a.label || '').localeCompare(String(b.label || ''), 'es', { numeric: true })),
    [spaces],
  )

  const activeVisitors = useMemo(
    () =>
      visitors
        .filter((visitor) => String(visitor.status || visitor.estado || '').toLowerCase() === 'dentro')
        .map((visitor) => {
          const space = spaces.find((item) => String(item.id) === String(visitor.espacio_id || visitor.space_id || ''))
          return {
            ...visitor,
            plate: normalizePlate(visitor.placa || visitor.plate),
            owner: normalizeText(visitor.nombre || visitor.owner_name || visitor.owner),
            model: normalizeText(visitor.modelo || visitor.model) || 'Vehiculo temporal',
            spaceLabel: space?.label || visitor.espacio || visitor.space_label || 'Sin espacio',
            entry: visitor.entrada || visitor.entry_time || visitor.created_at,
          }
        })
        .sort((a, b) => (parseDate(b.entry)?.getTime() || 0) - (parseDate(a.entry)?.getTime() || 0)),
    [spaces, visitors],
  )

  const recentVisitors = useMemo(() => {
    const latestByPlate = new Map()

    visitorHistory.forEach((visitor) => {
      const plate = normalizePlate(visitor.placa || visitor.plate)
      if (!plate || latestByPlate.has(plate)) return

      const space = spaces.find((item) => String(item.id) === String(visitor.espacio_id || visitor.space_id || ''))
      latestByPlate.set(plate, {
        ...visitor,
        plate,
        owner: normalizeText(visitor.nombre || visitor.owner_name || visitor.owner),
        model: normalizeText(visitor.modelo || visitor.model) || 'Vehiculo temporal',
        cedula: normalizeText(visitor.cedula),
        phone: normalizeText(visitor.telefono),
        notes: normalizeText(visitor.notas),
        spaceLabel: space?.label || visitor.espacio || visitor.space_label || 'Sin espacio',
        lastEntry: visitor.entrada || visitor.entry_time || visitor.created_at,
        lastExit: visitor.salida || visitor.exit_time || null,
      })
    })

    return [...latestByPlate.values()]
  }, [spaces, visitorHistory])

  const knownVisitorByPlate = useMemo(
    () =>
      recentVisitors.reduce((accumulator, visitor) => {
        accumulator[visitor.plate] = visitor
        return accumulator
      }, {}),
    [recentVisitors],
  )

  const metrics = useMemo(() => {
    return {
      activeVisitors: activeVisitors.length,
      freeSpaces: availableSpaces.length,
      occupiedByVisitors: activeVisitors.filter((vehicle) => vehicle.spaceLabel !== 'Sin espacio').length,
    }
  }, [activeVisitors, availableSpaces])

  const handleChange = (field) => (event) => {
    const value = event.target.value
    if (field === 'cedula') {
      setForm((current) => ({ ...current, cedula: onlyDigits(value, 11) }))
      return
    }
    if (field === 'phone') {
      setForm((current) => ({ ...current, phone: onlyDigits(value, 10) }))
      return
    }
    setForm((current) => ({ ...current, [field]: value }))
  }

  const applyKnownVisitor = (visitor) => {
    if (!visitor) return

    setForm((current) => ({
      ...current,
      fullName: visitor.owner || current.fullName,
      cedula: visitor.cedula || current.cedula,
      phone: visitor.phone || current.phone,
      plate: visitor.plate || current.plate,
      model: visitor.model || current.model,
      notes: visitor.notes || current.notes,
    }))
    setAutofillPlate(visitor.plate || '')
    setError('')
    setSuccess(`Datos cargados para ${visitor.plate}. Solo selecciona espacio y registra la entrada.`)
  }

  const handlePlateChange = (event) => {
    const nextPlate = formatPlateInput(event.target.value)
    setForm((current) => ({ ...current, plate: nextPlate }))

    if (!PLATE_REGEX.test(nextPlate)) {
      setAutofillPlate('')
      return
    }

    const knownVisitor = knownVisitorByPlate[nextPlate]
    if (knownVisitor) {
      applyKnownVisitor(knownVisitor)
    } else {
      setAutofillPlate('')
    }
  }

  const resetForm = () => {
    setForm(INITIAL_FORM)
    setAutofillPlate('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!normalizeText(form.fullName)) return setError('El nombre del visitante es obligatorio.')
    if (!normalizePlate(form.plate)) return setError('La placa es obligatoria.')
    if (!PLATE_REGEX.test(normalizePlate(form.plate))) {
      return setError('La placa debe tener el formato ABC1234.')
    }
    if (form.cedula && form.cedula.length !== 11) {
      return setError('La cedula debe tener 11 digitos.')
    }
    if (form.phone && form.phone.length !== 10) {
      return setError('El telefono debe tener 10 digitos.')
    }
    if (!form.spaceId) return setError('Selecciona un espacio temporal.')
    const selectedSpace = spaces.find((space) => space.id === String(form.spaceId))
    if (selectedSpace?.occupied) {
      return setError('Ese espacio esta ocupado. Selecciona uno libre.')
    }

    setSaving(true)
    try {
      await apiPost('/api/visitantes/entrada', {
        nombre: normalizeText(form.fullName),
        cedula: normalizeText(form.cedula),
        telefono: normalizeText(form.phone),
        placa: normalizePlate(form.plate),
        modelo: normalizeText(form.model),
        espacio_id: form.spaceId,
        duracion_estimada: durationToMinutes(form.duration),
        notas: normalizeText(form.notes),
      })

      setSuccess('Visitante registrado correctamente.')
      resetForm()
      window.dispatchEvent(new CustomEvent('smartpark:data-refresh'))
      load({ showLoader: false, forceFresh: true })
    } catch (err) {
      setError(err.message || 'No se pudo registrar el visitante.')
    } finally {
      setSaving(false)
    }
  }

  const handleExit = async (plate) => {
    setError('')
    setSuccess('')
    setExitingPlate(plate)
    try {
      await apiPost('/api/visitantes/salida', { placa: plate })
      setSuccess(`Salida registrada para ${plate}.`)
      window.dispatchEvent(new CustomEvent('smartpark:data-refresh'))
      load({ showLoader: false, forceFresh: true })
    } catch (err) {
      setError(err.message || 'No se pudo registrar la salida del visitante.')
    } finally {
      setExitingPlate('')
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Visitantes</h1>
          <p style={styles.subtitle}>Registro temporal de visitantes, entradas, salidas y ocupacion activa.</p>
        </div>
      </header>

      <section style={styles.metrics}>
        <article style={styles.metricCard(C.warning)}>
          <div style={styles.metricLabel}>Visitantes activos</div>
          <div style={styles.metricValue}>{loading ? '--' : metrics.activeVisitors}</div>
          <div style={styles.metricSub}>Actualmente dentro del garaje.</div>
        </article>
        <article style={styles.metricCard(C.success)}>
          <div style={styles.metricLabel}>Espacios libres</div>
          <div style={styles.metricValue}>{loading ? '--' : metrics.freeSpaces}</div>
          <div style={styles.metricSub}>Disponibles para parqueo temporal.</div>
        </article>
        <article style={styles.metricCard(C.accent)}>
          <div style={styles.metricLabel}>Parqueos temporales</div>
          <div style={styles.metricValue}>{loading ? '--' : metrics.occupiedByVisitors}</div>
          <div style={styles.metricSub}>Visitantes con espacio asignado.</div>
        </article>
      </section>

      {error && <div style={styles.feedbackError}>{error}</div>}
      {success && <div style={styles.feedbackOk}>{success}</div>}

      <section style={styles.layout}>
        <div style={styles.card}>
          <div style={styles.cardHead}>
            <div>
              <h2 style={styles.cardTitle}>Registrar visitante</h2>
              <p style={styles.cardSub}>Nombre, vehiculo, hora y espacio temporal.</p>
            </div>
          </div>
          <div style={styles.cardBody}>
            <form onSubmit={handleSubmit} style={styles.formGrid}>
              <label style={styles.label}>
                <span>Nombre del visitante</span>
                <input value={form.fullName} onChange={handleChange('fullName')} style={styles.input} placeholder="Ej: Juan Perez" />
              </label>

              <label style={styles.label}>
                <span>Cedula</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.cedula}
                  onChange={handleChange('cedula')}
                  style={styles.input}
                  placeholder="Opcional"
                  maxLength={11}
                  minLength={11}
                />
              </label>

              <label style={styles.label}>
                <span>Telefono</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={form.phone}
                  onChange={handleChange('phone')}
                  style={styles.input}
                  placeholder="Opcional"
                  maxLength={10}
                  minLength={10}
                />
              </label>

              <label style={styles.label}>
                <span>Placa</span>
                <input
                  value={form.plate}
                  onChange={handlePlateChange}
                  style={styles.input}
                  placeholder="ABC1234"
                  maxLength={7}
                  pattern="[A-Z]{3}[0-9]{4}"
                  title="La placa debe tener 3 letras y 4 numeros. Ejemplo: ABC1234"
                />
                {autofillPlate && (
                  <span style={styles.helperText}>
                    Placa conocida. Se cargaron los datos anteriores para no registrar al visitante de nuevo.
                  </span>
                )}
              </label>

              <label style={styles.label}>
                <span>Vehiculo</span>
                <input value={form.model} onChange={handleChange('model')} style={styles.input} placeholder="Ej: Kia K5 gris" />
              </label>

              <label style={styles.label}>
                <span>Espacio temporal</span>
                <select value={form.spaceId} onChange={handleChange('spaceId')} style={styles.input}>
                  <option value="">{visibleSpaces.length ? 'Seleccione un espacio' : 'No hay espacios cargados'}</option>
                  {visibleSpaces.map((space) => (
                    <option key={space.id} value={space.id} disabled={space.occupied}>
                      {space.label}{space.floor ? ` - Piso ${space.floor}` : ''} - {space.occupied ? 'Ocupado' : 'Libre'}
                    </option>
                  ))}
                </select>
                {!loading && visibleSpaces.length === 0 && (
                  <span style={styles.helperText}>
                    No llegaron espacios para este garaje. Recarga la sesion o verifica que tu usuario tenga `garage_id`.
                  </span>
                )}
              </label>

              <label style={styles.label}>
                <span>Duracion estimada</span>
                <select value={form.duration} onChange={handleChange('duration')} style={styles.input}>
                  {DURATIONS.map((duration) => (
                    <option key={duration} value={duration}>{duration}</option>
                  ))}
                </select>
              </label>

              <label style={styles.label}>
                <span>Notas</span>
                <textarea value={form.notes} onChange={handleChange('notes')} style={styles.textarea} placeholder="Motivo de visita, observaciones, unidad..." />
              </label>

              <div style={styles.actions}>
                <button type="button" style={styles.buttonGhost} onClick={resetForm}>
                  Limpiar
                </button>
                <button type="submit" style={styles.buttonPrimary(saving)} disabled={saving}>
                  {saving ? 'Registrando...' : 'Registrar visitante'}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 18 }}>
          <div style={styles.card}>
            <div style={styles.cardHead}>
              <div>
                <h2 style={styles.cardTitle}>Visitantes activos</h2>
                <p style={styles.cardSub}>Listado temporal con entrada activa y opcion para registrar la salida.</p>
              </div>
              <div style={styles.visitorTag}>
                <Icon name="schedule" size={14} />
                {loading ? '--' : `${activeVisitors.length} activos`}
              </div>
            </div>

            <div style={styles.listWrap}>
              {loading ? (
                <div style={styles.empty}>Cargando visitantes...</div>
              ) : activeVisitors.length === 0 ? (
                <div style={styles.empty}>No hay visitantes activos en este momento.</div>
              ) : (
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ ...styles.th, width: '21%' }}>Visitante</th>
                      <th style={{ ...styles.th, width: '16%' }}>Placa</th>
                      <th style={{ ...styles.th, width: '20%' }}>Espacio</th>
                      <th style={{ ...styles.th, width: '18%' }}>Entrada</th>
                      <th style={{ ...styles.th, width: '13%' }}>Tiempo</th>
                      <th style={{ ...styles.th, width: '12%' }}>Registrar salida</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeVisitors.map((visitor) => (
                      <tr key={visitor.id || visitor.plate}>
                        <td style={styles.td}>
                          <div style={{ display: 'grid', gap: 5 }}>
                            <strong>{visitor.owner || 'Visitante temporal'}</strong>
                            <span style={styles.visitorTag}>Visitante</span>
                          </div>
                        </td>
                        <td style={styles.td}>{visitor.plate}</td>
                        <td style={styles.td}>{visitor.spaceLabel}</td>
                        <td style={styles.td}>{formatDateTime(visitor.entry)}</td>
                        <td style={styles.td}>{formatDuration(visitor.entry)}</td>
                        <td style={styles.td}>
                          <button
                            type="button"
                            style={styles.exitButton(exitingPlate === visitor.plate)}
                            onClick={() => handleExit(visitor.plate)}
                            disabled={exitingPlate === visitor.plate}
                          >
                            {exitingPlate === visitor.plate ? 'Procesando...' : 'Dar salida'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.cardHead}>
              <div>
                <h2 style={styles.cardTitle}>Historial reciente</h2>
                <p style={styles.cardSub}>Vehiculos ya registrados. Puedes reutilizar su placa y datos al volver a entrar.</p>
              </div>
              <div style={styles.visitorTag}>
                <Icon name="history" size={14} />
                {loading ? '--' : `${recentVisitors.length} placas`}
              </div>
            </div>

            <div style={styles.listWrap}>
              {loading ? (
                <div style={styles.empty}>Cargando historial...</div>
              ) : recentVisitors.length === 0 ? (
                <div style={styles.empty}>Todavia no hay historial de visitantes.</div>
              ) : (
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ ...styles.th, width: '24%' }}>Visitante</th>
                      <th style={{ ...styles.th, width: '16%' }}>Placa</th>
                      <th style={{ ...styles.th, width: '16%' }}>Vehiculo</th>
                      <th style={{ ...styles.th, width: '18%' }}>Ultima entrada</th>
                      <th style={{ ...styles.th, width: '14%' }}>Ultima salida</th>
                      <th style={{ ...styles.th, width: '12%' }}>Reusar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentVisitors.slice(0, 8).map((visitor) => (
                      <tr key={`history-${visitor.plate}`}>
                        <td style={styles.td}>{visitor.owner || 'Visitante temporal'}</td>
                        <td style={styles.td}>{visitor.plate}</td>
                        <td style={styles.td}>{visitor.model}</td>
                        <td style={styles.td}>{formatDateTime(visitor.lastEntry)}</td>
                        <td style={styles.td}>{visitor.lastExit ? formatDateTime(visitor.lastExit) : '--'}</td>
                        <td style={styles.td}>
                          <button
                            type="button"
                            style={styles.buttonGhost}
                            onClick={() => applyKnownVisitor(visitor)}
                          >
                            Reusar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
