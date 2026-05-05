import { useEffect, useMemo, useState } from 'react'

import { apiGet, apiPost, getCachedApiData } from '../lib/api'

const ITBIS_RATE = 0.18

const formatCurrency = (value) =>
  new Intl.NumberFormat('es-DO', {
    style: 'currency', currency: 'DOP', minimumFractionDigits: 2,
  }).format(Number(value || 0))

const parseDate = (value) => {
  if (!value) return null
  const date = new Date(String(value).replace('Z', '+00:00'))
  return Number.isNaN(date.getTime()) ? null : date
}

const formatDateTime = (value) => {
  const date = parseDate(value)
  if (!date) return '-'
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(date)
}

const formatDuration = (minutes) => {
  const total = Math.max(0, Number(minutes || 0))
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h <= 0) return `${m} min`
  if (m <= 0) return `${h}h`
  return `${h}h ${m}m`
}

const formatSince = (entryValue) => {
  const start = parseDate(entryValue)
  if (!start) return '--'
  const totalMins = Math.max(0, Math.floor((Date.now() - start.getTime()) / 60000))
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  return `${h}h ${String(m).padStart(2, '0')}m`
}

const normalizeSpace = (space = {}) => ({
  id: String(space.id || ''),
  codigo: space.codigo || space.numero_mostrar || space.nombre || '',
})

const getBillableHours = (minutes) => Math.max(1, Math.ceil(Math.max(0, Number(minutes || 0)) / 60))

function buildInvoiceData({ vehicle, exitTime, hourlyRate }) {
  const entryDate = parseDate(vehicle?.hora_entrada || vehicle?.entry_time)
  const exitDate = exitTime || new Date()
  const totalMinutes = Math.max(1, Math.ceil((exitDate.getTime() - (entryDate?.getTime() || 0)) / 60000))
  const billedHours = getBillableHours(totalMinutes)
  const rate = Number(hourlyRate || 0)
  const subtotalAmount = billedHours * rate
  const itbisAmount = subtotalAmount * ITBIS_RATE
  const totalAmount = subtotalAmount + itbisAmount
  return {
    numeroFactura: `FAC-${Date.now()}`,
    fechaEmision: formatDateTime(new Date().toISOString()),
    logoUrl: '/images/logo-smartpark.png',
    placa: vehicle?.placa || 'Sin placa',
    modelo: vehicle?.modelo || vehicle?.model || 'Vehículo registrado',
    propietario: vehicle?.propietario || vehicle?.owner || 'Sin propietario',
    espacio: vehicle?.espacioLabel || 'Sin espacio',
    entrada: formatDateTime(vehicle?.hora_entrada || vehicle?.entry_time),
    salida: formatDateTime(exitDate.toISOString()),
    duracion: formatDuration(totalMinutes),
    cantidadHoras: `${(totalMinutes / 60).toFixed(2)} h`,
    tarifa: formatCurrency(rate),
    subtotal: formatCurrency(subtotalAmount),
    itbis: formatCurrency(itbisAmount),
    total: formatCurrency(totalAmount),
    totalRaw: totalAmount,
  }
}

