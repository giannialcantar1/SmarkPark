import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import NotificationsBell from '../components/NotificationsBell'
import { apiGet, apiPost, getCachedApiData } from '../lib/api'

const DURACIONES = [
  '1 hora', '2 horas', '3 horas', '4 horas', '5 horas', '6 horas',
  'Día completo (24 horas)', '2 días', '3 días', '4 días', '5 días', '6 días', '7 días',
]

const INITIAL_FORM = {
  espacioId: '', placa: '', modelo: '', propietario: '', duracion: '1 hora', notas: '',
}

const normalizeSpace = (space = {}) => ({
  id: space.id,
  nombre: space.nombre || space.numero_mostrar || space.codigo || space.numero || space.code || '',
  tipo: space.piso || space.nivel || space.nivel_mostrar || space.floor || space.tipo || 'General',
  estado: space.estado || (space.ocupado || space.occupied ? 'ocupado' : 'disponible'),
  ocupado:
    Boolean(space.ocupado || space.occupied) ||
    ['ocupado', 'occupied'].includes(String(space.estado || space.status || '').toLowerCase()),
})

const normalizeVehicle = (vehicle = {}) => ({
  id: vehicle.id,
  placa: vehicle.placa || '',
  modelo: vehicle.modelo || vehicle.model || '',
  propietario: vehicle.propietario || vehicle.owner || '',
  spaceId: vehicle.espacio_id || vehicle.space_id || '',
  status: vehicle.status || vehicle.estado || '',
})

const buildMergedSpaces = (spacesPayload, vehiclesPayload) => {
  const allSpaces = Array.isArray(spacesPayload?.data) ? spacesPayload.data.map(normalizeSpace) : []
  const activeSpaceIds = new Set(
    (Array.isArray(vehiclesPayload?.data) ? vehiclesPayload.data : [])
      .map(normalizeVehicle)
      .filter((v) => ['dentro', 'activo', 'active'].includes(String(v.status || '').toLowerCase()) && v.spaceId)
      .map((v) => String(v.spaceId)),
  )
  return allSpaces.map((space) => {
    const ocupado = activeSpaceIds.has(String(space.id)) || space.ocupado
    return { ...space, ocupado, estado: ocupado ? 'ocupado' : 'disponible' }
  })
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
}

