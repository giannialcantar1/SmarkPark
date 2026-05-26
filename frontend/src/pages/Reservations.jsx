import { useEffect, useMemo, useState } from 'react'

import { apiGet, apiPost } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

const styles = {
  page: { width: '100%', maxWidth: 1440, margin: '0 auto', color: '#e5eefb' },
  header: { display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 22 },
  title: { margin: 0, color: '#fff', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800 },
  subtitle: { margin: '8px 0 0', color: '#94a3b8', fontSize: 15, maxWidth: 760 },
  badge: { borderRadius: 999, padding: '9px 14px', background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.26)', color: '#bae6fd', fontWeight: 800, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8 },
  layout: { display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) minmax(0, 1fr)', gap: 18, alignItems: 'start' },
  card: { borderRadius: 20, border: '1px solid rgba(148,163,184,0.16)', background: 'rgba(15,23,42,0.78)', overflow: 'hidden' },
  cardHead: { padding: '18px 20px', borderBottom: '1px solid rgba(148,163,184,0.12)' },
  cardTitle: { margin: 0, color: '#fff', fontSize: 17, fontWeight: 800 },
  cardSub: { margin: '6px 0 0', color: '#94a3b8', fontSize: 13 },
  cardBody: { padding: 20 },
  form: { display: 'grid', gap: 14 },
  label: { display: 'grid', gap: 8, color: '#a8bee0', fontSize: 13, fontWeight: 700 },
  input: { width: '100%', boxSizing: 'border-box', borderRadius: 12, border: '1px solid rgba(148,163,184,0.18)', background: 'rgba(2,6,23,0.42)', color: '#fff', padding: '11px 13px', fontFamily: 'inherit', outline: 'none' },
  button: (variant = 'primary', disabled = false) => ({ borderRadius: 12, border: variant === 'ghost' ? '1px solid rgba(148,163,184,0.18)' : 'none', background: disabled ? 'rgba(56,189,248,0.16)' : variant === 'ghost' ? 'rgba(15,23,42,0.6)' : 'linear-gradient(135deg, #0284c7, #38bdf8)', color: variant === 'ghost' ? '#cbd5e1' : '#04111f', padding: '11px 16px', fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }),
  feedbackOk: { borderRadius: 14, padding: '12px 16px', marginBottom: 16, background: 'rgba(22,101,52,0.26)', border: '1px solid rgba(74,222,128,0.28)', color: '#bbf7d0', fontWeight: 700 },
  feedbackError: { borderRadius: 14, padding: '12px 16px', marginBottom: 16, background: 'rgba(127,29,29,0.28)', border: '1px solid rgba(248,113,113,0.28)', color: '#fecaca', fontWeight: 700 },
  hint: { borderRadius: 14, padding: '12px 14px', background: 'rgba(8,47,73,0.28)', border: '1px solid rgba(56,189,248,0.18)', color: '#bae6fd', fontSize: 13, lineHeight: 1.5 },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '13px 18px', color: '#94a3b8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(148,163,184,0.12)' },
  td: { padding: '14px 18px', color: '#fff', fontSize: 13, borderTop: '1px solid rgba(148,163,184,0.08)' },
  status: (status) => ({
    display: 'inline-flex',
    padding: '6px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    background: status === 'cancelado' ? 'rgba(127,29,29,0.28)' : status === 'activo' ? 'rgba(8,47,73,0.28)' : 'rgba(180,83,9,0.24)',
    color: status === 'cancelado' ? '#fecaca' : status === 'activo' ? '#bae6fd' : '#fde68a',
    border: `1px solid ${status === 'cancelado' ? 'rgba(248,113,113,0.28)' : status === 'activo' ? 'rgba(56,189,248,0.22)' : 'rgba(245,158,11,0.28)'}`,
  }),
  empty: { padding: 30, color: '#94a3b8', textAlign: 'center' },
  actionRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
}

const formatDateTime = (value) => {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return new Intl.DateTimeFormat('es-DO', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date)
}

const formatPlateInput = (value) => {
  const raw = String(value || '').toUpperCase()
  let plate = ''
  let letterCount = 0
  let digitCount = 0
  for (const char of raw) {
    if (letterCount < 3 && /[A-Z]/.test(char)) {
      plate += char
      letterCount += 1
    } else if (letterCount === 3 && digitCount < 4 && /[0-9]/.test(char)) {
      plate += char
      digitCount += 1
    }
    if (letterCount === 3 && digitCount === 4) break
  }
  return plate
}