function buildPrintableInvoice(invoice) {
  return `<!doctype html><html lang="es"><head><meta charset="UTF-8"/><title>${invoice.numeroFactura}</title>
  <style>body{margin:0;font-family:Arial,sans-serif;background:#f8fafc;color:#0f172a}.sheet{max-width:860px;margin:0 auto;background:#fff;min-height:100vh}.header{background:#0f172a;color:#fff;padding:32px 40px;display:flex;justify-content:space-between;gap:24px}.brand{display:flex;gap:16px;align-items:center}.brand img{width:72px;height:72px;object-fit:contain;border-radius:50%;background:rgba(255,255,255,.08);padding:6px}.brand h1{margin:0;font-size:28px}.brand p{margin:6px 0 0;color:#bfdbfe;letter-spacing:.12em;text-transform:uppercase;font-size:12px}.meta{text-align:right;font-size:14px}.meta strong{display:block;font-size:22px;margin-bottom:10px}.content{padding:32px 40px 40px}.section-title{font-size:12px;text-transform:uppercase;letter-spacing:.22em;color:#64748b;margin:0 0 14px}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px 24px;margin-bottom:24px}.card{border:1px solid #e2e8f0;border-radius:16px;padding:18px 20px;background:#f8fafc}.card span{display:block;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.16em;margin-bottom:8px}.card strong{font-size:18px}table{width:100%;border-collapse:collapse;margin:16px 0 24px}thead th{text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.16em;color:#64748b;padding:12px 10px;border-bottom:1px solid #cbd5e1}tbody td{padding:14px 10px;border-bottom:1px solid #e2e8f0}.summary{margin-left:auto;width:340px}.summary-row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #e2e8f0}.summary-total{display:flex;justify-content:space-between;margin-top:16px;padding:16px 18px;border-radius:16px;background:#0f172a;color:#fff;font-size:24px;font-weight:700}.footer{padding:24px 40px 40px;color:#475569;font-size:14px}@media print{body{margin:0;background:#fff}}</style></head>
  <body><div class="sheet"><div class="header"><div class="brand"><img src="${invoice.logoUrl}" alt="SmartPark"/><div><h1>SmartPark</h1><p>Control Total - Estacionamiento</p></div></div><div class="meta"><strong>${invoice.numeroFactura}</strong><div>Emisión: ${invoice.fechaEmision}</div></div></div>
  <div class="content"><p class="section-title">Facturado a</p><div class="grid"><div class="card"><span>Propietario</span><strong>${invoice.propietario}</strong></div><div class="card"><span>Placa</span><strong>${invoice.placa}</strong><div>${invoice.modelo}</div></div></div>
  <table><thead><tr><th>Descripción</th><th>Cantidad</th><th>Precio unitario</th><th>Total</th></tr></thead><tbody><tr><td>Estacionamiento - Espacio ${invoice.espacio}</td><td>${invoice.cantidadHoras}</td><td>${invoice.tarifa}</td><td>${invoice.subtotal}</td></tr></tbody></table>
  <p class="section-title">Detalle del servicio</p><div class="grid"><div class="card"><span>Entrada</span><strong>${invoice.entrada}</strong></div><div class="card"><span>Salida</span><strong>${invoice.salida}</strong></div><div class="card"><span>Duración</span><strong>${invoice.duracion}</strong></div><div class="card"><span>Espacio</span><strong>${invoice.espacio}</strong></div></div>
  <div class="summary"><div class="summary-row"><span>Subtotal</span><strong>${invoice.subtotal}</strong></div><div class="summary-row"><span>ITBIS (18%)</span><strong>${invoice.itbis}</strong></div><div class="summary-total"><span>Total</span><span>${invoice.total}</span></div></div></div>
  <div class="footer">Gracias por usar SmartPark - Entrada: ${invoice.entrada} - Salida: ${invoice.salida}</div></div>
  <script>window.onload=function(){window.print()}</script></body></html>`
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
  warning:   'var(--accent)',
}

