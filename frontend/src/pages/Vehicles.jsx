import { useEffect, useMemo, useState } from 'react'

import NotificationsBell from '../components/NotificationsBell'
import { apiGet, apiPost, apiPut, getCachedApiData } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { ROLES, normalizeRole } from '../lib/roles'

/* --- constants --------------------------------------------- */
const PAGE_SIZE = 4

const ESTADOS_FILTRO = [
  { key: 'todos',  label: 'Todos' },
  { key: 'dentro', label: 'Estacionados' },
  { key: 'fuera',  label: 'Ausentes' },
]

/* --- helpers ----------------------------------------------- */
const formatDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('es-DO', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(date)
}

const normalizeEstado = (value) => {
  const estado = String(value || '').trim().toLowerCase()
  if (estado === 'dentro') return { key: 'dentro', label: 'Estacionado' }
  return { key: 'fuera', label: 'Ausente' }
}

const formatMoney = (value) => {
  const amount = Number(value || 0)
  return new Intl.NumberFormat('es-DO', {
    style: 'currency', currency: 'DOP', minimumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)
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

const formatDurationBreakdown = (minutes) => {
  const total = Math.max(0, Number(minutes || 0))
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h <= 0) return `${m} min`
  if (m <= 0) return `${h} h`
  return `${h} h ${m} min`
}

const getVehicleDurationMinutes = (vehicle) => {
  const stored = Number(vehicle.duration_minutes ?? vehicle.duracion ?? vehicle.tiempo_total_minutos ?? 0)
  if (stored > 0) return stored
  const entry = vehicle.hora_entrada || vehicle.entry_time
  if (!entry) return 0
  const start = new Date(entry)
  const end = vehicle.hora_salida || vehicle.exit_time ? new Date(vehicle.hora_salida || vehicle.exit_time) : new Date()
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000))
}

const getVehicleAmount = (vehicle) =>
  Number(vehicle.monto_total ?? vehicle.total_amount ?? vehicle.amount ?? vehicle.costo ?? 0) || 0

const getSpaceLabel = (space) => {
  const code = space.codigo || space.nombre || space.numero_mostrar || space.numero || 'Sin codigo'
  const floor = space.piso || space.nivel || space.nivel_mostrar || space.tipo || ''
  const status = space.ocupado || space.estado === 'ocupado' || space.status === 'occupied' ? 'Ocupado' : 'Disponible'
  return `${code}${floor ? ` - Piso ${floor}` : ''} - ${status}`
}

/* --- palette ----------------------------------------------- */
const C = {
  bg:        'var(--bg)',
  card:      'var(--surface)',
  cardDeep:  'var(--surface2)',
  primary:   'var(--accent)',
  accent:    'var(--accent2)',
  textSoft:  'var(--text-dim)',
  border:    'var(--border)',
  borderMid: 'var(--border-hover)',
  success:   '#3fb950',
  warning:   'var(--accent2)',
  danger:    '#f85149',
}