const s = {
  page: {
    width: '100%',
    maxWidth: 1440,
    margin: '0 auto',
    fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
  },

  /* -- topbar -- */
  topbar: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  newBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 20px',
    background: C.primary,
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    letterSpacing: '0.01em',
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    background: C.card,
    border: `1px solid rgba(90,202,249,0.10)`,
    color: 'var(--text-dim)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: 20,
  },

  /* -- header -- */
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 20,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 14,
    fontWeight: 600,
    color: C.textSoft,
    marginBottom: 6,
  },
  breadcrumbAccent: { color: C.accent },
  pageTitle: {
    margin: 0,
    fontSize: 'clamp(2rem,4vw,3.2rem)',
    fontWeight: 800,
    color: '#fff',
    lineHeight: 1.05,
    letterSpacing: '-0.5px',
  },
  pageSub: {
    margin: '6px 0 0',
    color: C.textSoft,
    fontSize: '1rem',
  },

  /* -- stats bar -- */
  statsBar: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
    marginBottom: 20,
  },
  statPill: (accent) => ({
    background: C.card,
    border: `1px solid ${C.border}`,
    borderLeft: `3px solid ${accent}`,
    borderRadius: 12,
    padding: '14px 18px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  }),
  statIco: (accent) => ({
    width: 36,
    height: 36,
    borderRadius: 9,
    background: `${accent}18`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: accent,
    fontSize: 18,
    flexShrink: 0,
  }),
  statVal: {
    fontSize: 22,
    fontWeight: 800,
    color: '#fff',
    lineHeight: 1,
  },
  statLbl: {
    fontSize: 11,
    color: C.textSoft,
    marginTop: 2,
  },

  /* -- feedback -- */
  feedbackError: {
    borderRadius: 12,
    padding: '12px 16px',
    marginBottom: 16,
    background: 'rgba(110,16,16,0.28)',
    border: '1px solid rgba(248,81,73,0.45)',
    color: '#ffb4b1',
    fontWeight: 600,
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  feedbackSuccess: {
    borderRadius: 12,
    padding: '12px 16px',
    marginBottom: 16,
    background: 'rgba(26,127,55,0.22)',
    border: '1px solid rgba(63,185,80,0.38)',
    color: '#9be9a8',
    fontWeight: 600,
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },

  /* -- two-column layout -- */
  twoCol: {
    display: 'grid',
    gridTemplateColumns: '1fr 420px',
    gap: 16,
    alignItems: 'start',
  },

  /* -- form card -- */
  formCard: {
    background: C.card,
    borderRadius: 16,
    border: `1px solid ${C.border}`,
    overflow: 'hidden',
  },
  formCardHead: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '18px 24px',
    borderBottom: `1px solid ${C.border}`,
  },
  formCardHeadIco: {
    width: 34,
    height: 34,
    borderRadius: 9,
    background: 'rgba(9,131,200,0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: C.accent,
    fontSize: 18,
  },
  formCardTitle: { fontSize: 15, fontWeight: 700, color: '#fff', margin: 0 },
  formCardSub: { fontSize: 12, color: C.textSoft, marginTop: 2 },
  formBody: { padding: '22px 24px' },

  /* -- form grid -- */
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px 20px',
  },
  fieldFull: { gridColumn: '1 / -1' },
  fieldLabel: {
    display: 'grid',
    gap: 6,
    fontSize: 13,
    fontWeight: 600,
    color: C.textSoft,
  },
  inputWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputBase: {
    width: '100%',
    background: C.cardDeep,
    border: `1px solid ${C.borderMid}`,
    borderRadius: 10,
    color: '#fff',
    padding: '11px 44px 11px 14px',
    fontSize: 13,
    outline: 'none',
    transition: 'border-color 0.2s',
    fontFamily: 'inherit',
  },
  inputIcon: {
    position: 'absolute',
    right: 14,
    color: C.textSoft,
    fontSize: 18,
    pointerEvents: 'none',
  },
  textarea: {
    width: '100%',
    background: C.cardDeep,
    border: `1px solid ${C.borderMid}`,
    borderRadius: 10,
    color: '#fff',
    padding: '11px 14px',
    fontSize: 13,
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
    minHeight: 80,
  },

  /* -- space selector pill (inside select) -- */
  spaceSelectOccupied: { color: '#f85149' },

  /* -- form actions -- */
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
    paddingTop: 18,
    borderTop: `1px solid ${C.border}`,
  },
  btnCancel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 20px',
    background: C.cardDeep,
    color: C.textSoft,
    border: `1px solid ${C.borderMid}`,
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  btnSubmit: (disabled) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 24px',
    background: disabled ? 'rgba(9,131,200,0.35)' : C.primary,
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 13,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
    opacity: disabled ? 0.7 : 1,
    transition: 'background 0.2s',
  }),

  /* -- map card -- */
  mapCard: {
    background: C.card,
    borderRadius: 16,
    border: `1px solid ${C.border}`,
    overflow: 'hidden',
    position: 'sticky',
    top: 16,
  },
  mapHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '18px 20px',
    borderBottom: `1px solid ${C.border}`,
  },
  mapTitle: { fontSize: 14, fontWeight: 700, color: '#fff', margin: 0 },
  mapSub: { fontSize: 11, color: C.textSoft, marginTop: 2 },
  mapBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 14px',
    background: 'rgba(9,131,200,0.15)',
    color: C.accent,
    border: `1px solid rgba(9,131,200,0.3)`,
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  mapBody: { padding: '16px 20px' },

  /* -- legend -- */
  legend: {
    display: 'flex',
    gap: 16,
    marginBottom: 14,
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
    color: C.textSoft,
  },
  legendDot: (color) => ({
    width: 10,
    height: 10,
    borderRadius: 3,
    background: color,
    flexShrink: 0,
  }),

  /* -- floor selector -- */
  floorTabs: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  floorTab: (active) => ({
    padding: '5px 12px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 700,
    border: `1px solid ${active ? 'rgba(9,131,200,0.5)' : C.border}`,
    background: active ? 'rgba(9,131,200,0.2)' : 'transparent',
    color: active ? C.accent : C.textSoft,
    cursor: 'pointer',
    fontFamily: 'inherit',
  }),

  /* -- space cells grid -- */
  spaceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))',
    gap: 8,
  },
  spaceCell: (state, selected) => {
    const colors = {
      disponible: { bg: 'rgba(63,185,80,0.12)', border: 'rgba(63,185,80,0.35)', color: '#3fb950' },
      ocupado:    { bg: 'rgba(248,81,73,0.12)',  border: 'rgba(248,81,73,0.35)',  color: '#f85149' },
    }
    const t = colors[state] || colors.disponible
    return {
      height: 52,
      borderRadius: 8,
      border: selected ? `2px solid ${C.accent}` : `1px solid ${t.border}`,
      background: selected ? 'var(--border-hover)' : t.bg,
      color: selected ? C.accent : t.color,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 10,
      fontWeight: 800,
      cursor: state === 'disponible' ? 'pointer' : 'not-allowed',
      letterSpacing: '0.04em',
      transition: 'all 0.15s',
      position: 'relative',
      outline: 'none',
    }
  },

  /* -- map stats footer -- */
  mapFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTop: `1px solid ${C.border}`,
    fontSize: 12,
    color: C.textSoft,
  },

  /* -- empty -- */
  emptyMap: {
    textAlign: 'center',
    padding: '36px 0',
    color: C.textSoft,
    fontSize: 13,
  },

  /* -- skeleton -- */
  skeleton: {
    borderRadius: 10,
    background: 'linear-gradient(90deg,#041f3a 0%,#0a3460 50%,#041f3a 100%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.25s linear infinite',
  },

  /* -- modal -- */
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(1,4,9,0.78)',
    display: 'grid',
    placeItems: 'center',
    padding: 24,
    zIndex: 100,
  },
  modal: {
    width: 'min(520px,100%)',
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 18,
    padding: 28,
    boxShadow: '0 24px 48px rgba(0,0,0,0.32)',
  },
  modalTitle: { margin: '0 0 18px', fontSize: 20, fontWeight: 800, color: '#fff' },
  stepRow: (highlight) => ({
    display: 'flex',
    gap: 14,
    alignItems: 'flex-start',
    padding: '12px 16px',
    borderRadius: 10,
    background: highlight ? 'rgba(9,131,200,0.1)' : C.cardDeep,
    border: `1px solid ${highlight ? 'rgba(9,131,200,0.25)' : C.border}`,
    marginBottom: 10,
  }),
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: '50%',
    background: 'rgba(9,131,200,0.2)',
    color: C.accent,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 13,
    flexShrink: 0,
  },
  stepText: { fontSize: 13, color: '#fff', fontWeight: 600, margin: 0, paddingTop: 3 },
}