const s = {
  page: {
    width: '100%', maxWidth: 1440,
    margin: '0 auto',
    fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
  },

  breadcrumb: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 14, fontWeight: 600, color: C.textSoft, marginBottom: 4,
  },
  breadcrumbAccent: { color: C.accent },
  pageTitle: {
    margin: 0,
    fontSize: 'clamp(2rem,4.5vw,3.4rem)',
    fontWeight: 800, fontFamily: "'Syne', sans-serif", background: 'linear-gradient(135deg, #e2e8f0 30%, var(--accent) 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
    lineHeight: 1.05, letterSpacing: '-0.5px',
  },
  pageSub: { margin: '6px 0 20px', color: C.textSoft, fontSize: '1rem' },

  /* stats */
  statsBar: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3,1fr)',
    gap: 12, marginBottom: 20,
  },
  statCard: (accent) => ({
    background: C.card,
    border: `1px solid ${C.border}`,
    borderLeft: `3px solid ${accent}`,
    borderRadius: 14, padding: '16px 20px',
    display: 'flex', alignItems: 'center', gap: 14,
  }),
  statIco: (accent) => ({
    width: 38, height: 38, borderRadius: 10,
    background: `${accent}18`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: accent, fontSize: 19, flexShrink: 0,
  }),
  statLabel: {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
    color: C.textSoft, textTransform: 'uppercase', marginBottom: 4,
  },
  statValue: { fontSize: 22, fontWeight: 800, fontFamily: "'Syne', sans-serif", background: 'linear-gradient(135deg, #e2e8f0 30%, var(--accent) 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', lineHeight: 1 },

  /* feedback */
  feedbackError: {
    borderRadius: 12, padding: '12px 16px', marginBottom: 16,
    background: 'rgba(110,16,16,0.28)', border: '1px solid rgba(248,81,73,0.45)',
    color: '#ffb4b1', fontWeight: 600, fontSize: 13,
    display: 'flex', alignItems: 'center', gap: 8,
  },

  /* cards grid */
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))',
    gap: 14,
  },

  /* vehicle card */
  cobroCard: (selected) => ({
    background: C.card,
    border: `1px solid ${selected ? 'rgba(9,131,200,0.5)' : C.border}`,
    borderRadius: 14,
    padding: '18px 20px',
    display: 'flex', flexDirection: 'column', gap: 14,
    cursor: 'pointer',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxShadow: selected ? '0 0 0 3px rgba(9,131,200,0.15)' : 'none',
  }),
  cardTop: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  cardSpaceBadge: {
    background: 'rgba(9,131,200,0.18)', color: C.accent,
    fontWeight: 800, fontSize: 13, borderRadius: 7,
    padding: '4px 10px', letterSpacing: '0.03em',
  },
  activeBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '3px 10px', borderRadius: 20,
    fontSize: 11, fontWeight: 700,
    background: 'rgba(63,185,80,0.12)', color: C.success,
    border: `1px solid rgba(63,185,80,0.3)`,
  },
  activeDot: {
    width: 6, height: 6, borderRadius: '50%',
    background: C.success,
    animation: 'pulse 1.5s infinite',
  },
  cardVehicle: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: C.cardDeep, borderRadius: 10, padding: '10px 12px',
  },
  cardVehicleIco: {
    width: 34, height: 34, borderRadius: 8,
    background: 'rgba(9,131,200,0.12)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: C.accent, fontSize: 20, flexShrink: 0,
  },
  cardPlaca: { fontSize: 14, fontWeight: 800, fontFamily: "'Syne', sans-serif", background: 'linear-gradient(135deg, #e2e8f0 30%, var(--accent) 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', lineHeight: 1 },
  cardDetalle: { fontSize: 11, color: C.textSoft, marginTop: 3 },

  cardMeta: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
  },
  metaItem: {
    background: C.cardDeep, borderRadius: 8, padding: '8px 10px',
  },
  metaLabel: { fontSize: 10, color: C.textSoft, marginBottom: 3 },
  metaVal: { fontSize: 12, fontWeight: 700, color: '#fff' },

  cardCostRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 12, borderTop: `1px solid ${C.border}`,
  },
  costLabel: { fontSize: 10, color: C.textSoft, marginBottom: 2 },
  costVal: { fontSize: 18, fontWeight: 800, color: C.success },

  cardActions: { display: 'flex', gap: 8 },
  btnSecondary: {
    flex: 1,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '9px 0',
    background: C.cardDeep, color: C.textSoft,
    border: `1px solid ${C.borderMid}`,
    borderRadius: 9, fontWeight: 700, fontSize: 12,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  btnPrimary: {
    flex: 1,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '9px 0',
    background: C.primary, color: '#080f1e', boxShadow: '0 14px 34px rgba(56,189,248,0.18)',
    border: 'none',
    borderRadius: 9, fontWeight: 700, fontSize: 12,
    cursor: 'pointer', fontFamily: 'inherit',
  },

  /* empty */
  empty: {
    gridColumn: '1/-1',
    background: C.card, border: `1px solid ${C.border}`,
    borderRadius: 14, padding: '56px 24px',
    textAlign: 'center', color: C.textSoft,
  },
  emptyIco: {
    width: 52, height: 52, borderRadius: 14,
    background: 'rgba(9,131,200,0.1)', border: `1px solid rgba(9,131,200,0.2)`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 14px', color: C.accent, fontSize: 26,
  },

  /* skeleton */
  skeleton: {
    borderRadius: 12,
    background: 'linear-gradient(90deg,#041f3a 0%,#0a3460 50%,#041f3a 100%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.25s linear infinite',
  },

  /* modal */
  backdrop: {
    position: 'fixed', inset: 0,
    background: 'rgba(1,4,9,0.78)',
    display: 'grid', placeItems: 'center',
    padding: 24, zIndex: 100,
  },
  modal: {
    width: 'min(560px,100%)',
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 18, padding: 28,
    boxShadow: '0 24px 48px rgba(0,0,0,0.32)',
  },
  modalHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: 800, fontFamily: "'Syne', sans-serif", background: 'linear-gradient(135deg, #e2e8f0 30%, var(--accent) 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', margin: 0 },
  modalSub: { fontSize: 12, color: C.textSoft, marginTop: 4 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 8,
    background: C.cardDeep, border: `1px solid ${C.border}`,
    color: C.textSoft, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
  },
  invoiceGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr',
    gap: 10, marginBottom: 16,
  },
  invoiceItem: {
    background: C.cardDeep, borderRadius: 10, padding: '10px 14px',
  },
  invoiceLabel: { fontSize: 10, color: C.textSoft, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 },
  invoiceVal: { fontSize: 13, fontWeight: 700, color: '#fff' },
  divider: { height: 1, background: C.border, margin: '16px 0' },
  totalBox: {
    background: C.cardDeep,
    border: `1px solid rgba(9,131,200,0.3)`,
    borderRadius: 12, padding: '16px 18px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16,
  },
  totalLabel: { fontSize: 12, color: C.textSoft },
  totalVal: { fontSize: 26, fontWeight: 800, color: C.success },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 10 },
  modalBtnCancel: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '10px 20px', background: C.cardDeep, color: C.textSoft,
    border: `1px solid ${C.borderMid}`, borderRadius: 10,
    fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
  },
  modalBtnConfirm: (disabled) => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '10px 24px',
    background: disabled ? 'rgba(9,131,200,0.35)' : C.primary,
    color: '#fff', border: 'none', borderRadius: 10,
    fontWeight: 700, fontSize: 13,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit', opacity: disabled ? 0.7 : 1,
  }),
  modalBtnPrint: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '10px 20px',
    background: 'rgba(63,185,80,0.12)', color: C.success,
    border: `1px solid rgba(63,185,80,0.3)`,
    borderRadius: 10, fontWeight: 700, fontSize: 13,
    cursor: 'pointer', fontFamily: 'inherit',
  },
}