export default function Reservations() {
  const { user } = useAuth()
  const [vehicles, setVehicles] = useState([])
  const [reservations, setReservations] = useState([])
  const [availableSpaces, setAvailableSpaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [actingId, setActingId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({
    vehicle_id: '',
    placa: '',
    fecha_entrada: '',
    fecha_salida: '',
    espacio_id: '',
  })

  const currentUserId = String(user?.id || '')

  const load = async ({ showLoader = true } = {}) => {
    if (!currentUserId) return
    if (showLoader) setLoading(true)
    try {
      const [vehiclesPayload, reservationsPayload] = await Promise.all([
        apiGet('/api/vehiculos', { forceFresh: true }),
        apiGet(`/api/reservas/user/${currentUserId}`, { forceFresh: true }),
      ])
      setVehicles(Array.isArray(vehiclesPayload?.data) ? vehiclesPayload.data : [])
      setReservations(Array.isArray(reservationsPayload?.data) ? reservationsPayload.data : [])
      setError('')
    } catch (err) {
      setError(err.message || 'No se pudo cargar el modulo de reservas.')
    } finally {
      setLoading(false)
    }
  }

  const loadAvailability = async (startValue, endValue) => {
    if (!startValue || !endValue) {
      setAvailableSpaces([])
      return
    }
    try {
      const params = new URLSearchParams({ fecha_entrada: new Date(startValue).toISOString(), fecha_salida: new Date(endValue).toISOString() })
      const payload = await apiGet(`/api/reservas/disponibles?${params.toString()}`, { forceFresh: true })
      setAvailableSpaces(Array.isArray(payload?.data) ? payload.data : [])
    } catch (err) {
      setAvailableSpaces([])
      setError(err.message || 'No se pudo consultar los espacios disponibles.')
    }
  }

  useEffect(() => {
    load()
  }, [currentUserId])

  useEffect(() => {
    loadAvailability(form.fecha_entrada, form.fecha_salida)
  }, [form.fecha_entrada, form.fecha_salida])

  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => String(vehicle.id) === String(form.vehicle_id)),
    [form.vehicle_id, vehicles],
  )

  useEffect(() => {
    if (selectedVehicle) {
      setForm((cur) => ({
        ...cur,
        placa: formatPlateInput(selectedVehicle.placa || selectedVehicle.plate),
      }))
    }
  }, [selectedVehicle])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    if (!/^[A-Z]{3}[0-9]{4}$/.test(form.placa)) {
      setError('La placa debe tener 3 letras y 4 numeros. Ejemplo: ABC1234.')
      setSaving(false)
      return
    }
    try {
      await apiPost('/api/reservas/crear', {
        user_id: currentUserId,
        vehicle_id: form.vehicle_id || null,
        placa: form.placa,
        espacio_id: form.espacio_id,
        fecha_entrada: new Date(form.fecha_entrada).toISOString(),
        fecha_salida: new Date(form.fecha_salida).toISOString(),
      })
      setSuccess('Reserva creada correctamente.')
      setForm({ vehicle_id: '', placa: '', fecha_entrada: '', fecha_salida: '', espacio_id: '' })
      setAvailableSpaces([])
      await load({ showLoader: false })
    } catch (err) {
      setError(err.message || 'No se pudo crear la reserva.')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = async (reservationId) => {
    setActingId(String(reservationId))
    setError('')
    setSuccess('')
    try {
      await apiPost(`/api/reservas/${reservationId}/cancelar`)
      setSuccess('Reserva cancelada correctamente.')
      await load({ showLoader: false })
    } catch (err) {
      setError(err.message || 'No se pudo cancelar la reserva.')
    } finally {
      setActingId('')
    }
  }

  const handleConvert = async (reservationId) => {
    setActingId(String(reservationId))
    setError('')
    setSuccess('')
    try {
      await apiPost(`/api/reservas/${reservationId}/convertir-entrada`)
      setSuccess('Reserva convertida en entrada correctamente.')
      await load({ showLoader: false })
    } catch (err) {
      setError(err.message || 'No se pudo convertir la reserva en entrada.')
    } finally {
      setActingId('')
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Reservas</h1>
          <p style={styles.subtitle}>Programa espacios con hasta 48 horas de anticipacion, valida disponibilidad y convierte la reserva en entrada cuando llega el vehiculo.</p>
        </div>
      </header>

      {error && <div style={styles.feedbackError}>{error}</div>}
      {success && <div style={styles.feedbackOk}>{success}</div>}

      <section style={styles.layout}>
        <div style={styles.card}>
          <div style={styles.cardHead}>
            <h2 style={styles.cardTitle}>Crear reserva</h2>
            <p style={styles.cardSub}>Escoge un vehiculo, define el rango de tiempo y aparta un espacio libre.</p>
          </div>
          <div style={styles.cardBody}>
            <form style={styles.form} onSubmit={handleSubmit}>
              <label style={styles.label}>
                <span>Vehiculo</span>
                <select value={form.vehicle_id} onChange={(event) => setForm((cur) => ({ ...cur, vehicle_id: event.target.value }))} style={styles.input}>
                  <option value="">Selecciona un vehiculo</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {(vehicle.placa || vehicle.plate || '--')} - {(vehicle.modelo || vehicle.model || 'Sin modelo')}
                    </option>
                  ))}
                </select>
              </label>

              <label style={styles.label}>
                <span>Placa</span>
                <input
                  value={form.placa}
                  onChange={(event) => setForm((cur) => ({ ...cur, placa: formatPlateInput(event.target.value) }))}
                  style={styles.input}
                  placeholder="ABC1234"
                  maxLength={7}
                  pattern="[A-Z]{3}[0-9]{4}"
                  title="La placa debe tener 3 letras y 4 numeros. Ejemplo: ABC1234"
                />
              </label>

              <label style={styles.label}>
                <span>Fecha y hora de entrada</span>
                <input type="datetime-local" value={form.fecha_entrada} onChange={(event) => setForm((cur) => ({ ...cur, fecha_entrada: event.target.value }))} style={styles.input} />
              </label>

              <label style={styles.label}>
                <span>Fecha y hora de salida</span>
                <input type="datetime-local" value={form.fecha_salida} onChange={(event) => setForm((cur) => ({ ...cur, fecha_salida: event.target.value }))} style={styles.input} />
              </label>

              <label style={styles.label}>
                <span>Espacio disponible</span>
                <select value={form.espacio_id} onChange={(event) => setForm((cur) => ({ ...cur, espacio_id: event.target.value }))} style={styles.input}>
                  <option value="">Selecciona un espacio</option>
                  {availableSpaces.map((space) => (
                    <option key={space.id} value={space.id}>
                      {(space.numero_mostrar || space.codigo || space.numero || '--')} - Piso {(space.piso || space.floor || '--')}
                    </option>
                  ))}
                </select>
              </label>

              <button type="submit" style={styles.button('primary', saving)} disabled={saving || !form.fecha_entrada || !form.fecha_salida || !form.espacio_id || !form.placa}>
                {saving ? 'Reservando...' : 'Crear reserva'}
              </button>
            </form>

            <div style={{ height: 14 }} />
            <div style={styles.hint}>
              El sistema solo permite reservar con un maximo de 48 horas de anticipacion y bloquea espacios ya reservados en el mismo rango.
            </div>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHead}>
            <h2 style={styles.cardTitle}>Mis reservas</h2>
            <p style={styles.cardSub}>Consulta tus reservas futuras, activas y canceladas.</p>
          </div>
          <div style={styles.tableWrap}>
            {loading ? (
              <div style={styles.empty}>Cargando reservas...</div>
            ) : reservations.length === 0 ? (
              <div style={styles.empty}>Todavia no tienes reservas registradas.</div>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Placa</th>
                    <th style={styles.th}>Espacio</th>
                    <th style={styles.th}>Entrada</th>
                    <th style={styles.th}>Salida</th>
                    <th style={styles.th}>Estado</th>
                    <th style={styles.th}>Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.map((reservation) => (
                    <tr key={reservation.id}>
                      <td style={styles.td}>{reservation.placa || '--'}</td>
                      <td style={styles.td}>{reservation.espacio_codigo || '--'}</td>
                      <td style={styles.td}>{formatDateTime(reservation.fecha_entrada)}</td>
                      <td style={styles.td}>{formatDateTime(reservation.fecha_salida)}</td>
                      <td style={styles.td}><span style={styles.status(reservation.status)}>{reservation.status}</span></td>
                      <td style={styles.td}>
                        <div style={styles.actionRow}>
                          {reservation.status === 'reservado' && (
                            <button type="button" style={styles.button('ghost', actingId === String(reservation.id))} disabled={actingId === String(reservation.id)} onClick={() => handleConvert(reservation.id)}>
                              Convertir entrada
                            </button>
                          )}
                          {reservation.status === 'reservado' && (
                            <button type="button" style={styles.button('ghost', actingId === String(reservation.id))} disabled={actingId === String(reservation.id)} onClick={() => handleCancel(reservation.id)}>
                              Cancelar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