const Icon = ({ name, size = 18 }) => (
  <span className="material-symbols-outlined" style={{ fontSize: size, verticalAlign: 'middle', lineHeight: 1, flexShrink: 0 }}>
    {name}
  </span>
)

export default function AssignParkings() {
  const navigate = useNavigate()
  const espacioRef = useRef(null)
  const cachedSpacesPayload = getCachedApiData('/api/parking-spaces')
  const cachedVehiclesPayload = getCachedApiData('/api/vehiculos')
  const cachedSpaces = Array.isArray(cachedSpacesPayload?.data) ? cachedSpacesPayload.data : []
  const hasCachedSpaces = cachedSpaces.length > 0

  const [spaces, setSpaces] = useState(() =>
    hasCachedSpaces ? buildMergedSpaces(cachedSpacesPayload, cachedVehiclesPayload) : [],
  )
  const [loading, setLoading] = useState(() => !hasCachedSpaces)
  const [saving, setSaving] = useState(false)
  const [showHelpModal, setShowHelpModal] = useState(false)
  const [showMapModal, setShowMapModal] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [form, setForm] = useState(INITIAL_FORM)
  const [activeFloor, setActiveFloor] = useState(null)

  const loadData = async ({ showLoader = true } = {}) => {
    if (showLoader) setLoading(true)
    setError(null)
    try {
      const sp = await apiGet('/api/parking-spaces', { forceFresh: true })
      setSpaces(buildMergedSpaces(sp, null))

      try {
        const vp = await apiGet('/api/vehiculos', { forceFresh: true })
        setSpaces(buildMergedSpaces(sp, vp))
      } catch {
        // Los vehiculos solo ayudan a marcar ocupados; no deben ocultar los espacios.
      }
    } catch (err) {
      setError(err.message || 'No se pudo cargar la información de parqueos.')
      setSpaces([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData({ showLoader: !hasCachedSpaces })

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

  const orderedSpaces = useMemo(
    () => [...spaces].sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', { numeric: true })),
    [spaces],
  )

  /* derive floors */
  const floors = useMemo(() => {
    const set = new Set(orderedSpaces.map((s) => s.tipo || 'General').filter(Boolean))
    return [...set]
  }, [orderedSpaces])

  useEffect(() => {
    if (floors.length && activeFloor === null) setActiveFloor(floors[0])
  }, [floors])

  const filteredSpaces = useMemo(() => {
    if (!activeFloor) return orderedSpaces
    return orderedSpaces.filter((s) => (s.tipo || 'General') === activeFloor)
  }, [orderedSpaces, activeFloor])

  const selectedSpace = useMemo(
    () => spaces.find((s) => String(s.id) === String(form.espacioId)) || null,
    [form.espacioId, spaces],
  )
  const selectedOccupied = Boolean(selectedSpace?.ocupado)

  const totalSpaces = orderedSpaces.length
  const ocupados = orderedSpaces.filter((s) => s.ocupado).length
  const libres = totalSpaces - ocupados
  const pctLibre = totalSpaces > 0 ? Math.round((libres / totalSpaces) * 100) : 0

  const handleChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const resetForm = () => {
    setForm(INITIAL_FORM)
    espacioRef.current?.focus()
  }

  const handleCancelar = () => { setError(null); setSuccess(null); resetForm() }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null); setSuccess(null)
    if (!form.espacioId) { setError('Debe seleccionar un espacio.'); espacioRef.current?.focus(); return }
    if (selectedOccupied) { setError('El espacio seleccionado ya está ocupado. Elija otro espacio libre.'); return }
    if (!form.placa.trim()) { setError('El número de placa es obligatorio.'); return }
    if (!form.propietario.trim()) { setError('El nombre del propietario es obligatorio.'); return }
    setSaving(true)
    try {
      await apiPost('/api/vehiculos/entrada', {
        placa: form.placa.trim(),
        modelo: form.modelo.trim(),
        propietario: form.propietario.trim(),
        espacio_id: form.espacioId,
        duracion_estimada: form.duracion,
        notas: form.notas.trim(),
      })
      setSuccess('Vehículo registrado exitosamente.')
      setSpaces((cur) =>
        cur.map((sp) => String(sp.id) === String(form.espacioId) ? { ...sp, ocupado: true, estado: 'ocupado' } : sp),
      )
      resetForm()
    } catch (err) {
      setError(err.message || 'No se pudo registrar el ingreso.')
    } finally {
      setSaving(false)
    }
  }

  /* click a space on the map to auto-select it */
  const handleSpaceClick = (space) => {
    if (space.ocupado) return
    setForm((f) => ({ ...f, espacioId: String(space.id) }))
  }

  return (
    <div style={s.page}>

      {/* -- Topbar -- */}
      <div style={s.topbar}>
        <button type="button" style={s.newBtn} onClick={() => { setError(null); setSuccess(null); resetForm() }}>
          <Icon name="add" size={16} />
          Nueva Entrada
        </button>

        {/* Campana: override de clases CSS globales para igualar tamano al boton de ayuda */}
        <style>{`.sp-bell-fix .module-icon-btn{width:42px!important;height:42px!important;min-width:42px!important;min-height:42px!important;padding:0!important;border-radius:10px!important;background:${C.card}!important;border:1px solid rgba(90,202,249,0.10)!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;font-size:20px!important}`}</style>
        <div className="sp-bell-fix">
          <NotificationsBell />
        </div>

        <button type="button" style={s.iconBtn} onClick={() => setShowHelpModal(true)} aria-label="Ayuda">
          <Icon name="help" size={20} />
        </button>
      </div>

      {/* -- Header -- */}
      <div style={s.header}>
        <div>
          <div style={s.breadcrumb}>
            SmartPark
            <span style={s.breadcrumbAccent}>/</span>
            <span style={s.breadcrumbAccent}>Asignar Parqueo</span>
          </div>
          <h1>Asignar Parqueo</h1>
          <p style={s.pageSub}>Registre el ingreso de un nuevo vehículo de forma rápida y segura.</p>
        </div>
      </div>

      {/* -- Stats bar -- */}
      {!loading && (
        <div style={s.statsBar}>
          <div style={s.statPill(C.accent)}>
            <div style={s.statIco(C.accent)}><Icon name="local_parking" size={18} /></div>
            <div>
              <div style={s.statVal}>{totalSpaces}</div>
              <div style={s.statLbl}>Total espacios</div>
            </div>
          </div>
          <div style={s.statPill(C.success)}>
            <div style={s.statIco(C.success)}><Icon name="check_circle" size={18} /></div>
            <div>
              <div style={{ ...s.statVal, color: C.success }}>{libres}</div>
              <div style={s.statLbl}>Disponibles - {pctLibre}%</div>
            </div>
          </div>
          <div style={s.statPill(C.danger)}>
            <div style={s.statIco(C.danger)}><Icon name="directions_car" size={18} /></div>
            <div>
              <div style={{ ...s.statVal, color: C.danger }}>{ocupados}</div>
              <div style={s.statLbl}>Ocupados</div>
            </div>
          </div>
        </div>
      )}

      {/* -- Feedback -- */}
      {error && (
        <div style={s.feedbackError}>
          <Icon name="error" size={16} />{error}
        </div>
      )}
      {success && (
        <div style={s.feedbackSuccess}>
          <Icon name="check_circle" size={16} />{success}
        </div>
      )}
      {selectedOccupied && !error && (
        <div style={s.feedbackError}>
          <Icon name="block" size={16} />El espacio seleccionado está ocupado. Elija uno disponible.
        </div>
      )}

      {/* -- Two-column layout -- */}
      <div style={s.twoCol}>

        {/* -- LEFT: Form card -- */}
        <div style={s.formCard}>
          <div style={s.formCardHead}>
            <div style={s.formCardHeadIco}><Icon name="list_alt" size={18} /></div>
            <div>
              <h2 style={s.formCardTitle}>Datos del Vehículo</h2>
              <p style={s.formCardSub}>Complete los campos para registrar la entrada</p>
            </div>
          </div>

          <div style={s.formBody}>
            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} style={{ ...s.skeleton, height: i === 5 ? 80 : 52, gridColumn: i === 5 ? '1/-1' : 'auto' }} />
                ))}
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div style={s.formGrid}>

                  {/* Espacio */}
                  <label style={s.fieldLabel}>
                    <span>Seleccionar Espacio</span>
                    <div style={s.inputWrap}>
                      <select
                        ref={espacioRef}
                        value={form.espacioId}
                        onChange={handleChange('espacioId')}
                        required
                        style={{ ...s.inputBase, appearance: 'none', cursor: 'pointer' }}
                      >
                        <option value="">Seleccione un espacio</option>
                        {orderedSpaces.map((sp) => (
                          <option key={sp.id} value={sp.id} disabled={sp.ocupado}>
                            {`${sp.nombre || 'Sin codigo'}${sp.tipo ? ` - Piso ${sp.tipo}` : ''} - ${sp.ocupado ? 'Ocupado' : 'Libre'}`}
                          </option>
                        ))}
                      </select>
                      <Icon name="expand_more" size={18} />
                    </div>
                  </label>

                  {/* Placa */}
                  <label style={s.fieldLabel}>
                    <span>Número de Placa</span>
                    <div style={s.inputWrap}>
                      <input
                        type="text"
                        value={form.placa}
                        onChange={handleChange('placa')}
                        placeholder="EJ: ABC-1234"
                        required
                        style={s.inputBase}
                      />
                      <Icon name="badge" size={18} />
                    </div>
                  </label>

                  {/* Modelo */}
                  <label style={s.fieldLabel}>
                    <span>Modelo del Vehículo</span>
                    <div style={s.inputWrap}>
                      <input
                        type="text"
                        value={form.modelo}
                        onChange={handleChange('modelo')}
                        placeholder="EJ: Toyota Corolla 2022"
                        style={s.inputBase}
                      />
                      <Icon name="directions_car" size={18} />
                    </div>
                  </label>

                  {/* Propietario */}
                  <label style={s.fieldLabel}>
                    <span>Nombre del Propietario</span>
                    <div style={s.inputWrap}>
                      <input
                        type="text"
                        value={form.propietario}
                        onChange={handleChange('propietario')}
                        placeholder="Nombre completo"
                        required
                        style={s.inputBase}
                      />
                      <Icon name="person" size={18} />
                    </div>
                  </label>

                  {/* Duración */}
                  <label style={s.fieldLabel}>
                    <span>Duración Estimada</span>
                    <div style={s.inputWrap}>
                      <select
                        value={form.duracion}
                        onChange={handleChange('duracion')}
                        style={{ ...s.inputBase, appearance: 'none', cursor: 'pointer' }}
                      >
                        {DURACIONES.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <Icon name="schedule" size={18} />
                    </div>
                  </label>

                  {/* Espacio preview */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.textSoft }}>Espacio Seleccionado</span>
                    <div style={{
                      height: 46,
                      borderRadius: 10,
                      border: `1px solid ${selectedSpace ? (selectedOccupied ? 'rgba(248,81,73,0.4)' : 'rgba(63,185,80,0.4)') : C.border}`,
                      background: selectedSpace ? (selectedOccupied ? 'rgba(248,81,73,0.08)' : 'rgba(63,185,80,0.08)') : C.cardDeep,
                      display: 'flex',
                      alignItems: 'center',
                      paddingInline: 14,
                      gap: 8,
                      fontSize: 13,
                      fontWeight: 700,
                      color: selectedSpace ? (selectedOccupied ? C.danger : C.success) : C.textSoft,
                    }}>
                      <Icon name={selectedSpace ? (selectedOccupied ? 'block' : 'check_circle') : 'location_on'} size={16} />
                      {selectedSpace ? `${selectedSpace.nombre}${selectedSpace.tipo ? ` - ${selectedSpace.tipo}` : ''}` : 'Ninguno aún'}
                    </div>
                  </div>

                  {/* Notas */}
                  <label style={{ ...s.fieldLabel, ...s.fieldFull }}>
                    <span>Notas adicionales <span style={{ fontWeight: 400, opacity: 0.6 }}>(Opcional)</span></span>
                    <textarea
                      value={form.notas}
                      onChange={handleChange('notas')}
                      placeholder="Estado del vehículo, objetos de valor, observaciones..."
                      rows={3}
                      style={s.textarea}
                    />
                  </label>
                </div>

                {/* Actions */}
                <div style={s.formActions}>
                  <button type="button" style={s.btnCancel} onClick={handleCancelar}>
                    Cancelar
                  </button>
                  <button type="submit" style={s.btnSubmit(saving || selectedOccupied)} disabled={saving || selectedOccupied}>
                    <Icon name="check_circle" size={16} />
                    {saving ? 'Registrando...' : 'Registrar'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* -- RIGHT: Map card -- */}
        <div style={s.mapCard}>
          <div style={s.mapHead}>
            <div>
              <h2 style={s.mapTitle}>Mapa en Tiempo Real</h2>
              <p style={s.mapSub}>Toca un espacio libre para seleccionarlo</p>
            </div>
            <button type="button" style={s.mapBtn} onClick={() => setShowMapModal(true)}>
              <Icon name="open_in_full" size={13} />
              Plano completo
            </button>
          </div>

          <div style={s.mapBody}>
            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                {Array.from({ length: 16 }).map((_, i) => (
                  <div key={i} style={{ ...s.skeleton, height: 52 }} />
                ))}
              </div>
            ) : orderedSpaces.length === 0 ? (
              <div style={s.emptyMap}>
                <Icon name="location_off" size={32} />
                <p>No hay espacios registrados.</p>
              </div>
            ) : (
              <>
                {/* Legend */}
                <div style={s.legend}>
                  <div style={s.legendItem}>
                    <div style={s.legendDot('rgba(63,185,80,0.7)')} />
                    Libre
                  </div>
                  <div style={s.legendItem}>
                    <div style={s.legendDot('rgba(248,81,73,0.7)')} />
                    Ocupado
                  </div>
                  <div style={s.legendItem}>
                    <div style={s.legendDot(C.accent)} />
                    Seleccionado
                  </div>
                </div>

                {/* Floor tabs */}
                {floors.length > 1 && (
                  <div style={s.floorTabs}>
                    {floors.map((f) => (
                      <button key={f} type="button" style={s.floorTab(activeFloor === f)} onClick={() => setActiveFloor(f)}>
                        {f}
                      </button>
                    ))}
                  </div>
                )}

                {/* Space cells */}
                <div style={s.spaceGrid}>
                  {filteredSpaces.map((sp) => {
                    const isSelected = String(sp.id) === String(form.espacioId)
                    return (
                      <div
                        key={sp.id}
                        style={s.spaceCell(sp.ocupado ? 'ocupado' : 'disponible', isSelected)}
                        onClick={() => handleSpaceClick(sp)}
                        title={`${sp.nombre} - ${sp.ocupado ? 'Ocupado' : 'Libre'}`}
                        role="button"
                        tabIndex={sp.ocupado ? -1 : 0}
                        onKeyDown={(e) => e.key === 'Enter' && handleSpaceClick(sp)}
                      >
                        {sp.nombre}
                        {isSelected && (
                          <span style={{
                            position: 'absolute',
                            top: -5,
                            right: -5,
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            background: C.accent,
                            border: `2px solid ${C.card}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <span style={{ fontSize: 8, color: C.bg, fontWeight: 900 }}>?</span>
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Footer stats */}
                <div style={s.mapFooter}>
                  <span>{libres} libre{libres !== 1 ? 's' : ''}</span>
                  <span style={{ color: C.danger }}>{ocupados} ocupado{ocupados !== 1 ? 's' : ''}</span>
                  <span style={{ color: C.success }}>{pctLibre}% disponible</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* -- Accesos rapidos (siempre visible) -- */}
      <div style={{ marginTop: 20, background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <div style={s.formCardHead}>
          <div style={s.formCardHeadIco}><Icon name="grid_view" size={18} /></div>
          <div>
            <h2 style={s.formCardTitle}>Accesos Rápidos</h2>
            <p style={s.formCardSub}>Navega a las secciones más usadas desde aquí</p>
          </div>
        </div>
        <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {[
            { label: 'Liberar Parqueo',    sub: 'Registrar la salida de un vehículo', icon: 'logout',          color: C.success, path: '/parking/release'   },
            { label: 'Espacios Ocupados',  sub: 'Ver el plano completo en tiempo real', icon: 'map',            color: C.accent,  path: '/parking/occupied'  },
            { label: 'Historial',          sub: 'Consultar registros de entradas/salidas', icon: 'history',     color: C.primary, path: '/historial'          },
            { label: 'Gestión de Cobros',  sub: 'Revisar pagos y tarifas pendientes', icon: 'payments',        color: 'var(--accent)', path: '/cobros'              },
          ].map(({ label, sub, icon, color, path }) => (
            <button
              key={label}
              type="button"
              onClick={() => navigate(path)}
              style={{
                background: C.cardDeep,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                padding: '16px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'border-color 0.2s, background 0.2s',
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `${color}55`
                e.currentTarget.style.background = `${color}0d`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = C.border
                e.currentTarget.style.background = C.cardDeep
              }}
            >
              <div style={{ ...s.statIco(color), flexShrink: 0 }}>
                <Icon name={icon} size={18} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 11, color: C.textSoft, lineHeight: 1.4 }}>{sub}</div>
              </div>
              <Icon name="chevron_right" size={16} style={{ marginLeft: 'auto', color: C.textSoft, flexShrink: 0 }} />
            </button>
          ))}
        </div>
      </div>

      {showMapModal && (
        <div style={s.backdrop} onClick={() => setShowMapModal(false)}>
          <div style={{ ...s.modal, width: 'min(980px, 100%)', maxHeight: '88vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={s.modalTitle}>Plano completo</h2>
            <div style={s.floorTabs}>
              {floors.map((f) => (
                <button key={f} type="button" style={s.floorTab(activeFloor === f)} onClick={() => setActiveFloor(f)}>
                  {f}
                </button>
              ))}
            </div>
            <div style={{ ...s.spaceGrid, gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))' }}>
              {filteredSpaces.map((sp) => {
                const isSelected = String(sp.id) === String(form.espacioId)
                return (
                  <div
                    key={sp.id}
                    style={{ ...s.spaceCell(sp.ocupado ? 'ocupado' : 'disponible', isSelected), height: 68 }}
                    onClick={() => handleSpaceClick(sp)}
                    role="button"
                    tabIndex={sp.ocupado ? -1 : 0}
                    onKeyDown={(e) => e.key === 'Enter' && handleSpaceClick(sp)}
                  >
                    {sp.nombre}
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
              <button type="button" style={{ ...s.btnSubmit(false), padding: '10px 24px' }} onClick={() => setShowMapModal(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -- Help Modal -- */}
      {showHelpModal && (
        <div style={s.backdrop} onClick={() => setShowHelpModal(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={s.modalTitle}>¿Cómo asignar un parqueo?</h2>
            {[
              ['Seleccione un espacio libre en el mapa o en el listado.', false],
              ['Escriba la placa y el nombre del propietario.', false],
              ['Agregue modelo, duración estimada y notas si lo necesita.', false],
              ['Pulse "Registrar Ingreso" para ocupar el espacio.', true],
            ].map(([text, highlight], i) => (
              <div key={i} style={s.stepRow(highlight)}>
                <div style={s.stepNum}>{i + 1}</div>
                <p style={s.stepText}>{text}</p>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
              <button
                type="button"
                style={{ ...s.btnSubmit(false), padding: '10px 24px' }}
                onClick={() => setShowHelpModal(false)}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}




