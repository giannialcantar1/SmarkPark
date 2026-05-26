import { useEffect, useMemo, useState } from 'react'

import NotificationsBell from '../components/NotificationsBell'
import { apiGet, apiPost, apiPut, getCachedApiData } from '../lib/api'

/* --- constants --------------------------------------------- */
const FILTROS = [
  { key: 'todos',       label: 'Todos' },
  { key: 'estacionado', label: 'Estacionados' },
  { key: 'fuera',       label: 'Ausentes' },
]

const FORMULARIO_VACIO = {
  placa: '', propietario: '', modelo: '', espacio: '', estado: 'estacionado',
}

const normalizePlateInput = (value) => {
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

/* --- helpers ----------------------------------------------- */
const normalizarEstado = (valor) => {
  const e = String(valor || '').trim().toLowerCase()
  if (e === 'fuera' || e === 'outside') return 'fuera'
  if (e === 'dentro' || e === 'estacionado' || e === 'inside') return 'estacionado'
  return 'fuera'
}

const obtenerEstado = (vehiculo) => {
  const estado = normalizarEstado(vehiculo?.status || vehiculo?.estado)
  if (estado === 'fuera' || vehiculo?.hora_salida) return 'fuera'
  return 'estacionado'
}

const obtenerEtiqueta = (estado) => estado === 'fuera' ? 'Ausente' : 'Estacionado'

const formatearFecha = (valor) => {
  if (!valor) return 'Sin registro'
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return 'Sin registro'
  return new Intl.DateTimeFormat('es-DO', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(fecha)
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

  feedbackError: {
    borderRadius: 12, padding: '13px 18px', marginBottom: 14,
    background: 'rgba(110,16,16,0.28)', border: '1px solid rgba(248,81,73,0.45)',
    color: '#ffb4b1', fontWeight: 600, fontSize: 14,
  },
  feedbackSuccess: {
    borderRadius: 12, padding: '13px 18px', marginBottom: 14,
    background: 'rgba(26,127,55,0.22)', border: '1px solid rgba(63,185,80,0.38)',
    color: '#9be9a8', fontWeight: 600, fontSize: 14,
  },

  card: {
    background: C.card, borderRadius: 16,
    border: `1px solid ${C.border}`, overflow: 'hidden',
  },

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
  searchInput: {
    flex: 1, background: 'transparent', border: 'none', outline: 'none',
    color: '#fff', fontSize: 14, padding: 0,
  },
  filterGroup: { display: 'flex', gap: 6 },
  filterBtn: (active) => ({
    padding: '9px 18px', borderRadius: 9, fontSize: 13, fontWeight: 600,
    background: active ? C.primary : C.cardDeep,
    color: active ? '#fff' : C.textSoft,
    border: active ? `1px solid ${C.primary}` : `1px solid ${C.border}`,
    cursor: 'pointer',
  }),

  tableHead: {
    display: 'grid',
    gridTemplateColumns: '1.1fr 1.2fr 1fr 0.8fr 1fr 0.6fr',
    gap: 12, padding: '12px 22px',
    borderBottom: `1px solid ${C.border}`,
    fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
    color: C.textSoft, textTransform: 'uppercase',
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '1.1fr 1.2fr 1fr 0.8fr 1fr 0.6fr',
    gap: 12, padding: '15px 22px',
    borderBottom: `1px solid rgba(90,202,249,0.06)`,
    alignItems: 'center', fontSize: 13, color: '#fff',
    transition: 'background 0.12s',
  },

  /* placa */
  placaStrong: {
    fontSize: 13, fontWeight: 800, color: C.accent,
    letterSpacing: '0.04em',
  },

  /* modelo block */
  modeloBlock: { display: 'grid', gap: 2 },
  modeloStrong: { fontSize: 13, fontWeight: 700, color: '#fff' },
  modeloSmall: { fontSize: 11, color: C.textSoft },

  /* badges */
  badgeEstacionado: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
    background: 'rgba(63,185,80,0.12)', color: C.success,
    border: '1px solid rgba(63,185,80,0.25)',
  },
  badgeFuera: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
    background: 'rgba(129,140,248,0.12)', color: C.warning,
    border: '1px solid rgba(129,140,248,0.25)',
  },
  statusDot: (color) => ({
    width: 5, height: 5, borderRadius: '50%',
    background: color, display: 'inline-block',
  }),

  /* edit btn */
  editBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
    background: 'rgba(9,131,200,0.15)', color: C.accent,
    border: '1px solid rgba(9,131,200,0.25)', cursor: 'pointer',
  },

  /* empty / skeleton */
  emptyState: { textAlign: 'center', padding: '40px 22px' },
  emptyIco: {
    width: 40, height: 40, borderRadius: 10,
    background: 'rgba(9,131,200,0.1)', border: '1px solid rgba(9,131,200,0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 12px', color: C.accent,
  },
  emptyLbl: { fontSize: 13, color: C.textSoft },
  skeleton: {
    borderRadius: 10, height: 52, margin: '6px 22px',
    background: 'linear-gradient(90deg,#041f3a 0%,#0a3460 50%,#041f3a 100%)',
    backgroundSize: '200% 100%', animation: 'shimmer 1.25s linear infinite',
  },

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

  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(1,4,9,0.78)',
    display: 'grid', placeItems: 'center', padding: 24, zIndex: 100,
  },
  modal: {
    width: 'min(520px,100%)', background: C.card,
    border: `1px solid ${C.border}`, borderRadius: 16,
    padding: 28, boxShadow: '0 24px 48px rgba(0,0,0,0.32)',
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
  modalSelect: {
    width: '100%', background: C.cardDeep, border: `1px solid ${C.borderMid}`,
    borderRadius: 10, color: '#fff', padding: '12px 14px', fontSize: 14,
    outline: 'none', boxSizing: 'border-box', cursor: 'pointer',
  },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 },
  btnCancel: {
    padding: '10px 20px', borderRadius: 9, fontSize: 13, fontWeight: 600,
    background: C.cardDeep, color: C.textSoft,
    border: `1px solid ${C.border}`, cursor: 'pointer',
  },
  btnSave: {
    padding: '10px 20px', borderRadius: 9, fontSize: 13, fontWeight: 700,
    background: C.primary, color: '#080f1e', boxShadow: '0 14px 34px rgba(56,189,248,0.18)', border: 'none', cursor: 'pointer',
  },
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
export default function VehicleManagement() {
  const cachedVehiculos = getCachedApiData('/api/vehiculos')

  const [vehiculos,    setVehiculos]    = useState(() => Array.isArray(cachedVehiculos?.data) ? cachedVehiculos.data : [])
  const [loading,      setLoading]      = useState(() => !cachedVehiculos)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState(null)
  const [success,      setSuccess]      = useState(null)
  const [search,       setSearch]       = useState('')
  const [filtroActivo, setFiltroActivo] = useState('todos')
  const [pagina,       setPagina]       = useState(1)
  const [modalOpen,    setModalOpen]    = useState(false)
  const [editingId,    setEditingId]    = useState(null)
  const [form,         setForm]         = useState(FORMULARIO_VACIO)

  const PAGE_SIZE = 4

  const cargarVehiculos = async ({ showLoader = true } = {}) => {
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

  useEffect(() => { cargarVehiculos({ showLoader: !cachedVehiculos }) }, [])
  useEffect(() => { setPagina(1) }, [search, filtroActivo])

  const vehiculosFiltrados = useMemo(() => {
    const termino = search.trim().toLowerCase()
    return vehiculos.filter((v) => {
      const estado = obtenerEstado(v)
      const coincideFiltro = filtroActivo === 'todos' || estado === filtroActivo
      const texto = [v.placa, v.modelo, v.propietario].join(' ').toLowerCase()
      const coincideBusqueda = termino ? texto.includes(termino) : true
      return coincideFiltro && coincideBusqueda
    })
  }, [vehiculos, search, filtroActivo])

  const totalPaginas = Math.max(1, Math.ceil(vehiculosFiltrados.length / PAGE_SIZE))
  const paginaActual = Math.min(pagina, totalPaginas)
  const inicio = vehiculosFiltrados.length === 0 ? 0 : (paginaActual - 1) * PAGE_SIZE + 1
  const fin    = Math.min(paginaActual * PAGE_SIZE, vehiculosFiltrados.length)
  const filas  = vehiculosFiltrados.slice((paginaActual - 1) * PAGE_SIZE, paginaActual * PAGE_SIZE)

  const cerrarModal = () => { setModalOpen(false); setEditingId(null); setForm(FORMULARIO_VACIO) }

  const abrirNuevo = () => { setEditingId(null); setForm(FORMULARIO_VACIO); setModalOpen(true) }

  const editarVehiculo = (v) => {
    setEditingId(v.id || null)
    setForm({
      placa: v.placa || '', propietario: v.propietario || '',
      modelo: v.modelo || '', espacio: v.espacio || v.espacio_id || '',
      estado: obtenerEstado(v),
    })
    setModalOpen(true)
  }

  const handleChange = (field) => (e) => {
    const value = field === 'placa' ? normalizePlateInput(e.target.value) : e.target.value
    setForm((c) => ({ ...c, [field]: value }))
  }

  const guardarVehiculo = async (e) => {
    e.preventDefault(); setSaving(true); setError(null); setSuccess(null)
    if (!/^[A-Z]{3}[0-9]{4}$/.test(form.placa)) {
      setError('La placa debe tener 3 letras y 4 numeros. Ejemplo: ABC1234.')
      setSaving(false)
      return
    }
    try {
      if (editingId) {
        const res = await apiPut(`/api/vehiculos/${editingId}`, {
          placa: form.placa, propietario: form.propietario,
          modelo: form.modelo, espacio_id: form.espacio,
          estado: form.estado === 'estacionado' ? 'dentro' : 'fuera',
        })
        setVehiculos((c) => c.map((v) =>
          v.id === editingId
            ? { ...v, ...(res?.data || {}), placa: form.placa, propietario: form.propietario,
                modelo: form.modelo, espacio: form.espacio, espacio_id: form.espacio,
                status: form.estado === 'estacionado' ? 'dentro' : 'fuera',
                estado: form.estado === 'estacionado' ? 'dentro' : 'fuera' }
            : v,
        ))
      } else {
        const res = await apiPost('/api/vehiculos/entrada', {
          placa: form.placa, propietario: form.propietario,
          modelo: form.modelo, espacio_id: form.espacio,
        })
        setVehiculos((c) => [res?.data || {
          placa: form.placa, propietario: form.propietario,
          modelo: form.modelo, espacio: form.espacio,
          status: 'dentro', estado: 'dentro',
        }, ...c])
      }
      setSuccess(editingId ? 'Vehículo actualizado correctamente.' : 'Vehículo registrado correctamente.')
      cerrarModal()
    } catch (err) {
      setError(err.message || 'No fue posible guardar el vehículo.')
    } finally { setSaving(false) }
  }

  return (
    <div style={s.page}>

      {/* -- Header -- */}
      <div style={s.header}>
        <div>
          <div style={s.breadcrumb}>
            SmartPark
            <span style={s.breadcrumbAccent}>/</span>
            <span style={s.breadcrumbAccent}>Gestión de Vehículos</span>
          </div>
          <h1>Gestión de Vehículos</h1>
          <p style={s.pageSub}>Administre y monitoree el inventario de vehículos, entradas y salidas en tiempo real dentro del sistema.</p>
        </div>
        <div style={s.headerActions}>
          <button type="button" style={s.btnNew} onClick={abrirNuevo}>
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
              placeholder="Buscar por placa, modelo o propietario..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div style={s.filterGroup}>
            {FILTROS.map((f) => (
              <button
                key={f.key}
                type="button"
                style={s.filterBtn(filtroActivo === f.key)}
                onClick={() => setFiltroActivo(f.key)}
              >
                {f.label}
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
          <span>Última entrada</span>
          <span>Acciones</span>
        </div>

        {/* Skeletons */}
        {loading && (
          <>{[1,2,3,4].map((i) => <div key={i} style={s.skeleton} />)}</>
        )}

        {/* Empty */}
        {!loading && filas.length === 0 && (
          <div style={s.emptyState}>
            <div style={s.emptyIco}><Icon name="directions_car" size={18} /></div>
            <div style={s.emptyLbl}>No hay vehículos registrados.</div>
          </div>
        )}

        {/* Rows */}
        {!loading && filas.map((v) => {
          const estado = obtenerEstado(v)
          const isEstacionado = estado === 'estacionado'
          return (
            <div
              key={v.id || v.placa}
              style={s.tableRow}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(90,202,249,0.04)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <div>
                <span style={s.placaStrong}>{v.placa || 'SIN-PLACA'}</span>
              </div>

              <div style={s.modeloBlock}>
                <span style={s.modeloStrong}>{v.modelo || 'Modelo no definido'}</span>
                <span style={s.modeloSmall}>{v.anio || 'Vehículo registrado'}</span>
              </div>

              <span style={{ color: C.textSoft }}>{v.propietario || 'Sin propietario'}</span>

              <span>
                <span style={isEstacionado ? s.badgeEstacionado : s.badgeFuera}>
                  <span style={s.statusDot(isEstacionado ? C.success : C.warning)} />
                  {obtenerEtiqueta(estado)}
                </span>
              </span>

              <span style={{ fontSize: 12, color: C.textSoft }}>
                {formatearFecha(v.hora_entrada || v.fecha_registro)}
              </span>

              <div>
                <button
                  type="button"
                  style={s.editBtn}
                  onClick={() => editarVehiculo(v)}
                >
                  <Icon name="edit" size={13} color={C.accent} />
                  Editar
                </button>
              </div>
            </div>
          )
        })}

        {/* Footer */}
        <div style={s.footer}>
          <span>Mostrando {inicio} a {fin} de {vehiculosFiltrados.length} vehículos</span>
          <div style={s.pagination}>
            <button type="button" style={s.pageArrow} onClick={() => setPagina((p) => Math.max(1, p - 1))}>
              &lt;
            </button>
            {Array.from({ length: totalPaginas }).map((_, i) => (
              <button
                key={i + 1}
                type="button"
                style={s.pageBtn(paginaActual === i + 1)}
                onClick={() => setPagina(i + 1)}
              >
                {i + 1}
              </button>
            ))}
            <button type="button" style={s.pageArrow} onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}>
              &gt;
            </button>
          </div>
        </div>
      </div>

      {/* -- Modal: Agregar / Editar -- */}
      {modalOpen && (
        <div style={s.backdrop} onClick={cerrarModal}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={s.modalTitle}>
              {editingId ? 'Editar vehículo' : 'Agregar vehículo'}
            </h2>
            <form onSubmit={guardarVehiculo}>
              {[
                { id: 'g-placa', field: 'placa',       label: 'Placa',       req: true },
                { id: 'g-prop',  field: 'propietario', label: 'Propietario', req: true },
                { id: 'g-mod',   field: 'modelo',      label: 'Modelo' },
                { id: 'g-esp',   field: 'espacio',     label: 'Espacio' },
              ].map(({ id, field, label, req }) => (
                <div key={field}>
                  <label htmlFor={id} style={s.modalLabel}>{label}</label>
                  <input
                    id={id}
                    style={s.modalInput}
                    value={form[field]}
                    onChange={handleChange(field)}
                    maxLength={field === 'placa' ? 7 : undefined}
                    pattern={field === 'placa' ? '[A-Z]{3}[0-9]{4}' : undefined}
                    title={field === 'placa' ? 'La placa debe tener 3 letras y 4 numeros. Ejemplo: ABC1234' : undefined}
                    required={req}
                  />
                </div>
              ))}

              <label htmlFor="g-estado" style={s.modalLabel}>Estado</label>
              <select
                id="g-estado"
                style={s.modalSelect}
                value={form.estado}
                onChange={handleChange('estado')}
              >
                <option value="estacionado">Estacionado</option>
                <option value="fuera">Ausente</option>
              </select>

              <div style={s.modalActions}>
                <button type="button" style={s.btnCancel} onClick={cerrarModal}>
                  Cancelar
                </button>
                <button type="submit" style={s.btnSave} disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}