/* --- styles ------------------------------------------------ */
const s = {
  page: { width: '100%', maxWidth: 1440, margin: '0 auto', fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" },

  /* header */
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    gap: 20, marginBottom: 24, marginTop: 8, flexWrap: 'wrap',
  },
  breadcrumb: {
    display: 'flex', alignItems: 'center', gap: 7,
    fontSize: 15, fontWeight: 600, color: C.textSoft, marginBottom: 8,
  },
  breadcrumbAccent: { color: C.accent },
  pageTitle: {
    margin: 0, fontSize: 'clamp(2.2rem,5vw,3.6rem)', fontWeight: 800,
    fontFamily: "'Syne', sans-serif", background: 'linear-gradient(135deg, #e2e8f0 30%, var(--accent) 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', lineHeight: 1.05, letterSpacing: '-0.5px',
  },
  pageSub: { margin: '10px 0 0', color: C.textSoft, fontSize: '1.08rem' },
  headerActions: { display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, marginLeft: 'auto' },
  btnNew: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '12px 22px', background: C.primary, color: '#080f1e', boxShadow: '0 14px 34px rgba(56,189,248,0.18)',
    fontWeight: 700, fontSize: 14, cursor: 'pointer',
    border: 'none', borderRadius: 12, letterSpacing: '0.01em',
  },

  /* feedback */
  feedbackError: {
    borderRadius: 12, padding: '13px 18px', marginBottom: 14,
    background: 'rgba(110,16,16,0.28)', border: `1px solid rgba(248,81,73,0.45)`,
    color: '#ffb4b1', fontWeight: 600, fontSize: 14,
  },
  feedbackSuccess: {
    borderRadius: 12, padding: '13px 18px', marginBottom: 14,
    background: 'rgba(26,127,55,0.22)', border: `1px solid rgba(63,185,80,0.38)`,
    color: '#9be9a8', fontWeight: 600, fontSize: 14,
  },

  /* main card */
  card: {
    background: C.card, borderRadius: 16,
    border: `1px solid ${C.border}`, overflow: 'hidden',
  },

  /* toolbar */
  toolbar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 14, padding: '18px 22px', borderBottom: `1px solid ${C.border}`,
    flexWrap: 'wrap',
  },
  searchWrap: {
    display: 'flex', alignItems: 'center', gap: 10,
    flex: 1, minWidth: 240, maxWidth: 480,
    background: C.cardDeep, border: `1px solid ${C.border}`,
    borderRadius: 10, padding: '0 14px', height: 42,
  },
  searchIcon: { fontSize: 18, color: C.textSoft, flexShrink: 0 },
  searchInput: {
    flex: 1, background: 'transparent', border: 'none', outline: 'none',
    color: '#fff', fontSize: 14, padding: '0',
  },
  filterGroup: { display: 'flex', gap: 6 },
  filterBtn: (active) => ({
    padding: '9px 18px', borderRadius: 9, fontSize: 13, fontWeight: 600,
    background: active ? C.primary : C.cardDeep,
    color: active ? '#fff' : C.textSoft,
    border: active ? `1px solid ${C.primary}` : `1px solid ${C.border}`,
    cursor: 'pointer',
  }),

  /* table */
  tableHead: {
    display: 'grid',
    gridTemplateColumns: '0.9fr 0.9fr 1fr 0.72fr 0.8fr 0.85fr 0.95fr 0.6fr',
    gap: 12, padding: '12px 22px',
    borderBottom: `1px solid ${C.border}`,
    fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
    color: C.textSoft, textTransform: 'uppercase',
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '0.9fr 0.9fr 1fr 0.72fr 0.8fr 0.85fr 0.95fr 0.6fr',
    gap: 12, padding: '14px 22px',
    borderBottom: `1px solid rgba(90,202,249,0.06)`,
    alignItems: 'center', fontSize: 13, color: '#fff',
  },
  plateBadge: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 800,
    background: 'rgba(9,131,200,0.15)', color: C.accent,
    border: `1px solid rgba(9,131,200,0.28)`, letterSpacing: '0.05em',
    minWidth: 64,
  },
  badgeDentro: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
    background: 'rgba(63,185,80,0.12)', color: C.success,
    border: `1px solid rgba(63,185,80,0.25)`,
  },
  badgeFuera: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
    background: 'rgba(129,140,248,0.12)', color: C.warning,
    border: `1px solid rgba(129,140,248,0.25)`,
  },
  statusDot: (color) => ({
    width: 5, height: 5, borderRadius: '50%',
    background: color, display: 'inline-block',
  }),
  actionGroup: { display: 'flex', justifyContent: 'flex-end', gap: 8 },
  actionBtn: {
    width: 36, height: 36, borderRadius: 9,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: C.cardDeep, color: C.textSoft,
    border: `1px solid ${C.border}`, cursor: 'pointer',
    fontSize: 16,
  },

  /* empty / skeleton */
  emptyState: { textAlign: 'center', padding: '40px 22px' },
  emptyIco: {
    width: 40, height: 40, borderRadius: 10,
    background: 'rgba(9,131,200,0.1)', border: `1px solid rgba(9,131,200,0.2)`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 12px', color: C.accent,
  },
  emptyLbl: { fontSize: 13, color: C.textSoft },
  skeleton: {
    borderRadius: 10, height: 52, margin: '6px 22px',
    background: 'linear-gradient(90deg,#041f3a 0%,#0a3460 50%,#041f3a 100%)',
    backgroundSize: '200% 100%', animation: 'shimmer 1.25s linear infinite',
  },

  /* footer / pagination */
  footer: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 22px', borderTop: `1px solid ${C.border}`,
    fontSize: 12, color: C.textSoft, flexWrap: 'wrap', gap: 10,
  },
  pagination: { display: 'flex', gap: 6, alignItems: 'center' },
  pageBtn: (active) => ({
    minWidth: 34, height: 34, borderRadius: 8, fontSize: 13, fontWeight: 600,
    background: active ? C.primary : C.cardDeep,
    color: active ? '#fff' : C.textSoft,
    border: active ? `1px solid ${C.primary}` : `1px solid ${C.border}`,
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  }),
  pageArrow: {
    minWidth: 34, height: 34, borderRadius: 8, fontSize: 13, fontWeight: 700,
    background: C.cardDeep, color: C.textSoft,
    border: `1px solid ${C.border}`, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },

  /* modal backdrop */
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(1,4,9,0.78)',
    display: 'grid', placeItems: 'center', padding: 24, zIndex: 100,
    overflowY: 'auto',
  },
  modal: {
    width: 'min(520px,100%)', background: C.card,
    border: `1px solid ${C.border}`, borderRadius: 16,
    padding: 28, boxShadow: '0 24px 48px rgba(0,0,0,0.32)',
    maxHeight: 'calc(100dvh - 48px)',
    overflowY: 'auto',
    boxSizing: 'border-box',
  },
  modalTitle: { fontSize: 18, fontWeight: 700, color: '#fff', margin: '0 0 20px' },
  modalLabel: {
    display: 'block', fontSize: 12, fontWeight: 600,
    color: C.textSoft, marginBottom: 6, marginTop: 14, letterSpacing: '0.04em',
  },
  modalInput: {
    width: '100%', background: C.cardDeep, border: `1px solid ${C.borderMid}`,
    borderRadius: 10, color: '#fff', padding: '12px 14px', fontSize: 14,
    outline: 'none', boxSizing: 'border-box',
  },
  modalActions: {
    display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22,
    position: 'sticky', bottom: -28, paddingTop: 14, paddingBottom: 2,
    background: C.card,
  },
  btnCancel: {
    padding: '10px 20px', borderRadius: 9, fontSize: 13, fontWeight: 600,
    background: C.cardDeep, color: C.textSoft,
    border: `1px solid ${C.border}`, cursor: 'pointer',
  },
  btnSave: {
    padding: '10px 20px', borderRadius: 9, fontSize: 13, fontWeight: 700,
    background: C.primary, color: '#080f1e', boxShadow: '0 14px 34px rgba(56,189,248,0.18)', border: 'none', cursor: 'pointer',
  },

  /* salida resumen */
  resumenRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 14px', borderRadius: 10, marginBottom: 8,
    background: C.cardDeep, border: `1px solid ${C.border}`,
    fontSize: 13,
  },
  resumenRowTotal: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 16px', borderRadius: 10, marginBottom: 8,
    background: 'rgba(9,131,200,0.12)', border: `1px solid rgba(9,131,200,0.28)`,
    fontSize: 14, fontWeight: 700,
  },
  resumenLabel: { color: C.textSoft, fontSize: 13 },
  resumenValue: { color: '#fff', fontWeight: 700 },
}

