import { useEffect, useState } from 'react'

import useApi from '../hooks/useApi'
import { invalidateApiCache } from '../lib/api'
import { registerExit } from '../services/api'

/* ─── Helpers ─────────────────────────────────────────────────────────── */
function formatMoney(value) {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency', currency: 'DOP', minimumFractionDigits: 2,
  }).format(Number(value) || 0)
}

function formatDuration(minutes) {
  const total = Math.max(0, Number(minutes || 0))
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h <= 0) return `${m} min`
  if (m <= 0) return `${h}h`
  return `${h}h ${m}m`
}

function nowFormatted() {
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date())
}

function invoiceNumber() {
  return `FAC-${Date.now()}`
}

/* ─── PDF builder ─────────────────────────────────────────────────────── */
function buildPDF({ placa, minutes, amount, facNum, fecha }) {
  const itbisRate = 0
  const subtotal = amount
  const itbis = amount - subtotal
  const horasBilled = Math.max(1, Math.ceil(minutes / 60))
  const tarifaHora = subtotal / horasBilled

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Factura ${facNum} - SmartPark</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',Arial,sans-serif;background:#f1f5f9;color:#0f172a;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .page{max-width:820px;margin:32px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.12)}
    .header{background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 60%,#0c4a6e 100%);padding:36px 48px;display:flex;justify-content:space-between;align-items:center;gap:24px}
    .brand{display:flex;align-items:center;gap:16px}
    .brand-icon{width:56px;height:56px;background:linear-gradient(135deg,#38bdf8,#0ea5e9);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:28px;box-shadow:0 8px 20px rgba(56,189,248,.35)}
    .brand-name{font-size:26px;font-weight:800;color:#fff;letter-spacing:-.5px}
    .brand-sub{font-size:11px;color:#7dd3fc;text-transform:uppercase;letter-spacing:.15em;margin-top:3px}
    .inv-meta{text-align:right}
    .inv-badge{display:inline-block;background:rgba(56,189,248,.18);border:1px solid rgba(56,189,248,.35);color:#7dd3fc;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;padding:5px 14px;border-radius:20px;margin-bottom:10px}
    .inv-num{font-size:22px;font-weight:800;color:#fff;margin-bottom:4px}
    .inv-date{font-size:12px;color:#94a3b8}
    .status-bar{background:linear-gradient(90deg,#0ea5e9,#38bdf8);padding:12px 48px;display:flex;align-items:center;gap:10px}
    .sdot{width:8px;height:8px;background:#fff;border-radius:50%;opacity:.9}
    .stxt{font-size:12px;font-weight:700;color:#fff;letter-spacing:.06em;text-transform:uppercase}
    .content{padding:40px 48px}
    .sec-lbl{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.18em;margin-bottom:14px;display:flex;align-items:center;gap:8px}
    .sec-lbl::after{content:'';flex:1;height:1px;background:#e2e8f0}
    .client-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:32px}
    .info-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 18px}
    .info-lbl{font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.12em;margin-bottom:6px}
    .info-val{font-size:15px;font-weight:700;color:#0f172a}
    .table-wrap{margin-bottom:28px}
    table{width:100%;border-collapse:collapse;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0}
    thead{background:linear-gradient(135deg,#0f172a,#1e293b)}
    thead th{padding:14px 18px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.12em;text-align:left}
    thead th:last-child{text-align:right}
    tbody tr{border-bottom:1px solid #f1f5f9}
    tbody td{padding:16px 18px;font-size:13px;color:#0f172a;vertical-align:middle}
    tbody td:last-child{text-align:right;font-weight:700}
    .svc-name{font-weight:600}
    .svc-sub{font-size:11px;color:#64748b;margin-top:3px}
    .detail-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:28px}
    .detail-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;text-align:center}
    .detail-lbl{font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.12em;margin-bottom:6px}
    .detail-val{font-size:13px;font-weight:700;color:#0f172a}
    .totals{display:flex;justify-content:flex-end;margin-bottom:32px}
    .totals-box{width:320px}
    .total-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:13px}
    .total-row span:first-child{color:#64748b}
    .total-row span:last-child{font-weight:600;color:#0f172a}
    .total-final{display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding:18px 22px;background:linear-gradient(135deg,#0f172a,#1e3a5f);border-radius:14px}
    .total-lbl{font-size:12px;color:#7dd3fc;font-weight:600;text-transform:uppercase;letter-spacing:.1em}
    .total-val{font-size:26px;font-weight:800;color:#fff}
    .footer{background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 48px;display:flex;justify-content:space-between;align-items:center;gap:16px}
    .foot-brand{font-size:13px;font-weight:700;color:#0f172a}
    .foot-sub{font-size:11px;color:#94a3b8;margin-top:2px}
    .foot-note{font-size:11px;color:#94a3b8;text-align:right}
    .thank{display:inline-block;background:linear-gradient(135deg,#0ea5e9,#38bdf8);-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:800;font-size:14px}
    @media print{body{background:#fff;margin:0}.page{margin:0;border-radius:0;box-shadow:none;max-width:100%}}
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="brand">
      <div class="brand-icon">🅿</div>
      <div>
        <div class="brand-name">SmartPark</div>
        <div class="brand-sub">Control Total · Estacionamiento</div>
      </div>
    </div>
    <div class="inv-meta">
      <div class="inv-badge">Factura Oficial</div>
      <div class="inv-num">${facNum}</div>
      <div class="inv-date">Emitida: ${fecha}</div>
    </div>
  </div>
  <div class="status-bar">
    <div class="sdot"></div>
    <div class="stxt">Servicio de estacionamiento · Pago procesado</div>
  </div>
  <div class="content">
    <div class="sec-lbl">Información del vehículo</div>
    <div class="client-grid">
      <div class="info-card"><div class="info-lbl">Placa</div><div class="info-val">${placa}</div></div>
      <div class="info-card"><div class="info-lbl">Fecha de emisión</div><div class="info-val">${fecha}</div></div>
    </div>
    <div class="sec-lbl">Detalle del servicio</div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Descripción</th><th>Cantidad</th><th>Precio unitario</th><th>Total</th></tr></thead>
        <tbody>
          <tr>
            <td>
              <div class="svc-name">Servicio de Estacionamiento</div>
              <div class="svc-sub">Placa: ${placa} · Duración: ${formatDuration(minutes)}</div>
            </td>
            <td>${horasBilled} h</td>
            <td>${formatMoney(tarifaHora)}/hr</td>
            <td>${formatMoney(subtotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="sec-lbl">Resumen</div>
    <div class="detail-grid">
      <div class="detail-card"><div class="detail-lbl">Duración total</div><div class="detail-val">${formatDuration(minutes)}</div></div>
      <div class="detail-card"><div class="detail-lbl">Horas facturadas</div><div class="detail-val">${horasBilled} h</div></div>
      <div class="detail-card"><div class="detail-lbl">N° Factura</div><div class="detail-val">${facNum}</div></div>
    </div>
    <div class="totals">
      <div class="totals-box">
        <div class="total-row"><span>Subtotal</span><span>${formatMoney(subtotal)}</span></div>
        <div class="total-row"><span>ITBIS</span><span>${formatMoney(itbis)}</span></div>
        <div class="total-final">
          <div><div class="total-lbl">Total pagado</div></div>
          <div class="total-val">${formatMoney(amount)}</div>
        </div>
      </div>
    </div>
  </div>
  <div class="footer">
    <div>
      <div class="foot-brand">SmartPark · Control Total</div>
      <div class="foot-sub">Gracias por usar nuestro servicio de estacionamiento</div>
    </div>
    <div class="foot-note">
      <span class="thank">¡Gracias por su visita!</span><br/>
      ${facNum} · ${fecha}
    </div>
  </div>
</div>
<script>window.onload = function(){ window.print() }</script>
</body>
</html>`
}

function openPDF(data) {
  const facNum = invoiceNumber()
  const fecha  = nowFormatted()
  const popup = window.open('', '_blank', 'width=980,height=900')
  if (!popup) return
  popup.document.open()
  popup.document.write(buildPDF({
    placa:   data.placa   || data.plate  || '---',
    minutes: data.duration_minutes || 0,
    amount:  data.amount_to_pay    || 0,
    facNum,
    fecha,
  }))
  popup.document.close()
}

/* ─── Styles ──────────────────────────────────────────────────────────── */
const C = {
  bg:      '#080f1e',
  surface: '#0d1b2e',
  deep:    '#071121',
  accent:  '#38bdf8',
  accentD: '#0ea5e9',
  success: '#3fb950',
  danger:  '#f85149',
  text:    '#e2e8f0',
  dim:     '#64748b',
  border:  'rgba(56,189,248,0.14)',
}

const overlay = {
  position: 'fixed', inset: 0,
  background: 'rgba(1,4,9,0.88)',
  backdropFilter: 'blur(6px)',
  display: 'grid', placeItems: 'center',
  padding: 20, zIndex: 9999,
}

const modal = {
  width: 'min(480px,100%)',
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 22,
  overflow: 'hidden',
  boxShadow: '0 40px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(56,189,248,.07)',
  fontFamily: "'DM Sans','Inter',system-ui,sans-serif",
  animation: 'spSlideIn .28s cubic-bezier(.16,1,.3,1) both',
}

/* ─── Component ───────────────────────────────────────────────────────── */
export default function ModalExit({ isOpen, onClose, onSuccess, initialPlate = '' }) {
  const [plate, setPlate] = useState(initialPlate)
  const [validationError, setValidationError] = useState('')
  const [result, setResult] = useState(null)
  const exitApi = useApi(registerExit, { retries: 1 })

  // Cuando se abre con initialPlate, ejecutar salida automáticamente
  useEffect(() => {
    if (!isOpen) {
      setPlate('')
      setValidationError('')
      setResult(null)
      exitApi.reset()
      return
    }

    setPlate(initialPlate)

    // Si hay placa inicial, disparar la API automáticamente
    if (initialPlate && initialPlate.length >= 7) {
      exitApi.execute(initialPlate).then((payload) => {
        const enriched = { ...payload, placa: initialPlate }
        setResult(enriched)
        invalidateApiCache([
          '/api/dashboard/stats', '/api/parking-spaces', '/api/parking-spaces/stats',
          '/api/vehiculos', '/api/vehicles', '/api/parking-sessions',
          '/api/parking-sessions/active', '/api/payments',
        ])
        // Solo notificar al padre, NO cerrar el modal
        onSuccess?.(payload)
        window.dispatchEvent(new CustomEvent('dashboard-refresh'))
        window.dispatchEvent(new CustomEvent('smartpark:data-refresh'))
      }).catch(() => {
        // Mantener modal abierto con error visible
      })
    }
  }, [isOpen, initialPlate])

  if (!isOpen) return null

  const handlePlateChange = (e) => {
    const raw = e.target.value.toUpperCase()
    let out = ''; let l = 0; let d = 0
    for (const c of raw) {
      if (l < 3 && /[A-Z]/.test(c)) { out += c; l++ }
      else if (l === 3 && d < 4 && /[0-9]/.test(c)) { out += c; d++ }
      if (l === 3 && d === 4) break
    }
    setPlate(out)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const p = plate.trim().toUpperCase()
    if (!/^[A-Z]{3}[0-9]{4}$/.test(p)) {
      setValidationError('La placa debe tener 3 letras y 4 numeros (ej: ABC1234).')
      return
    }
    setValidationError('')
    try {
      const payload = await exitApi.execute(p)
      const enriched = { ...payload, placa: p }
      setResult(enriched)
      invalidateApiCache([
        '/api/dashboard/stats', '/api/parking-spaces', '/api/parking-spaces/stats',
        '/api/vehiculos', '/api/vehicles', '/api/parking-sessions',
        '/api/parking-sessions/active', '/api/payments',
      ])
      await onSuccess?.(payload)
      window.dispatchEvent(new CustomEvent('dashboard-refresh'))
      window.dispatchEvent(new CustomEvent('smartpark:data-refresh'))
    } catch { setResult(null) }
  }

  const handlePay = () => {
    if (!result) return
    openPDF(result)
    setTimeout(() => onClose?.(), 600)
  }

  const itbisRate = 0
  const rawAmount = Number(result?.amount_to_pay || 0)
  const subtotal  = rawAmount
  const itbis     = rawAmount - subtotal

  return (
    <>
      <style>{`
        @keyframes spSlideIn {
          from { opacity:0; transform:translateY(28px) scale(.96) }
          to   { opacity:1; transform:translateY(0) scale(1) }
        }
        .sp-exit-pay:hover { filter:brightness(1.12); }
        .sp-exit-cancel:hover { background:rgba(255,255,255,.07) !important; color:#fff !important; }
        .sp-exit-input:focus { outline:none; border-color:rgba(56,189,248,.55) !important; box-shadow:0 0 0 3px rgba(56,189,248,.12); }
      `}</style>

      <div style={overlay} onClick={onClose} role="presentation">
        <div style={modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">

          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg,#0f172a 0%,#0c2a4a 60%,#0c3a5e 100%)',
            padding: '20px 24px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderBottom: `1px solid ${C.border}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 42, height: 42,
                background: 'linear-gradient(135deg,#38bdf8,#0ea5e9)',
                borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, boxShadow: '0 6px 16px rgba(56,189,248,.3)',
              }}>🅿</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-.3px' }}>SmartPark</div>
                <div style={{ fontSize: 10, color: '#7dd3fc', textTransform: 'uppercase', letterSpacing: '.1em', marginTop: 1 }}>Cobro de Salida</div>
              </div>
            </div>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={onClose}
              style={{
                width: 34, height: 34, borderRadius: 8,
                background: 'rgba(255,255,255,.06)', border: `1px solid rgba(255,255,255,.1)`,
                color: C.dim, cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 18,
              }}
            >✕</button>
          </div>

          {/* Body */}
          <div style={{ padding: '22px 24px' }}>

            {/* Cargando automáticamente */}
            {exitApi.loading && !result && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: C.dim }}>
                <Spinner />
                <div style={{ marginTop: 14, fontSize: 14, fontWeight: 600 }}>Procesando salida de {initialPlate}...</div>
              </div>
            )}

            {/* Error */}
            {!exitApi.loading && !result && exitApi.error && (
              <div>
                <div style={{
                  background: 'rgba(110,16,16,.28)', border: '1px solid rgba(248,81,73,.4)',
                  color: '#ffb4b1', borderRadius: 10, padding: '12px 16px',
                  fontSize: 13, fontWeight: 600, marginBottom: 16,
                }}>
                  {exitApi.error}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" className="sp-exit-cancel" onClick={onClose}
                    style={{ flex: 1, padding: '12px 0', background: 'rgba(255,255,255,.04)', color: C.dim, border: `1px solid rgba(255,255,255,.08)`, borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Cerrar
                  </button>
                </div>
              </div>
            )}

            {/* Paso manual — solo si NO hay initialPlate */}
            {!exitApi.loading && !result && !exitApi.error && !initialPlate && (
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
                    Placa del vehículo
                  </label>
                  <input
                    className="sp-exit-input"
                    type="text"
                    value={plate}
                    onChange={handlePlateChange}
                    placeholder="ABC1234"
                    maxLength={7}
                    autoFocus
                    style={{
                      width: '100%', padding: '13px 16px',
                      background: C.deep, border: `1px solid rgba(56,189,248,.2)`,
                      borderRadius: 12, color: '#fff',
                      fontSize: 22, fontWeight: 800, letterSpacing: '.1em',
                      fontFamily: 'inherit', transition: 'border-color .2s, box-shadow .2s',
                    }}
                  />
                </div>
                {(validationError || exitApi.error) && (
                  <div style={{ background: 'rgba(110,16,16,.28)', border: '1px solid rgba(248,81,73,.4)', color: '#ffb4b1', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
                    {validationError || exitApi.error}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button type="button" className="sp-exit-cancel" onClick={onClose}
                    style={{ flex: 1, padding: '12px 0', background: 'rgba(255,255,255,.04)', color: C.dim, border: `1px solid rgba(255,255,255,.08)`, borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .2s' }}>
                    Cerrar
                  </button>
                  <button type="submit" className="sp-exit-pay" disabled={exitApi.loading}
                    style={{ flex: 2, padding: '12px 0', background: 'linear-gradient(135deg,#0ea5e9,#0284c7)', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 8px 20px rgba(14,165,233,.35)', transition: 'all .2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    🔍 Consultar salida
                  </button>
                </div>
              </form>
            )}

            {/* Paso 2: resultado del cobro */}
            {result && (
              <>
                <div style={{
                  background: 'rgba(9,131,200,.1)', border: '1px solid rgba(9,131,200,.25)',
                  borderRadius: 14, padding: '14px 16px',
                  display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18,
                }}>
                  <div style={{ width: 46, height: 46, borderRadius: 11, background: 'rgba(9,131,200,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>🚗</div>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '.06em', lineHeight: 1 }}>{result.placa}</div>
                    <div style={{ fontSize: 12, color: C.dim, marginTop: 4 }}>Salida registrada · {nowFormatted()}</div>
                  </div>
                  <div style={{ marginLeft: 'auto', background: 'rgba(63,185,80,.15)', border: '1px solid rgba(63,185,80,.3)', borderRadius: 8, padding: '6px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: '#3fb950', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 2 }}>Estado</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#3fb950' }}>✓ Pagado</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                  {[
                    { icon: '⏱', label: 'Tiempo estacionado', val: formatDuration(result.duration_minutes) },
                    { icon: '🧮', label: 'Subtotal', val: formatMoney(subtotal) },
                    { icon: '📋', label: 'ITBIS',    val: formatMoney(itbis) },
                  ].map(({ icon, label, val }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: 'rgba(255,255,255,.03)', borderRadius: 9 }}>
                      <span style={{ fontSize: 13, color: C.dim }}>{icon} {label}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{val}</span>
                    </div>
                  ))}
                </div>

                <div style={{ background: 'linear-gradient(135deg,#0ea5e9 0%,#0284c7 100%)', borderRadius: 16, padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, boxShadow: '0 8px 24px rgba(14,165,233,.35)' }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.75)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Total cobrado</div>
                    <div style={{ fontSize: 34, fontWeight: 900, color: '#fff', letterSpacing: '-.5px', lineHeight: 1 }}>{formatMoney(rawAmount)}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.6)', marginTop: 4 }}>Sin ITBIS adicional · PDF se genera al presionar "Imprimir Factura"</div>
                  </div>
                  <div style={{ width: 54, height: 54, background: 'rgba(255,255,255,.2)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🧾</div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" className="sp-exit-cancel" onClick={onClose}
                    style={{ flex: 1, padding: '12px 0', background: 'rgba(255,255,255,.04)', color: C.dim, border: `1px solid rgba(255,255,255,.08)`, borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .2s' }}>
                    Cerrar
                  </button>
                  <button type="button" className="sp-exit-pay" onClick={handlePay}
                    style={{ flex: 2, padding: '12px 0', background: 'linear-gradient(135deg,#0ea5e9,#0284c7)', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 8px 22px rgba(14,165,233,.4)', transition: 'filter .2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    🖨️ Imprimir Factura PDF
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function Spinner() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,.3)" strokeWidth="3"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  )
}