const Icon = ({ name, size = 16 }) => (
  <span className="material-symbols-outlined"
    style={{ fontSize: size, verticalAlign: 'middle', lineHeight: 1, flexShrink: 0 }}>
    {name}
  </span>
)

export default function Cobros() {
  const cachedVehiculos = getCachedApiData('/api/vehiculos')
  const cachedSpaces = getCachedApiData('/api/parking-spaces')
  const cachedSettings = getCachedApiData('/api/auth/settings')
  const hasCachedData = Boolean(cachedVehiculos || cachedSpaces || cachedSettings)

  const [vehicles, setVehicles] = useState(() =>
    Array.isArray(cachedVehiculos?.data) ? cachedVehiculos.data : [],
  )
  const [spaces, setSpaces] = useState(() =>
    Array.isArray(cachedSpaces?.data) ? cachedSpaces.data.map(normalizeSpace) : [],
  )
  const [hourlyRate, setHourlyRate] = useState(() =>
    Number(cachedSettings?.data?.hourly_rate || 50) || 50,
  )
  const [loading, setLoading] = useState(() => !hasCachedData)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState(null)
  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [vehicleToConfirm, setVehicleToConfirm] = useState(null)

  useEffect(() => {
    const load = async ({ showLoader = true } = {}) => {
      if (showLoader) setLoading(true)
      setError(null)
      try {
        const [vp, ep, sp] = await Promise.all([
          apiGet('/api/vehiculos'),
          apiGet('/api/parking-spaces'),
          apiGet('/api/auth/settings').catch(() => ({ data: {} })),
        ])
        setVehicles(Array.isArray(vp?.data) ? vp.data : [])
        setSpaces(Array.isArray(ep?.data) ? ep.data.map(normalizeSpace) : [])
        setHourlyRate(Number(sp?.data?.hourly_rate || 50) || 50)
      } catch (err) {
        setError(err.message || 'No se pudieron cargar los cobros.')
      } finally {
        setLoading(false)
      }
    }
    load({ showLoader: !hasCachedData })
  }, [])

  const spacesMap = useMemo(
    () => new Map(spaces.map((s) => [String(s.id), s.codigo || String(s.id).slice(0, 8)])),
    [spaces],
  )

  const activeVehicles = useMemo(() =>
    vehicles
      .filter((v) => String(v.status || v.estado || '').toLowerCase() === 'dentro')
      .map((v) => ({
        ...v,
        espacioLabel:
          spacesMap.get(String(v.espacio_id || v.space_id || '')) ||
          (v.espacio_id || v.space_id ? String(v.espacio_id || v.space_id).slice(0, 8) : 'Sin espacio'),
      })),
    [spacesMap, vehicles],
  )

  const invoicePreview = useMemo(() => {
    if (!selectedVehicle) return null
    return buildInvoiceData({ vehicle: selectedVehicle, exitTime: new Date(), hourlyRate })
  }, [hourlyRate, selectedVehicle])

  const handleCheckout = async () => {
    if (!vehicleToConfirm) return
    setProcessing(true); setError(null)
    try {
      const response = await apiPost('/api/vehiculos/salida', { placa: vehicleToConfirm.placa })
      const data = response?.data || {}
      const exitTime = data.hora_salida || data.exit_time || new Date().toISOString()
      setVehicles((cur) =>
        cur.map((v) =>
          v.placa === vehicleToConfirm.placa
            ? { ...v, status: 'fuera', estado: 'fuera', hora_salida: exitTime, exit_time: exitTime,
                monto_total: data.monto_total ?? v.monto_total }
            : v,
        ),
      )
      setVehicleToConfirm(null)
      if (selectedVehicle?.placa === vehicleToConfirm.placa) setSelectedVehicle(null)
      // FIX: Disparar evento para actualización inmediata del dashboard
      window.dispatchEvent(new CustomEvent('dashboard-refresh'))
    } catch (err) {
      setError(err.message || 'No se pudo completar la salida.')
    } finally {
      setProcessing(false)
    }
  }

  const handlePrint = () => {
    if (!invoicePreview) return
    const popup = window.open('', '_blank', 'width=980,height=900')
    if (!popup) return
    popup.document.open()
    popup.document.write(buildPrintableInvoice(invoicePreview))
    popup.document.close()
  }

  /* live cost per card */
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000)
    return () => clearInterval(id)
  }, [])

  const getLiveCost = (vehicle) => {
    const entry = parseDate(vehicle.hora_entrada || vehicle.entry_time)
    if (!entry) return '--'
    const mins = Math.max(0, Math.floor((Date.now() - entry.getTime()) / 60000))
    const billed = getBillableHours(mins)
    const subtotal = billed * hourlyRate
    return formatCurrency(subtotal + subtotal * ITBIS_RATE)
  }

  return (
    <div className="module-page cobros-page" style={s.page}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      `}</style>

      {/* -- Header -- */}
      <div className="module-header">
        <div>
          <div style={s.breadcrumb}>
            SmartPark
            <span style={s.breadcrumbAccent}>/</span>
            <span style={s.breadcrumbAccent}>Cobros</span>
          </div>
          <h1>Cobros</h1>
          <p>Gestiona el checkout y genera facturas por tiempo de estacionamiento.</p>
        </div>
      </div>

      {/* -- Stats -- */}
      {!loading && (
        <div style={s.statsBar}>
          {[
            { label: 'Vehículos activos',  value: activeVehicles.length,          icon: 'directions_car', accent: C.accent  },
            { label: 'Tarifa por hora',    value: formatCurrency(hourlyRate),      icon: 'payments',       accent: C.success },
            { label: 'Pendientes de pago', value: activeVehicles.length,           icon: 'receipt_long',   accent: C.danger  },
          ].map(({ label, value, icon, accent }) => (
            <div key={label} style={s.statCard(accent)}>
              <div style={s.statIco(accent)}><Icon name={icon} size={19} /></div>
              <div>
                <div style={s.statLabel}>{label}</div>
                <div style={{ ...s.statValue, color: accent === C.accent ? '#fff' : accent }}>{value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* -- Error -- */}
      {error && (
        <div style={s.feedbackError}><Icon name="error" size={15} />{error}</div>
      )}

      {/* -- Cards -- */}
      <div style={s.cardsGrid}>
        {loading && Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ ...s.skeleton, height: 220 }} />
        ))}

        {!loading && activeVehicles.length === 0 && (
          <div style={s.empty}>
            <div style={s.emptyIco}><Icon name="payments" size={26} /></div>
            <div style={{ fontWeight: 600, color: '#fff', marginBottom: 6 }}>
              No hay vehículos pendientes de cobro
            </div>
            <div style={{ fontSize: 12 }}>
              Los vehículos activos aparecerán aquí para gestionar su salida.
            </div>
          </div>
        )}

        {!loading && activeVehicles.map((vehicle) => {
          const isSelected = selectedVehicle?.placa === vehicle.placa
          const since = formatSince(vehicle.hora_entrada || vehicle.entry_time)
          const liveCost = getLiveCost(vehicle)

          return (
            <article
              key={vehicle.id || vehicle.placa}
              style={s.cobroCard(isSelected)}
              onClick={() => setSelectedVehicle(vehicle)}
            >
              {/* top */}
              <div style={s.cardTop}>
                <span style={s.cardSpaceBadge}>{vehicle.espacioLabel}</span>
                <span style={s.activeBadge}>
                  <span style={s.activeDot} />
                  Activo
                </span>
              </div>

              {/* vehicle */}
              <div style={s.cardVehicle}>
                <div style={s.cardVehicleIco}><Icon name="directions_car" size={20} /></div>
                <div>
                  <div style={s.cardPlaca}>{vehicle.placa || 'Sin placa'}</div>
                  <div style={s.cardDetalle}>
                    {vehicle.modelo || vehicle.model || 'Vehículo'} - {vehicle.propietario || vehicle.owner || 'Sin propietario'}
                  </div>
                </div>
              </div>

              {/* meta */}
              <div style={s.cardMeta}>
                <div style={s.metaItem}>
                  <div style={s.metaLabel}>Tiempo</div>
                  <div style={s.metaVal}>{since}</div>
                </div>
                <div style={s.metaItem}>
                  <div style={s.metaLabel}>Entrada</div>
                  <div style={{ ...s.metaVal, fontSize: 11 }}>
                    {formatDateTime(vehicle.hora_entrada || vehicle.entry_time)}
                  </div>
                </div>
              </div>

              {/* cost */}
              <div style={s.cardCostRow}>
                <div>
                  <div style={s.costLabel}>Costo estimado (c/ITBIS)</div>
                  <div style={s.costVal}>{liveCost}</div>
                </div>
              </div>

              {/* actions */}
              <div style={s.cardActions}>
                <button
                  type="button"
                  style={s.btnSecondary}
                  onClick={(e) => { e.stopPropagation(); setSelectedVehicle(vehicle) }}
                >
                  <Icon name="receipt_long" size={14} />
                  Factura
                </button>
                <button
                  type="button"
                  style={s.btnPrimary}
                  onClick={(e) => { e.stopPropagation(); setVehicleToConfirm(vehicle) }}
                >
                  <Icon name="logout" size={14} />
                  Registrar Salida
                </button>
              </div>
            </article>
          )
        })}
      </div>

      {/* -- Invoice modal -- */}
      {selectedVehicle && invoicePreview && (
        <div style={s.backdrop} onClick={() => setSelectedVehicle(null)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div>
                <h2 style={s.modalTitle}>Factura - {invoicePreview.placa}</h2>
                <p style={s.modalSub}>{invoicePreview.numeroFactura} - {invoicePreview.fechaEmision}</p>
              </div>
              <button type="button" style={s.closeBtn} onClick={() => setSelectedVehicle(null)}>
                <Icon name="close" size={18} />
              </button>
            </div>

            <div style={s.invoiceGrid}>
              {[
                ['Propietario', invoicePreview.propietario],
                ['Placa',       invoicePreview.placa],
                ['Modelo',      invoicePreview.modelo],
                ['Espacio',     invoicePreview.espacio],
                ['Entrada',     invoicePreview.entrada],
                ['Salida',      invoicePreview.salida],
                ['Duración',    invoicePreview.duracion],
                ['Tarifa/hora', invoicePreview.tarifa],
              ].map(([label, val]) => (
                <div key={label} style={s.invoiceItem}>
                  <div style={s.invoiceLabel}>{label}</div>
                  <div style={s.invoiceVal}>{val}</div>
                </div>
              ))}
            </div>

            <div style={s.divider} />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, fontSize: 13, color: C.textSoft, marginBottom: 8 }}>
              <span>Subtotal: <strong style={{ color: '#fff' }}>{invoicePreview.subtotal}</strong></span>
              <span>ITBIS 18%: <strong style={{ color: '#fff' }}>{invoicePreview.itbis}</strong></span>
            </div>

            <div style={s.totalBox}>
              <div>
                <div style={s.totalLabel}>Total a pagar</div>
              </div>
              <div style={s.totalVal}>{invoicePreview.total}</div>
            </div>

            <div style={s.modalActions}>
              <button type="button" style={s.modalBtnPrint} onClick={handlePrint}>
                <Icon name="print" size={15} />
                Imprimir
              </button>
              <button type="button" style={s.modalBtnCancel} onClick={() => setSelectedVehicle(null)}>
                Cerrar
              </button>
              <button
                type="button"
                style={s.modalBtnConfirm(false)}
                onClick={() => { setSelectedVehicle(null); setVehicleToConfirm(selectedVehicle) }}
              >
                <Icon name="logout" size={15} />
                Registrar Salida
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -- Confirm modal -- */}
      {vehicleToConfirm && (
        <div style={s.backdrop} onClick={() => setVehicleToConfirm(null)}>
          <div style={{ ...s.modal, maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div>
                <h2 style={s.modalTitle}>Confirmar salida</h2>
                <p style={s.modalSub}>Esta acción liberará el espacio asignado.</p>
              </div>
              <button type="button" style={s.closeBtn} onClick={() => setVehicleToConfirm(null)}>
                <Icon name="close" size={18} />
              </button>
            </div>

            <div style={{ ...s.invoiceGrid, gridTemplateColumns: '1fr 1fr', marginBottom: 16 }}>
              {[
                ['Placa',    vehicleToConfirm.placa],
                ['Espacio',  vehicleToConfirm.espacioLabel],
                ['Modelo',   vehicleToConfirm.modelo || 'Sin modelo'],
                ['Propietario', vehicleToConfirm.propietario || 'Sin propietario'],
              ].map(([label, val]) => (
                <div key={label} style={s.invoiceItem}>
                  <div style={s.invoiceLabel}>{label}</div>
                  <div style={s.invoiceVal}>{val}</div>
                </div>
              ))}
            </div>

            <div style={{ ...s.totalBox, marginBottom: 20 }}>
              <div style={s.totalLabel}>Costo estimado (c/ITBIS)</div>
              <div style={s.totalVal}>{getLiveCost(vehicleToConfirm)}</div>
            </div>

            <div style={s.modalActions}>
              <button type="button" style={s.modalBtnCancel} onClick={() => setVehicleToConfirm(null)}>
                Cancelar
              </button>
              <button
                type="button"
                style={s.modalBtnConfirm(processing)}
                disabled={processing}
                onClick={handleCheckout}
              >
                <Icon name="check_circle" size={15} />
                {processing ? 'Procesando...' : 'Confirmar salida'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}