/* --- icon -------------------------------------------------- */
const Icon = ({ name, size = 16, color }) => (
  <span
    className="material-symbols-outlined"
    style={{ fontSize: size, verticalAlign: 'middle', lineHeight: 1, color }}
  >
    {name}
  </span>
)

/* --- main component --------------------------------------- */
export default function Vehiculos() {
  const { user } = useAuth()
  const currentRole = normalizeRole(user?.role)
  const cachedVehiculos = getCachedApiData('/api/vehiculos')
  const cachedSpaces = getCachedApiData('/api/parking-spaces')

  const [vehiculos, setVehiculos] = useState(() =>
    Array.isArray(cachedVehiculos?.data) ? cachedVehiculos.data : [],
  )
  const [spaces, setSpaces] = useState(() =>
    Array.isArray(cachedSpaces?.data) ? cachedSpaces.data : [],
  )
  const [loading,    setLoading]    = useState(() => !cachedVehiculos)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState(null)
  const [success,    setSuccess]    = useState(null)
  const [page,       setPage]       = useState(1)
  const [showModal,  setShowModal]  = useState(false)
  const [showEdit,   setShowEdit]   = useState(false)
  const [editingV,   setEditingV]   = useState(null)
  const [salidaRes,  setSalidaRes]  = useState(null)
  const [search,     setSearch]     = useState('')
  const [filtro,     setFiltro]     = useState('todos')
  const [form,       setForm]       = useState({ placa: '', propietario: '', modelo: '', espacio: '' })
  const [formEdit,   setFormEdit]   = useState({ placa: '', propietario: '', modelo: '' })

  const loadSpaces = async ({ forceFresh = false } = {}) => {
    try {
      const payload = await apiGet('/api/parking-spaces', { forceFresh })
      setSpaces(Array.isArray(payload?.data) ? payload.data : [])
    } catch {
      setSpaces([])
    }
  }

  const loadVehiculos = async ({ showLoader = true } = {}) => {
    if (showLoader) setLoading(true)
    setError(null)
    try {
      const payload = await apiGet('/api/vehiculos')
      setVehiculos(Array.isArray(payload?.data) ? payload.data : [])
    } catch (err) {
      setError(err.message || 'No fue posible listar vehículos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadVehiculos({ showLoader: !cachedVehiculos })
    loadSpaces({ forceFresh: !cachedSpaces })
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const userName  = String(user?.name  || '').trim().toLowerCase()
    const userEmail = String(user?.email || '').trim().toLowerCase()
    return vehiculos.filter((v) => {
      const estado = normalizeEstado(v.status || v.estado).key
      const matchEstado = filtro === 'todos' || estado === filtro
      const owner = String(v.propietario || '').trim().toLowerCase()
      const matchOwner = currentRole !== ROLES.USUARIO || owner === userName || owner === userEmail
      const matchQ = !q || [v.placa, v.modelo, v.propietario]
        .map((x) => String(x || '').toLowerCase()).some((x) => x.includes(q))
      return matchEstado && matchOwner && matchQ
    })
  }, [currentRole, filtro, search, user?.email, user?.name, vehiculos])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  useEffect(() => { setPage((p) => Math.min(p, totalPages)) }, [totalPages])

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  const visibleStart = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const visibleEnd   = Math.min(page * PAGE_SIZE, filtered.length)

  const openAdd  = () => setShowModal(true)
  const closeAdd = () => { setShowModal(false); setForm({ placa: '', propietario: '', modelo: '', espacio: '' }) }

  const applyKnownVehicleToForm = (vehicle) => {
    setForm((current) => ({
      ...current,
      placa: formatPlateInput(vehicle.placa || vehicle.plate),
      propietario: vehicle.propietario || vehicle.owner_name || vehicle.owner || current.propietario,
      modelo: vehicle.modelo || vehicle.model || current.modelo,
    }))
  }

  const handleAddPlateChange = (value) => {
    const nextPlate = formatPlateInput(value)
    const existing = vehiculos.find((vehicle) =>
      String(vehicle.placa || vehicle.plate || '').trim().toUpperCase() === nextPlate
    )
    if (existing) {
      applyKnownVehicleToForm(existing)
      return
    }
    setForm((current) => ({ ...current, placa: nextPlate }))
  }

  const addPlateSuggestions = useMemo(() => {
    const q = String(form.placa || '').trim().toUpperCase()
    if (!q) return vehiculos.slice(0, 4)
    return vehiculos
      .filter((vehicle) => String(vehicle.placa || vehicle.plate || '').toUpperCase().includes(q))
      .slice(0, 4)
  }, [form.placa, vehiculos])

  const orderedSpaces = useMemo(
    () => [...spaces].sort((a, b) => getSpaceLabel(a).localeCompare(getSpaceLabel(b), 'es')),
    [spaces],
  )

  const openEdit = (v) => {
    setEditingV(v)
    setFormEdit({ placa: formatPlateInput(v.placa || ''), propietario: v.propietario || '', modelo: v.modelo || '' })
    setShowEdit(true)
  }
  const closeEdit = () => { setShowEdit(false); setEditingV(null) }

  const handleRegistrar = async (e) => {
    e.preventDefault(); setSaving(true); setError(null); setSuccess(null)
    if (!/^[A-Z]{3}[0-9]{4}$/.test(form.placa)) {
      setError('La placa debe tener 3 letras y 4 numeros. Ejemplo: ABC1234.')
      setSaving(false)
      return
    }
    try {
      const res = await apiPost('/api/vehiculos/entrada', {
        placa: form.placa, propietario: form.propietario,
        modelo: form.modelo, espacio_id: form.espacio,
      })
      setSuccess('Vehículo registrado correctamente.')
      closeAdd()
      if (res?.data) setVehiculos((c) => [res.data, ...c])
      else await loadVehiculos()
    } catch (err) { setError(err.message || 'No se pudo registrar el vehículo.') }
    finally { setSaving(false) }
  }

  const handleGuardarEdicion = async (e) => {
    e.preventDefault(); setSaving(true); setError(null); setSuccess(null)
    if (!/^[A-Z]{3}[0-9]{4}$/.test(formEdit.placa)) {
      setError('La placa debe tener 3 letras y 4 numeros. Ejemplo: ABC1234.')
      setSaving(false)
      return
    }
    try {
      const res = await apiPut(`/api/vehiculos/${editingV.id}`, {
        placa: formEdit.placa, propietario: formEdit.propietario, modelo: formEdit.modelo,
      })
      setSuccess('Vehículo actualizado correctamente.')
      closeEdit()
      setVehiculos((c) => c.map((v) =>
        v.id === editingV.id ? { ...v, ...(res?.data || formEdit) } : v,
      ))
    } catch (err) { setError(err.message || 'No se pudo actualizar el vehículo.') }
    finally { setSaving(false) }
  }

  const handleSalida = async (vehiculo) => {
    setSaving(true); setError(null); setSuccess(null)
    try {
      const res  = await apiPost('/api/vehiculos/salida', { placa: vehiculo.placa })
      const data = res?.data || res || {}
      setSalidaRes({
        placa:        data.placa || vehiculo.placa,
        tiempoTotal:  formatDurationBreakdown(data.tiempo_total_minutos),
        horasCobradas: data.horas_cobradas || 1,
        tarifaPorHora: Number(data.tarifa_por_hora || 0),
        costoTotal:    Number(data.monto_total || 0),
      })
      const exitTime = data.hora_salida || data.exit_time || new Date().toISOString()
      setVehiculos((c) => c.map((v) =>
        v.id === vehiculo.id
          ? { ...v, status: 'fuera', estado: 'fuera', hora_salida: exitTime, exit_time: exitTime,
              monto_total: data.monto_total ?? v.monto_total, total_amount: data.monto_total ?? v.total_amount }
          : v,
      ))
      setSuccess(res?.mensaje || 'Salida registrada correctamente.')
    } catch (err) { setError(err.message || 'No se pudo registrar la salida.') }
    finally { setSaving(false) }
  }

  return (
    <div style={s.page}>

      {/* -- Header -- */}
      <div style={s.header}>
        <div>
          <div style={s.breadcrumb}>
            SmartPark
            <span style={s.breadcrumbAccent}>/</span>
            <span style={s.breadcrumbAccent}>Vehículos</span>
          </div>
          <h1>Vehículos</h1>
          <p style={s.pageSub}>Administre y monitoree el inventario de vehículos, entradas y salidas en tiempo real.</p>
        </div>
        <div style={s.headerActions}>
          <button type="button" style={s.btnNew} onClick={openAdd}>
            <Icon name="add_circle" size={16} />
            Agregar Vehículo
          </button>
          <NotificationsBell />
        </div>
      </div>

      {error   && <div style={s.feedbackError}>{error}</div>}
      {success && <div style={s.feedbackSuccess}>{success}</div>}

      {/* -- Main card -- */}
      <div style={s.card}>

        {/* Toolbar */}
        <div style={s.toolbar}>
          <label style={s.searchWrap}>
            <Icon name="search" size={18} color={C.textSoft} />
            <input
              type="search"
              style={s.searchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por placa, modelo o propietario..."
            />
          </label>
          <div style={s.filterGroup}>
            {ESTADOS_FILTRO.map((item) => (
              <button
                key={item.key}
                type="button"
                style={s.filterBtn(filtro === item.key)}
                onClick={() => setFiltro(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table head */}
        <div style={s.tableHead}>
          <span>Placa</span>
          <span>Modelo</span>
          <span>Propietario</span>
          <span>Estado</span>
          <span>Tiempo</span>
          <span>Monto</span>
          <span>Última entrada</span>
          <span style={{ textAlign: 'right' }}>Acciones</span>
        </div>

        {/* Rows */}
        {loading && (
          <>
            <div style={s.skeleton} />
            <div style={s.skeleton} />
            <div style={s.skeleton} />
          </>
        )}

        {!loading && paginated.length === 0 && (
          <div style={s.emptyState}>
            <div style={s.emptyIco}><Icon name="directions_car" size={18} /></div>
            <div style={s.emptyLbl}>No hay vehículos registrados.</div>
          </div>
        )}

        {!loading && paginated.map((vehiculo) => {
          const estado = normalizeEstado(vehiculo.estado)
          const isDentro = estado.key === 'dentro'
          const amount = getVehicleAmount(vehiculo)
          return (
            <div key={vehiculo.id} style={s.tableRow}>
              <div>
                <span style={s.plateBadge}>{vehiculo.placa || '---'}</span>
              </div>
              <span style={{ color: '#fff' }}>{vehiculo.modelo || 'Sin modelo'}</span>
              <span style={{ color: C.textSoft }}>{vehiculo.propietario || 'Sin propietario'}</span>
              <span>
                <span style={isDentro ? s.badgeDentro : s.badgeFuera}>
                  <span style={s.statusDot(isDentro ? C.success : C.warning)} />
                  {estado.label}
                </span>
              </span>
              <span style={{ color: C.textSoft, fontSize: 12 }}>
                {formatDurationBreakdown(getVehicleDurationMinutes(vehiculo))}
              </span>
              <span style={{ color: amount ? C.success : C.textSoft, fontSize: 12, fontWeight: 700 }}>
                {isDentro ? 'En curso' : formatMoney(amount)}
              </span>
              <span style={{ color: C.textSoft, fontSize: 12 }}>
                {formatDateTime(vehiculo.hora_entrada)}
              </span>
              <div style={s.actionGroup}>
                {isDentro && currentRole !== ROLES.USUARIO && (
                  <button
                    type="button"
                    style={s.actionBtn}
                    onClick={() => handleSalida(vehiculo)}
                    title="Registrar salida"
                  >
                    <Icon name="logout" size={16} color={C.textSoft} />
                  </button>
                )}
                {currentRole === ROLES.ADMIN && (
                  <button
                    type="button"
                    style={s.actionBtn}
                    onClick={() => openEdit(vehiculo)}
                    title="Editar"
                  >
                    <Icon name="edit" size={16} color={C.textSoft} />
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {/* Footer pagination */}
        <div style={s.footer}>
          <span>Mostrando {visibleStart} a {visibleEnd} de {filtered.length} vehículos</span>
          <div style={s.pagination}>
            <button
              type="button"
              style={s.pageArrow}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              &lt;
            </button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i + 1}
                type="button"
                style={s.pageBtn(page === i + 1)}
                onClick={() => setPage(i + 1)}
              >
                {i + 1}
              </button>
            ))}
            <button
              type="button"
              style={s.pageArrow}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              &gt;
            </button>
          </div>
        </div>
      </div>

      {/* -- Modal: Agregar Vehículo -- */}
      {showModal && (
        <div style={s.backdrop} onClick={closeAdd}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={s.modalTitle}>Agregar Vehículo</h2>
            <form onSubmit={handleRegistrar}>
              {[
                { id: 'v-placa',    field: 'placa',       label: 'Placa',       req: true },
                { id: 'v-prop',     field: 'propietario', label: 'Propietario', req: true },
                { id: 'v-modelo',   field: 'modelo',      label: 'Modelo' },
                { id: 'v-espacio',  field: 'espacio',     label: 'Espacio', req: true },
              ].map(({ id, field, label, req }) => (
                <div key={field}>
                  <label htmlFor={id} style={s.modalLabel}>{label}</label>
                  {field === 'espacio' ? (
                    <select
                      id={id}
                      style={{ ...s.modalInput, cursor: 'pointer' }}
                      value={form.espacio}
                      onChange={(e) => setForm((c) => ({ ...c, espacio: e.target.value }))}
                      required={req}
                    >
                      <option value="">{orderedSpaces.length ? 'Seleccione un espacio' : 'No hay espacios registrados'}</option>
                      {orderedSpaces.map((space) => (
                        <option key={space.id || getSpaceLabel(space)} value={space.id}>
                          {getSpaceLabel(space)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={id}
                      style={s.modalInput}
                      value={form[field]}
                      onChange={(e) =>
                        field === 'placa'
                          ? handleAddPlateChange(e.target.value)
                          : setForm((c) => ({ ...c, [field]: e.target.value }))
                      }
                      maxLength={field === 'placa' ? 7 : undefined}
                      pattern={field === 'placa' ? '[A-Z]{3}[0-9]{4}' : undefined}
                      title={field === 'placa' ? 'La placa debe tener 3 letras y 4 numeros. Ejemplo: ABC1234' : undefined}
                      required={req}
                    />
                  )}
                  {field === 'placa' && addPlateSuggestions.length > 0 && (
                    <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                      {addPlateSuggestions.map((vehicle) => (
                        <button
                          key={vehicle.id || vehicle.placa}
                          type="button"
                          onClick={() => applyKnownVehicleToForm(vehicle)}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 8,
                            padding: '8px 10px',
                            borderRadius: 8,
                            background: C.cardDeep,
                            border: `1px solid ${C.border}`,
                            color: '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          <strong>{vehicle.placa || vehicle.plate}</strong>
                          <span style={{ color: C.textSoft }}>
                            {vehicle.propietario || vehicle.owner_name || 'Sin propietario'} - {vehicle.modelo || vehicle.model || 'Sin modelo'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div style={s.modalActions}>
                <button type="button" style={s.btnCancel} onClick={closeAdd}>Cancelar</button>
                <button type="submit" style={s.btnSave} disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -- Modal: Editar Vehículo -- */}
      {showEdit && (
        <div style={s.backdrop} onClick={closeEdit}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={s.modalTitle}>Editar Vehículo</h2>
            <form onSubmit={handleGuardarEdicion}>
              {[
                { id: 'e-placa', field: 'placa',       label: 'Placa',       req: true },
                { id: 'e-prop',  field: 'propietario', label: 'Propietario' },
                { id: 'e-mod',   field: 'modelo',      label: 'Modelo' },
              ].map(({ id, field, label, req }) => (
                <div key={field}>
                  <label htmlFor={id} style={s.modalLabel}>{label}</label>
                  <input
                    id={id}
                    style={s.modalInput}
                    value={formEdit[field]}
                    onChange={(e) => setFormEdit((c) => ({
                      ...c,
                      [field]: field === 'placa' ? formatPlateInput(e.target.value) : e.target.value,
                    }))}
                    maxLength={field === 'placa' ? 7 : undefined}
                    pattern={field === 'placa' ? '[A-Z]{3}[0-9]{4}' : undefined}
                    title={field === 'placa' ? 'La placa debe tener 3 letras y 4 numeros. Ejemplo: ABC1234' : undefined}
                    required={req}
                  />
                </div>
              ))}
              <div style={s.modalActions}>
                <button type="button" style={s.btnCancel} onClick={closeEdit}>Cancelar</button>
                <button type="submit" style={s.btnSave} disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -- Modal: Resumen de Salida -- */}
      {salidaRes && (
        <div style={s.backdrop} onClick={() => setSalidaRes(null)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={s.modalTitle}>Salida registrada</h2>
            {[
              { label: 'Placa',           value: salidaRes.placa },
              { label: 'Tiempo estacionado', value: salidaRes.tiempoTotal },
              { label: 'Horas cobradas',  value: salidaRes.horasCobradas },
              { label: 'Tarifa por hora', value: formatMoney(salidaRes.tarifaPorHora) },
            ].map(({ label, value }) => (
              <div key={label} style={s.resumenRow}>
                <span style={s.resumenLabel}>{label}</span>
                <span style={s.resumenValue}>{value}</span>
              </div>
            ))}
            <div style={s.resumenRowTotal}>
              <span style={{ color: C.accent, fontWeight: 700 }}>Costo total</span>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>
                {formatMoney(salidaRes.costoTotal)}
              </span>
            </div>
            <div style={s.modalActions}>
              <button type="button" style={s.btnSave} onClick={() => setSalidaRes(null)}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}




