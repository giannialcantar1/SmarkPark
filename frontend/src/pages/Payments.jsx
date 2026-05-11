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
    subtotalRaw: subtotalAmount,
    itbisRaw: itbisAmount,
  }
}

function buildPrintableInvoice(invoice) {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Factura ${invoice.numeroFactura} - SmartPark</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',Arial,sans-serif;background:#f1f5f9;color:#0f172a;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .page{max-width:820px;margin:32px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.12)}

    .header{background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 60%,#0c4a6e 100%);padding:36px 48px;display:flex;justify-content:space-between;align-items:center;gap:24px}
    .brand{display:flex;align-items:center;gap:16px}
    .brand-icon{width:56px;height:56px;background:linear-gradient(135deg,#38bdf8,#0ea5e9);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:28px;box-shadow:0 8px 20px rgba(56,189,248,0.35)}
    .brand-name{font-size:26px;font-weight:800;color:#fff;letter-spacing:-0.5px}
    .brand-sub{font-size:11px;color:#7dd3fc;text-transform:uppercase;letter-spacing:0.15em;margin-top:3px}
    .invoice-meta{text-align:right}
    .invoice-badge{display:inline-block;background:rgba(56,189,248,0.18);border:1px solid rgba(56,189,248,0.35);color:#7dd3fc;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;padding:5px 14px;border-radius:20px;margin-bottom:10px}
    .invoice-num{font-size:22px;font-weight:800;color:#fff;margin-bottom:4px}
    .invoice-date{font-size:12px;color:#94a3b8}

    .status-bar{background:linear-gradient(90deg,#0ea5e9,#38bdf8);padding:12px 48px;display:flex;align-items:center;gap:10px}
    .status-dot{width:8px;height:8px;background:#fff;border-radius:50%;opacity:0.9}
    .status-text{font-size:12px;font-weight:700;color:#fff;letter-spacing:0.06em;text-transform:uppercase}

    .content{padding:40px 48px}
    .section-label{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.18em;margin-bottom:14px;display:flex;align-items:center;gap:8px}
    .section-label::after{content:'';flex:1;height:1px;background:#e2e8f0}

    .client-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:32px}
    .info-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 18px}
    .info-card-label{font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:6px}
    .info-card-value{font-size:15px;font-weight:700;color:#0f172a}
    .info-card-sub{font-size:12px;color:#64748b;margin-top:3px}

    .table-wrap{margin-bottom:28px}
    table{width:100%;border-collapse:collapse;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0}
    thead{background:linear-gradient(135deg,#0f172a,#1e293b)}
    thead th{padding:14px 18px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.12em;text-align:left}
    thead th:last-child{text-align:right}
    tbody tr{border-bottom:1px solid #f1f5f9}
    tbody tr:last-child{border-bottom:none}
    tbody td{padding:16px 18px;font-size:13px;color:#0f172a;vertical-align:middle}
    tbody td:last-child{text-align:right;font-weight:700}
    .service-name{font-weight:600;color:#0f172a}
    .service-sub{font-size:11px;color:#64748b;margin-top:3px}

    .detail-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:28px}
    .detail-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;text-align:center}
    .detail-card-label{font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:6px}
    .detail-card-value{font-size:12px;font-weight:700;color:#0f172a}

    .totals{display:flex;justify-content:flex-end;margin-bottom:32px}
    .totals-box{width:320px}
    .total-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:13px}
    .total-row span:first-child{color:#64748b}
    .total-row span:last-child{font-weight:600;color:#0f172a}
    .total-final{display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding:18px 22px;background:linear-gradient(135deg,#0f172a,#1e3a5f);border-radius:14px}
    .total-final-label{font-size:12px;color:#7dd3fc;font-weight:600;text-transform:uppercase;letter-spacing:0.1em}
    .total-final-value{font-size:26px;font-weight:800;color:#fff}

    .footer{background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 48px;display:flex;justify-content:space-between;align-items:center;gap:16px}
    .footer-brand{font-size:13px;font-weight:700;color:#0f172a}
    .footer-sub{font-size:11px;color:#94a3b8;margin-top:2px}
    .footer-note{font-size:11px;color:#94a3b8;text-align:right}
    .thank-you{display:inline-block;background:linear-gradient(135deg,#0ea5e9,#38bdf8);-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:800;font-size:14px}

    @media print{
      body{background:#fff;margin:0}
      .page{margin:0;border-radius:0;box-shadow:none;max-width:100%}
    }
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
    <div class="invoice-meta">
      <div class="invoice-badge">Factura Oficial</div>
      <div class="invoice-num">${invoice.numeroFactura}</div>
      <div class="invoice-date">Emitida: ${invoice.fechaEmision}</div>
    </div>
  </div>
  <div class="status-bar">
    <div class="status-dot"></div>
    <div class="status-text">Servicio de estacionamiento · Pago procesado</div>
  </div>
  <div class="content">
    <div class="section-label">Información del cliente</div>
    <div class="client-grid">
      <div class="info-card">
        <div class="info-card-label">Propietario</div>
        <div class="info-card-value">${invoice.propietario}</div>
      </div>
      <div class="info-card">
        <div class="info-card-label">Vehículo</div>
        <div class="info-card-value">${invoice.placa}</div>
        <div class="info-card-sub">${invoice.modelo}</div>
      </div>
    </div>
    <div class="section-label">Detalle del servicio</div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Descripción</th>
            <th>Cantidad</th>
            <th>Precio unitario</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <div class="service-name">Estacionamiento — Espacio ${invoice.espacio}</div>
              <div class="service-sub">Entrada: ${invoice.entrada} · Salida: ${invoice.salida}</div>
            </td>
            <td>${invoice.cantidadHoras}</td>
            <td>${invoice.tarifa}/hr</td>
            <td>${invoice.subtotal}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="section-label">Resumen de tiempo</div>
    <div class="detail-grid">
      <div class="detail-card"><div class="detail-card-label">Entrada</div><div class="detail-card-value">${invoice.entrada}</div></div>
      <div class="detail-card"><div class="detail-card-label">Salida</div><div class="detail-card-value">${invoice.salida}</div></div>
      <div class="detail-card"><div class="detail-card-label">Duración</div><div class="detail-card-value">${invoice.duracion}</div></div>
      <div class="detail-card"><div class="detail-card-label">Espacio</div><div class="detail-card-value">${invoice.espacio}</div></div>
    </div>
    <div class="totals">
      <div class="totals-box">
        <div class="total-row"><span>Subtotal</span><span>${invoice.subtotal}</span></div>
        <div class="total-row"><span>ITBIS (18%)</span><span>${invoice.itbis}</span></div>
        <div class="total-final">
          <div><div class="total-final-label">Total pagado</div></div>
          <div class="total-final-value">${invoice.total}</div>
        </div>
      </div>
    </div>
  </div>
  <div class="footer">
    <div>
      <div class="footer-brand">SmartPark · Control Total</div>
      <div class="footer-sub">Gracias por usar nuestro servicio de estacionamiento</div>
    </div>
    <div class="footer-note">
      <span class="thank-you">¡Gracias por su visita!</span><br/>
      ${invoice.numeroFactura} · ${invoice.fechaEmision}
    </div>
  </div>
</div>
<script>window.onload = function(){ window.print() }</script>
</body>
</html>`
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
  statsBar: {
    display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
    gap: 12, marginBottom: 20,
  },
  statCard: (accent) => ({
    background: C.card, border: `1px solid ${C.border}`,
    borderLeft: `3px solid ${accent}`, borderRadius: 14, padding: '16px 20px',
    display: 'flex', alignItems: 'center', gap: 14,
  }),
  statIco: (accent) => ({
    width: 38, height: 38, borderRadius: 10, background: `${accent}18`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: accent, fontSize: 19, flexShrink: 0,
  }),
  statLabel: { fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: C.textSoft, textTransform: 'uppercase', marginBottom: 4 },
  statValue: { fontSize: 22, fontWeight: 800, lineHeight: 1 },
  feedbackError: {
    borderRadius: 12, padding: '12px 16px', marginBottom: 16,
    background: 'rgba(110,16,16,0.28)', border: '1px solid rgba(248,81,73,0.45)',
    color: '#ffb4b1', fontWeight: 600, fontSize: 13,
    display: 'flex', alignItems: 'center', gap: 8,
  },
  feedbackSuccess: {
    borderRadius: 12, padding: '12px 16px', marginBottom: 16,
    background: 'rgba(63,185,80,0.18)', border: '1px solid rgba(63,185,80,0.45)',
    color: '#7ee787', fontWeight: 600, fontSize: 13,
    display: 'flex', alignItems: 'center', gap: 8,
  },
  cardsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 14 },
  cobroCard: (selected) => ({
    background: C.card,
    border: `1px solid ${selected ? 'rgba(9,131,200,0.5)' : C.border}`,
    borderRadius: 14, padding: '18px 20px',
    display: 'flex', flexDirection: 'column', gap: 14,
    cursor: 'pointer', transition: 'border-color 0.2s, box-shadow 0.2s',
    boxShadow: selected ? '0 0 0 3px rgba(9,131,200,0.15)' : 'none',
  }),
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardSpaceBadge: {
    background: 'rgba(9,131,200,0.18)', color: C.accent,
    fontWeight: 800, fontSize: 13, borderRadius: 7, padding: '4px 10px', letterSpacing: '0.03em',
  },
  activeBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20,
    fontSize: 11, fontWeight: 700, background: 'rgba(63,185,80,0.12)', color: C.success,
    border: `1px solid rgba(63,185,80,0.3)`,
  },
  activeDot: { width: 6, height: 6, borderRadius: '50%', background: C.success, animation: 'pulse 1.5s infinite' },
  cardVehicle: { display: 'flex', alignItems: 'center', gap: 10, background: C.cardDeep, borderRadius: 10, padding: '10px 12px' },
  cardVehicleIco: {
    width: 34, height: 34, borderRadius: 8, background: 'rgba(9,131,200,0.12)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.accent, fontSize: 20, flexShrink: 0,
  },
  cardPlaca: { fontSize: 14, fontWeight: 800, color: '#fff', lineHeight: 1 },
  cardDetalle: { fontSize: 11, color: C.textSoft, marginTop: 3 },
  cardMeta: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  metaItem: { background: C.cardDeep, borderRadius: 8, padding: '8px 10px' },
  metaLabel: { fontSize: 10, color: C.textSoft, marginBottom: 3 },
  metaVal: { fontSize: 12, fontWeight: 700, color: '#fff' },
  cardCostRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: `1px solid ${C.border}` },
  costLabel: { fontSize: 10, color: C.textSoft, marginBottom: 2 },
  costVal: { fontSize: 18, fontWeight: 800, color: C.success },
  cardActions: { display: 'flex', gap: 8 },
  btnSecondary: {
    flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '9px 0', background: C.cardDeep, color: C.textSoft, border: `1px solid rgba(90,202,249,0.20)`,
    borderRadius: 9, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
  },
  btnPrimary: {
    flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '9px 0', background: 'var(--accent)', color: '#080f1e',
    boxShadow: '0 14px 34px rgba(56,189,248,0.18)', border: 'none',
    borderRadius: 9, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
  },
  empty: {
    gridColumn: '1/-1', background: C.card, border: `1px solid ${C.border}`,
    borderRadius: 14, padding: '56px 24px', textAlign: 'center', color: C.textSoft,
  },
  emptyIco: {
    width: 52, height: 52, borderRadius: 14, background: 'rgba(9,131,200,0.1)',
    border: `1px solid rgba(9,131,200,0.2)`, display: 'flex', alignItems: 'center',
    justifyContent: 'center', margin: '0 auto 14px', color: C.accent, fontSize: 26,
  },
  skeleton: {
    borderRadius: 12,
    background: 'linear-gradient(90deg,#041f3a 0%,#0a3460 50%,#041f3a 100%)',
    backgroundSize: '200% 100%', animation: 'shimmer 1.25s linear infinite',
  },
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(1,4,9,0.85)', display: 'grid', placeItems: 'center', padding: 24, zIndex: 100, backdropFilter: 'blur(4px)' },
  modal: { width: 'min(560px,100%)', background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 28, boxShadow: '0 24px 48px rgba(0,0,0,0.32)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 800, color: '#fff', margin: 0 },
  modalSub: { fontSize: 12, color: C.textSoft, marginTop: 4 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 8, background: C.cardDeep, border: `1px solid ${C.border}`,
    color: C.textSoft, display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
  },
  invoiceGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 },
  invoiceItem: { background: C.cardDeep, borderRadius: 10, padding: '10px 14px' },
  invoiceLabel: { fontSize: 10, color: C.textSoft, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 },
  invoiceVal: { fontSize: 13, fontWeight: 700, color: '#fff' },
  divider: { height: 1, background: C.border, margin: '16px 0' },
  totalBox: {
    background: C.cardDeep, border: `1px solid rgba(9,131,200,0.3)`, borderRadius: 12, padding: '16px 18px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
  },
  totalLabel: { fontSize: 12, color: C.textSoft },
  totalVal: { fontSize: 26, fontWeight: 800, color: C.success },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 10 },
  modalBtnCancel: {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px',
    background: C.cardDeep, color: C.textSoft, border: `1px solid rgba(90,202,249,0.20)`,
    borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
  },
  modalBtnConfirm: (disabled) => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 24px',
    background: disabled ? 'rgba(9,131,200,0.35)' : 'var(--accent)',
    color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13,
    cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: disabled ? 0.7 : 1,
  }),
  modalBtnPrint: {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px',
    background: 'rgba(63,185,80,0.12)', color: C.success,
    border: `1px solid rgba(63,185,80,0.3)`, borderRadius: 10,
    fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
  },

  // ── Receipt / Confirm modal styles ──────────────────────────────────────
  receiptModal: {
    width: 'min(520px,100%)',
    background: '#0d1b2e',
    border: '1px solid rgba(56,189,248,0.18)',
    borderRadius: 20,
    overflow: 'hidden',
    boxShadow: '0 32px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(56,189,248,0.08)',
  },
  receiptHeader: {
    background: 'linear-gradient(135deg, #0f172a 0%, #0c2a4a 60%, #0c3a5e 100%)',
    padding: '20px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid rgba(56,189,248,0.12)',
  },
  receiptBrand: { display: 'flex', alignItems: 'center', gap: 12 },
  receiptBrandIcon: {
    width: 40, height: 40,
    background: 'linear-gradient(135deg,#38bdf8,#0ea5e9)',
    borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 20,
    boxShadow: '0 6px 16px rgba(56,189,248,0.3)',
  },
  receiptBrandName: { fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' },
  receiptBrandSub: { fontSize: 10, color: '#7dd3fc', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 2 },
  receiptBadge: {
    background: 'rgba(56,189,248,0.15)',
    border: '1px solid rgba(56,189,248,0.3)',
    color: '#7dd3fc',
    fontSize: 10, fontWeight: 700,
    letterSpacing: '0.1em', textTransform: 'uppercase',
    padding: '4px 12px', borderRadius: 20,
  },
  receiptBody: { padding: '20px 24px' },
  receiptFacNum: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16,
  },
  receiptFacLabel: { fontSize: 11, color: 'rgba(148,163,184,0.8)', marginBottom: 3 },
  receiptFacVal: { fontSize: 14, fontWeight: 700, color: '#fff' },
  receiptVehicleBox: {
    background: 'rgba(9,131,200,0.1)',
    border: '1px solid rgba(9,131,200,0.25)',
    borderRadius: 12,
    padding: '14px 16px',
    display: 'flex', alignItems: 'center', gap: 14,
    marginBottom: 16,
  },
  receiptVehicleIcon: {
    width: 44, height: 44,
    background: 'rgba(9,131,200,0.2)',
    borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#38bdf8', fontSize: 24, flexShrink: 0,
  },
  receiptPlaca: { fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '0.05em', lineHeight: 1 },
  receiptVehicleDetail: { fontSize: 12, color: 'rgba(148,163,184,0.8)', marginTop: 4 },
  receiptDividerDashed: {
    borderTop: '1px dashed rgba(56,189,248,0.2)',
    margin: '16px 0',
    position: 'relative',
  },
  receiptRows: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 },
  receiptRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
  },
  receiptRowLabel: { fontSize: 12, color: 'rgba(148,163,184,0.8)', display: 'flex', alignItems: 'center', gap: 6 },
  receiptRowVal: { fontSize: 12, fontWeight: 700, color: '#e2e8f0' },
  receiptTaxRows: { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 },
  receiptTaxRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '5px 0',
  },
  receiptTaxLabel: { fontSize: 12, color: 'rgba(148,163,184,0.7)' },
  receiptTaxVal: { fontSize: 12, fontWeight: 600, color: '#94a3b8' },
  receiptTotalBox: {
    background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
    borderRadius: 14,
    padding: '18px 20px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 20,
    boxShadow: '0 8px 24px rgba(14,165,233,0.3)',
  },
  receiptTotalLabel: { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 },
  receiptTotalAmt: { fontSize: 32, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' },
  receiptTotalNote: { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  receiptActions: { display: 'flex', gap: 10 },
  receiptBtnCancel: {
    flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '12px 0',
    background: 'rgba(255,255,255,0.05)',
    color: 'rgba(148,163,184,0.9)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
    transition: 'background 0.2s',
  },
  receiptBtnPdf: (disabled) => ({
    flex: 2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '12px 0',
    background: disabled
      ? 'rgba(14,165,233,0.3)'
      : 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
    color: '#fff', border: 'none',
    borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
    boxShadow: disabled ? 'none' : '0 8px 20px rgba(14,165,233,0.35)',
    opacity: disabled ? 0.65 : 1,
    transition: 'all 0.2s',
  }),
}

const Icon = ({ name, size = 16 }) => (
  <span className="material-symbols-outlined" style={{ fontSize: size, verticalAlign: 'middle', lineHeight: 1, flexShrink: 0 }}>
    {name}
  </span>
)

export default function Cobros() {
  const [vehicles, setVehicles]     = useState([])
  const [spaces, setSpaces]         = useState([])
  const [hourlyRate, setHourlyRate] = useState(50)
  const [loading, setLoading]       = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError]           = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const [selectedVehicle, setSelectedVehicle]   = useState(null)
  const [vehicleToConfirm, setVehicleToConfirm] = useState(null)

  const load = async ({ showLoader = true } = {}) => {
    if (showLoader) setLoading(true)
    setError(null)
    try {
      const [vp, ep, sp] = await Promise.all([
        apiGet('/api/vehiculos',      { forceFresh: true }),
        apiGet('/api/parking-spaces', { forceFresh: true }),
        apiGet('/api/auth/settings',  { forceFresh: true }).catch(() => ({ data: {} })),
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

  useEffect(() => {
    // Always fetch fresh — never use stale cache
    load({ showLoader: true })

    // Auto-refresh every 5s so new vehicles appear immediately
    const intervalId = window.setInterval(() => load({ showLoader: false }), 5000)

    // Refresh when other modules dispatch events
    const onRefresh = () => load({ showLoader: false })
    window.addEventListener('dashboard-refresh', onRefresh)
    window.addEventListener('smartpark:data-refresh', onRefresh)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('dashboard-refresh', onRefresh)
      window.removeEventListener('smartpark:data-refresh', onRefresh)
    }
  }, [])

  const spacesMap = useMemo(
    () => new Map(spaces.map((sp) => [String(sp.id), sp.codigo || String(sp.id).slice(0, 8)])),
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

  // Build a real-time invoice preview for the confirm modal
  const confirmInvoice = useMemo(() => {
    if (!vehicleToConfirm) return null
    return buildInvoiceData({ vehicle: vehicleToConfirm, exitTime: new Date(), hourlyRate })
  }, [vehicleToConfirm, hourlyRate])

  const handleCheckout = async () => {
    if (!vehicleToConfirm) return
    setProcessing(true); setError(null)
    try {
      const response = await apiPost('/api/vehiculos/salida', { placa: vehicleToConfirm.placa })
      const data = response?.data || {}
      const exitTime = data.hora_salida || data.exit_time || new Date().toISOString()

      const finalInvoice = buildInvoiceData({
        vehicle: vehicleToConfirm,
        exitTime: new Date(exitTime),
        hourlyRate,
      })
      const popup = window.open('', '_blank', 'width=980,height=900')
      if (popup) {
        popup.document.open()
        popup.document.write(buildPrintableInvoice(finalInvoice))
        popup.document.close()
      }

      // Cerrar modales INMEDIATAMENTE después del PDF (antes de cualquier otra cosa que pueda fallar)
      const vehiclePlate = vehicleToConfirm.placa
      setVehicleToConfirm(null)
      if (selectedVehicle?.placa === vehiclePlate) setSelectedVehicle(null)
      setSuccessMessage('Factura generada exitosamente.')
      window.dispatchEvent(new CustomEvent('dashboard-refresh'))
      setTimeout(() => setSuccessMessage(null), 4000)

      // Actualizar estado local (si falla, los modales ya están cerrados)
      setVehicles((cur) =>
        cur.map((v) =>
          v.placa === vehiclePlate
            ? { ...v, status: 'fuera', estado: 'fuera', hora_salida: exitTime, exit_time: exitTime, monto_total: data.monto_total ?? v.monto_total }
            : v,
        ),
      )
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
    setSelectedVehicle(null)
    setSuccessMessage('Factura generada exitosamente.')
    setTimeout(() => setSuccessMessage(null), 4000)
  }

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
        @keyframes receiptSlideIn {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .receipt-modal-enter { animation: receiptSlideIn 0.28s cubic-bezier(0.16,1,0.3,1) both; }
        .receipt-btn-pdf:hover:not(:disabled) {
          filter: brightness(1.1);
          box-shadow: 0 12px 28px rgba(14,165,233,0.45) !important;
        }
        .receipt-btn-cancel:hover {
          background: rgba(255,255,255,0.08) !important;
          color: #fff !important;
        }
      `}</style>

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

      {!loading && (
        <div style={s.statsBar}>
          {[
            { label: 'Vehículos activos',  value: activeVehicles.length, icon: 'directions_car', accent: C.accent  },
            { label: 'Tarifa por hora',    value: formatCurrency(hourlyRate), icon: 'payments', accent: C.success },
            { label: 'Pendientes de pago', value: activeVehicles.length, icon: 'receipt_long', accent: C.danger  },
          ].map(({ label, value, icon, accent }) => (
            <div key={label} style={s.statCard(accent)}>
              <div style={s.statIco(accent)}><Icon name={icon} size={19} /></div>
              <div>
                <div style={s.statLabel}>{label}</div>
                <div style={{ ...s.statValue, color: accent }}>{value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <div style={s.feedbackError}><Icon name="error" size={15} />{error}</div>}
      {successMessage && <div style={s.feedbackSuccess}><Icon name="check_circle" size={15} />{successMessage}</div>}

      <div style={s.cardsGrid}>
        {loading && Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ ...s.skeleton, height: 220 }} />
        ))}

        {!loading && activeVehicles.length === 0 && (
          <div style={s.empty}>
            <div style={s.emptyIco}><Icon name="payments" size={26} /></div>
            <div style={{ fontWeight: 600, color: '#fff', marginBottom: 6 }}>No hay vehículos pendientes de cobro</div>
            <div style={{ fontSize: 12 }}>Los vehículos activos aparecerán aquí para gestionar su salida.</div>
          </div>
        )}

        {!loading && activeVehicles.map((vehicle) => {
          const isSelected = selectedVehicle?.placa === vehicle.placa
          const since = formatSince(vehicle.hora_entrada || vehicle.entry_time)
          const liveCost = getLiveCost(vehicle)

          return (
            <article key={vehicle.id || vehicle.placa} style={s.cobroCard(isSelected)} onClick={() => setSelectedVehicle(vehicle)}>
              <div style={s.cardTop}>
                <span style={s.cardSpaceBadge}>{vehicle.espacioLabel}</span>
                <span style={s.activeBadge}><span style={s.activeDot} />Activo</span>
              </div>
              <div style={s.cardVehicle}>
                <div style={s.cardVehicleIco}><Icon name="directions_car" size={20} /></div>
                <div>
                  <div style={s.cardPlaca}>{vehicle.placa || 'Sin placa'}</div>
                  <div style={s.cardDetalle}>{vehicle.modelo || vehicle.model || 'Vehículo'} - {vehicle.propietario || vehicle.owner || 'Sin propietario'}</div>
                </div>
              </div>
              <div style={s.cardMeta}>
                <div style={s.metaItem}><div style={s.metaLabel}>Tiempo</div><div style={s.metaVal}>{since}</div></div>
                <div style={s.metaItem}><div style={s.metaLabel}>Entrada</div><div style={{ ...s.metaVal, fontSize: 11 }}>{formatDateTime(vehicle.hora_entrada || vehicle.entry_time)}</div></div>
              </div>
              <div style={s.cardCostRow}>
                <div><div style={s.costLabel}>Costo estimado (c/ITBIS)</div><div style={s.costVal}>{liveCost}</div></div>
              </div>
              <div style={s.cardActions}>
                <button type="button" style={s.btnSecondary} onClick={(e) => { e.stopPropagation(); setSelectedVehicle(vehicle) }}>
                  <Icon name="receipt_long" size={14} />Factura
                </button>
                <button type="button" style={s.btnPrimary} onClick={(e) => { e.stopPropagation(); setVehicleToConfirm(vehicle) }}>
                  <Icon name="logout" size={14} />Registrar Salida
                </button>
              </div>
            </article>
          )
        })}
      </div>

      {/* ── Invoice preview modal (unchanged) ── */}
      {selectedVehicle && invoicePreview && (
        <div style={s.backdrop} onClick={() => setSelectedVehicle(null)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div>
                <h2 style={s.modalTitle}>Factura — {invoicePreview.placa}</h2>
                <p style={s.modalSub}>{invoicePreview.numeroFactura} · {invoicePreview.fechaEmision}</p>
              </div>
              <button type="button" style={s.closeBtn} onClick={() => setSelectedVehicle(null)}><Icon name="close" size={18} /></button>
            </div>
            <div style={s.invoiceGrid}>
              {[['Propietario', invoicePreview.propietario],['Placa', invoicePreview.placa],['Modelo', invoicePreview.modelo],['Espacio', invoicePreview.espacio],['Entrada', invoicePreview.entrada],['Salida', invoicePreview.salida],['Duración', invoicePreview.duracion],['Tarifa/hora', invoicePreview.tarifa]].map(([label, val]) => (
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
              <div style={s.totalLabel}>Total a pagar</div>
              <div style={s.totalVal}>{invoicePreview.total}</div>
            </div>
            <div style={s.modalActions}>
              <button type="button" style={s.modalBtnPrint} onClick={handlePrint}>
                <Icon name="picture_as_pdf" size={15} />Generar PDF
              </button>
              <button type="button" style={s.modalBtnCancel} onClick={() => setSelectedVehicle(null)}>Cerrar</button>
              <button type="button" style={s.modalBtnConfirm(false)} onClick={() => { setSelectedVehicle(null); setVehicleToConfirm(selectedVehicle) }}>
                <Icon name="logout" size={15} />Registrar Salida
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── NUEVO: Receipt-style Confirm modal ── */}
      {vehicleToConfirm && confirmInvoice && (
        <div style={s.backdrop} onClick={() => !processing && setVehicleToConfirm(null)}>
          <div
            className="receipt-modal-enter"
            style={s.receiptModal}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={s.receiptHeader}>
              <div style={s.receiptBrand}>
                <div style={s.receiptBrandIcon}>🅿</div>
                <div>
                  <div style={s.receiptBrandName}>SmartPark</div>
                  <div style={s.receiptBrandSub}>Control Total</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={s.receiptBadge}>Cobro de Salida</div>
                <button
                  type="button"
                  style={{ ...s.closeBtn, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                  onClick={() => !processing && setVehicleToConfirm(null)}
                >
                  <Icon name="close" size={18} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={s.receiptBody}>

              {/* Invoice number + date */}
              <div style={s.receiptFacNum}>
                <div>
                  <div style={s.receiptFacLabel}>N° Factura</div>
                  <div style={s.receiptFacVal}>{confirmInvoice.numeroFactura}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={s.receiptFacLabel}>Fecha y hora</div>
                  <div style={s.receiptFacVal}>{confirmInvoice.fechaEmision}</div>
                </div>
              </div>

              {/* Vehicle pill */}
              <div style={s.receiptVehicleBox}>
                <div style={s.receiptVehicleIcon}>
                  <Icon name="directions_car" size={24} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={s.receiptPlaca}>{vehicleToConfirm.placa}</div>
                  <div style={s.receiptVehicleDetail}>
                    {vehicleToConfirm.modelo || 'Vehículo'} · {vehicleToConfirm.propietario || 'Sin propietario'}
                  </div>
                </div>
                <div style={{
                  background: 'rgba(56,189,248,0.15)',
                  border: '1px solid rgba(56,189,248,0.3)',
                  borderRadius: 8, padding: '6px 12px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 10, color: '#7dd3fc', fontWeight: 700, marginBottom: 2 }}>ESPACIO</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#38bdf8' }}>{vehicleToConfirm.espacioLabel}</div>
                </div>
              </div>

              {/* Service details */}
              <div style={s.receiptRows}>
                {[
                  { icon: 'login',    label: 'Entrada',    val: confirmInvoice.entrada },
                  { icon: 'logout',   label: 'Salida',     val: confirmInvoice.salida },
                  { icon: 'schedule', label: 'Duración',   val: confirmInvoice.duracion },
                  { icon: 'timer',    label: 'Horas facturadas', val: confirmInvoice.cantidadHoras },
                  { icon: 'payments', label: 'Tarifa/hora', val: confirmInvoice.tarifa },
                ].map(({ icon, label, val }) => (
                  <div key={label} style={s.receiptRow}>
                    <div style={s.receiptRowLabel}>
                      <Icon name={icon} size={14} />
                      {label}
                    </div>
                    <div style={s.receiptRowVal}>{val}</div>
                  </div>
                ))}
              </div>

              {/* Dashed separator — feels like a thermal receipt tear */}
              <div style={s.receiptDividerDashed} />

              {/* Tax breakdown */}
              <div style={s.receiptTaxRows}>
                <div style={s.receiptTaxRow}>
                  <span style={s.receiptTaxLabel}>Subtotal</span>
                  <span style={s.receiptTaxVal}>{confirmInvoice.subtotal}</span>
                </div>
                <div style={s.receiptTaxRow}>
                  <span style={s.receiptTaxLabel}>ITBIS (18%)</span>
                  <span style={s.receiptTaxVal}>{confirmInvoice.itbis}</span>
                </div>
              </div>

              {/* Big total */}
              <div style={s.receiptTotalBox}>
                <div>
                  <div style={s.receiptTotalLabel}>Total a cobrar</div>
                  <div style={s.receiptTotalAmt}>{confirmInvoice.total}</div>
                  <div style={s.receiptTotalNote}>Incluye ITBIS · PDF se genera al confirmar</div>
                </div>
                <div style={{
                  width: 52, height: 52,
                  background: 'rgba(255,255,255,0.2)',
                  borderRadius: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 26,
                }}>
                  🧾
                </div>
              </div>

              {/* Actions */}
              <div style={s.receiptActions}>
                <button
                  type="button"
                  className="receipt-btn-cancel"
                  style={s.receiptBtnCancel}
                  disabled={processing}
                  onClick={() => setVehicleToConfirm(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="receipt-btn-pdf"
                  style={s.receiptBtnPdf(processing)}
                  disabled={processing}
                  onClick={handleCheckout}
                >
                  <Icon name={processing ? 'hourglass_top' : 'picture_as_pdf'} size={18} />
                  {processing ? 'Procesando...' : 'Confirmar y generar PDF'}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}