import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import useApi from '../hooks/useApi'
import { apiDownload, apiGet, buildPaginatedPath, getPaginationMeta } from '../lib/api'

const PAGE_SIZE = 50

const C = {
  card: 'var(--surface)',
  cardDeep: 'var(--surface2)',
  accent: 'var(--accent)',
  accent2: 'var(--accent2)',
  text: 'var(--text)',
  textSoft: 'var(--text-dim)',
  border: 'var(--border)',
  success: '#3fb950',
  danger: '#f87171',
  warning: '#f59e0b',
}

const styles = {
  page: {
    width: '100%',
    maxWidth: 1480,
    margin: '0 auto',
    fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
    color: C.text,
  },
  hero: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.45fr) minmax(300px, 0.9fr)',
    gap: 18,
    marginBottom: 20,
  },
  heroCard: {
    borderRadius: 28,
    padding: '28px 30px',
    background: 'linear-gradient(145deg, rgba(9,39,70,0.96), rgba(15,23,42,0.98))',
    border: '1px solid rgba(90,202,249,0.18)',
    boxShadow: '0 26px 50px rgba(2,8,23,0.24)',
  },
  eyebrow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    padding: '8px 14px',
    background: 'rgba(248,113,113,0.12)',
    border: '1px solid rgba(248,113,113,0.22)',
    color: '#fecaca',
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  title: {
    margin: '18px 0 10px',
    fontFamily: "'Syne', sans-serif",
    fontSize: 'var(--font-size-h1)',
    lineHeight: 1.2,
    fontWeight: 600,
    letterSpacing: '-0.05em',
    color: '#fff',
  },
  subtitle: {
    margin: 0,
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 1.55,
    maxWidth: 720,
  },
  heroMeta: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 12,
    marginTop: 22,
  },
  heroMetaCard: {
    borderRadius: 18,
    padding: '14px 16px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(148,163,184,0.14)',
  },
  heroMetaLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 8,
  },
  heroMetaValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 600,
    lineHeight: 1.35,
  },
  summaryCard: {
    borderRadius: 28,
    padding: 24,
    background: 'rgba(15,23,42,0.84)',
    border: '1px solid rgba(148,163,184,0.14)',
    display: 'grid',
    gap: 14,
    alignContent: 'start',
  },
  summaryLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  summaryValue: {
    color: '#fff',
    fontFamily: "'Syne', sans-serif",
    fontSize: 30,
    fontWeight: 600,
    lineHeight: 1.1,
    letterSpacing: '-0.04em',
  },
  summaryText: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 1.55,
    margin: 0,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 14,
    marginBottom: 20,
  },
  statCard: (accent, tone = 'solid') => ({
    borderRadius: 20,
    padding: '18px 20px',
    border: `1px solid ${tone === 'solid' ? 'rgba(148,163,184,0.14)' : accent}`,
    background: tone === 'solid' ? C.card : 'linear-gradient(145deg, rgba(15,23,42,0.92), rgba(22,29,49,0.92))',
    boxShadow: '0 16px 32px rgba(2,8,23,0.18)',
    minHeight: 132,
    display: 'grid',
    gap: 12,
  }),
  statTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  statIcon: (accent) => ({
    width: 42,
    height: 42,
    borderRadius: 12,
    display: 'grid',
    placeItems: 'center',
    background: `${accent}18`,
    border: `1px solid ${accent}33`,
    color: accent,
  }),
  statLabel: {
    color: C.textSoft,
    fontSize: 12,
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  statValue: {
    color: '#fff',
    fontFamily: "'Syne', sans-serif",
    fontSize: 30,
    fontWeight: 600,
    lineHeight: 1.1,
    letterSpacing: '-0.04em',
  },
  statHint: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 1.55,
  },
  feedbackError: {
    borderRadius: 14,
    padding: '12px 16px',
    marginBottom: 16,
    background: 'rgba(127,29,29,0.28)',
    border: '1px solid rgba(248,113,113,0.28)',
    color: '#fecaca',
    fontWeight: 500,
  },
  controlsCard: {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
    display: 'grid',
    gap: 16,
  },
  controlsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  controlsTitle: {
    margin: 0,
    color: '#fff',
    fontSize: 'var(--font-size-h2)',
    fontWeight: 600,
  },
  controlsSub: {
    margin: '4px 0 0',
    color: C.textSoft,
    fontSize: 14,
    lineHeight: 1.55,
  },
  controlGroup: {
    display: 'grid',
    gridTemplateColumns: 'minmax(260px, 1fr) repeat(2, minmax(140px, 180px)) auto',
    gap: 12,
    width: '100%',
  },
  searchWrap: { position: 'relative' },
  searchIcon: {
    position: 'absolute',
    left: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    color: C.textSoft,
    fontSize: 18,
    pointerEvents: 'none',
  },
  input: {
    width: '100%',
    borderRadius: 14,
    border: `1px solid ${C.border}`,
    background: C.cardDeep,
    color: '#fff',
    padding: '12px 14px',
    fontSize: 14,
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  searchInput: {
    width: '100%',
    borderRadius: 14,
    border: `1px solid ${C.border}`,
    background: C.cardDeep,
    color: '#fff',
    padding: '12px 14px 12px 40px',
    fontSize: 14,
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  button: (variant = 'primary', disabled = false) => ({
    borderRadius: 14,
    border: variant === 'ghost' ? `1px solid ${C.border}` : 'none',
    background: disabled
      ? 'rgba(56,189,248,0.22)'
      : variant === 'ghost'
        ? C.cardDeep
        : variant === 'danger'
          ? 'linear-gradient(135deg, #b91c1c, #ef4444)'
          : 'linear-gradient(135deg, #0284c7, #38bdf8)',
    color: variant === 'ghost' ? '#cbd5e1' : variant === 'danger' ? '#fff' : '#031220',
    padding: '12px 16px',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    opacity: disabled ? 0.75 : 1,
    boxShadow: disabled || variant === 'ghost' ? 'none' : '0 14px 28px rgba(56,189,248,0.18)',
  }),
  tableCard: {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 24,
    overflow: 'hidden',
  },
  tableHead: {
    padding: '20px 22px 14px',
    borderBottom: `1px solid ${C.border}`,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
    flexWrap: 'wrap',
  },
  tableTitle: {
    margin: 0,
    color: '#fff',
    fontSize: 'var(--font-size-h2)',
    fontWeight: 600,
  },
  tableSub: {
    margin: '6px 0 0',
    color: C.textSoft,
    fontSize: 14,
    lineHeight: 1.55,
  },
  tableCount: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    padding: '8px 14px',
    background: 'rgba(56,189,248,0.08)',
    border: '1px solid rgba(56,189,248,0.14)',
    color: '#bae6fd',
    fontSize: 12,
    fontWeight: 500,
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: 1040,
  },
  th: {
    textAlign: 'left',
    padding: '13px 22px',
    color: C.textSoft,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    borderBottom: `1px solid ${C.border}`,
    background: 'rgba(56,189,248,0.04)',
  },
  td: {
    padding: '16px 22px',
    color: '#fff',
    fontSize: 14,
    lineHeight: 1.55,
    borderTop: '1px solid rgba(148,163,184,0.08)',
    verticalAlign: 'top',
  },
  userCell: {
    display: 'grid',
    gap: 4,
  },
  userTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
  },
  userMeta: {
    color: C.textSoft,
    fontSize: 12,
  },
  debtValue: {
    color: '#fff',
    fontWeight: 600,
    fontSize: 16,
  },
  overdueBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    padding: '7px 12px',
    background: 'rgba(127,29,29,0.28)',
    border: '1px solid rgba(248,113,113,0.22)',
    color: '#fecaca',
    fontSize: 12,
    fontWeight: 600,
  },
  paymentCell: {
    display: 'grid',
    gap: 4,
  },
  paymentTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
  },
  paymentMeta: {
    color: C.textSoft,
    fontSize: 12,
    lineHeight: 1.35,
  },
  actionRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionButton: {
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    background: C.cardDeep,
    color: '#cbd5e1',
    padding: '8px 12px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  emptyState: {
    padding: '58px 24px',
    textAlign: 'center',
    color: C.textSoft,
  },
  emptyIcon: {
    width: 58,
    height: 58,
    margin: '0 auto 16px',
    borderRadius: 16,
    display: 'grid',
    placeItems: 'center',
    color: C.accent2,
    background: 'rgba(56,189,248,0.1)',
    border: '1px solid rgba(56,189,248,0.18)',
  },
  emptyTitle: {
    margin: '0 0 8px',
    color: '#fff',
    fontSize: 'var(--font-size-h3)',
    fontWeight: 600,
  },
  emptyText: {
    margin: 0,
    color: C.textSoft,
    fontSize: 14,
    lineHeight: 1.55,
  },
  footerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    padding: '16px 22px 22px',
    borderTop: `1px solid ${C.border}`,
  },
  footerText: {
    color: C.textSoft,
    fontSize: 12,
    lineHeight: 1.35,
  },
  pager: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  note: {
    marginTop: 14,
    borderRadius: 18,
    padding: '14px 16px',
    background: 'rgba(15,23,42,0.78)',
    border: '1px solid rgba(148,163,184,0.14)',
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 1.55,
  },
}

const Icon = ({ name, size = 18 }) => (
  <span className="material-symbols-outlined" style={{ fontSize: size, lineHeight: 1 }}>
    {name}
  </span>
)

const formatCurrency = (value) =>
  new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))

const formatCompactCurrency = (value) =>
  new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(value || 0))

const formatDate = (value) => {
  if (!value) return '--'
  const parsed = new Date(String(value).replace('Z', '+00:00'))
  if (Number.isNaN(parsed.getTime())) return '--'
  return new Intl.DateTimeFormat('es-DO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(parsed)
}

const downloadBlob = ({ filename, blob }) => {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  link.style.display = 'none'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

const normalizeNumberInput = (value) => {
  if (value === '' || value === null || value === undefined) return ''
  const numeric = String(value).replace(/[^\d]/g, '')
  return numeric
}

function buildFilterPath(basePath, { page, query = '', minDays = '', maxDays = '' } = {}) {
  const searchParams = {}
  if (String(query || '').trim()) searchParams.q = String(query).trim()
  if (minDays !== '' && minDays !== null && minDays !== undefined) searchParams.min_days = String(minDays)
  if (maxDays !== '' && maxDays !== null && maxDays !== undefined) searchParams.max_days = String(maxDays)

  if (page) {
    return buildPaginatedPath(basePath, {
      page,
      pageSize: PAGE_SIZE,
      searchParams,
    })
  }

  const params = new URLSearchParams()
  Object.entries(searchParams).forEach(([key, value]) => params.set(key, value))
  const serialized = params.toString()
  return serialized ? `${basePath}?${serialized}` : basePath
}

async function fetchMorosidadRows({ page = 1, query = '', minDays = '', maxDays = '' } = {}) {
  return apiGet(
    buildFilterPath('/api/morosidad/usuarios', { page, query, minDays, maxDays }),
    { forceFresh: true },
  )
}

async function fetchMorosidadStats({ query = '', minDays = '', maxDays = '' } = {}) {
  return apiGet(
    buildFilterPath('/api/morosidad/stats', { query, minDays, maxDays }),
    { forceFresh: true },
  )
}

export default function Morosidad() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [minDays, setMinDays] = useState('')
  const [maxDays, setMaxDays] = useState('')
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)
  const [actionError, setActionError] = useState('')
  const deferredQuery = useDeferredValue(query)

  const rowsApi = useApi(fetchMorosidadRows, {
    initialData: { success: true, data: [], meta: { page: 1, page_size: PAGE_SIZE, total: 0, page_count: 1, has_more: false } },
  })
  const statsApi = useApi(fetchMorosidadStats, {
    initialData: { success: true, data: { total_morosos: 0, monto_adeudado: 0, dias_vencidos: 0, planes_pendientes: 0 } },
  })

  useEffect(() => {
    setPage(1)
  }, [deferredQuery, minDays, maxDays])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      rowsApi.execute({
        page,
        query: deferredQuery,
        minDays,
        maxDays,
      }).catch(() => null)
      statsApi.execute({
        query: deferredQuery,
        minDays,
        maxDays,
      }).catch(() => null)
    }, 140)

    return () => window.clearTimeout(timerId)
  }, [page, deferredQuery, minDays, maxDays, rowsApi.execute, statsApi.execute])

  const rows = Array.isArray(rowsApi.data?.data) ? rowsApi.data.data : []
  const pagination = getPaginationMeta(rowsApi.data, PAGE_SIZE)
  const stats = statsApi.data?.data || {}
  const error = actionError || rowsApi.error || statsApi.error
  const hasFilters = Boolean(String(query).trim() || minDays !== '' || maxDays !== '')

  const statCards = useMemo(
    () => [
      {
        label: 'Usuarios Morosos',
        value: Number(stats.total_morosos || 0),
        hint: 'Usuarios con al menos un plan mensual vencido dentro del garage.',
        accent: '#f87171',
        icon: 'person_alert',
      },
      {
        label: 'Monto Adeudado',
        value: formatCompactCurrency(stats.monto_adeudado || 0),
        hint: 'Suma consolidada de las deudas vencidas del filtro activo.',
        accent: '#38bdf8',
        icon: 'payments',
      },
      {
        label: 'Días Vencidos',
        value: Number(stats.dias_vencidos || 0),
        hint: 'Mayor atraso detectado entre los usuarios morosos visibles.',
        accent: '#f59e0b',
        icon: 'schedule',
      },
      {
        label: 'Planes Pendientes',
        value: Number(stats.planes_pendientes || 0),
        hint: 'Total de planes pendientes o vencidos asociados a los usuarios filtrados.',
        accent: '#a78bfa',
        icon: 'inventory_2',
      },
    ],
    [stats],
  )

  const summaryText = useMemo(() => {
    if (rowsApi.loading && !rows.length) return 'Consultando el estado de los cobros mensuales del garage.'
    if (!rows.length) return 'No hay morosidad activa con el filtro actual. La cartera luce al día.'
    return `Hay ${pagination.total} usuario${pagination.total === 1 ? '' : 's'} con deuda activa y ${formatCurrency(stats.monto_adeudado || 0)} por recuperar.`
  }, [rowsApi.loading, rows.length, pagination.total, stats.monto_adeudado])

  const handleExport = async () => {
    setExporting(true)
    setActionError('')
    try {
      const payload = await apiGet(
        buildFilterPath('/api/morosidad/usuarios', {
          query: deferredQuery,
          minDays,
          maxDays,
        }),
        { forceFresh: true },
      )
      const exportRows = Array.isArray(payload?.data) ? payload.data : []

      const rowsForExcel = exportRows.map((row) => ({
        Usuario: row.usuario || '--',
        Correo: row.usuario_email || '--',
        Garaje: row.garaje || row.garage_id || '--',
        'Deuda total (DOP)': Number(row.deuda_total || 0),
        'Dias vencidos': row.dias_vencidos || 0,
        'Ultimo pago fecha': row.ultimo_pago_fecha || '',
        'Ultimo pago monto (DOP)': Number(row.ultimo_pago_monto || 0),
        'Referencia ultimo pago': row.ultimo_pago_referencia || '--',
        'Planes pendientes': row.planes_pendientes || 0,
      }))

      const { blob, filename } = await apiDownload('/api/reports/export-morosidad-xlsx', {
        title: 'Reporte de Morosidad',
        generated_at: new Date().toISOString(),
        rows: rowsForExcel,
      })

      downloadBlob({
        filename: filename || `smartpark-morosidad-${new Date().toISOString().slice(0, 10)}.xlsx`,
        blob,
      })
    } catch (exportError) {
      setActionError(exportError.message || 'No se pudo exportar el Excel de morosidad.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div style={styles.page}>
      <section style={styles.hero}>
        <article style={styles.heroCard}>
          <div style={styles.eyebrow}>
            <Icon name="warning" size={16} />
            Morosidad Activa
          </div>
          <h1 style={styles.title}>Cobros vencidos con foco operativo.</h1>
          <p style={styles.subtitle}>
            Monitorea usuarios con deuda vigente, revisa el último pago registrado y prioriza los casos con más días de atraso sin salir del panel administrativo.
          </p>

          <div style={styles.heroMeta}>
            <div style={styles.heroMetaCard}>
              <div style={styles.heroMetaLabel}>Filtro actual</div>
              <div style={styles.heroMetaValue}>{hasFilters ? 'Personalizado' : 'Todo el garage'}</div>
            </div>
            <div style={styles.heroMetaCard}>
              <div style={styles.heroMetaLabel}>Página</div>
              <div style={styles.heroMetaValue}>{pagination.page} / {pagination.pageCount}</div>
            </div>
            <div style={styles.heroMetaCard}>
              <div style={styles.heroMetaLabel}>Registros visibles</div>
              <div style={styles.heroMetaValue}>{rows.length}</div>
            </div>
          </div>
        </article>

        <aside style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Resumen rápido</div>
          <div style={styles.summaryValue}>{formatCurrency(stats.monto_adeudado || 0)}</div>
          <p style={styles.summaryText}>{summaryText}</p>
          <button
            type="button"
            style={styles.button('primary', exporting || rowsApi.loading)}
            disabled={exporting || rowsApi.loading}
            onClick={handleExport}
          >
            {exporting ? 'Generando Excel...' : 'Exportar Excel'}
          </button>
        </aside>
      </section>

      {error ? <div style={styles.feedbackError}>{error}</div> : null}

      <section style={styles.statsGrid}>
        {statCards.map((card, index) => (
          <article key={card.label} style={styles.statCard(card.accent, index === 0 ? 'highlight' : 'solid')}>
            <div style={styles.statTop}>
              <div style={styles.statLabel}>{card.label}</div>
              <div style={styles.statIcon(card.accent)}>
                <Icon name={card.icon} size={20} />
              </div>
            </div>
            <div style={styles.statValue}>{card.value}</div>
            <div style={styles.statHint}>{card.hint}</div>
          </article>
        ))}
      </section>

      <section style={styles.controlsCard}>
        <div style={styles.controlsRow}>
          <div>
            <h2 style={styles.controlsTitle}>Buscar y filtrar</h2>
            <p style={styles.controlsSub}>La tabla se actualiza en tiempo real según nombre, correo, garaje y rango de días vencidos.</p>
          </div>
        </div>

        <div style={styles.controlGroup}>
          <label style={styles.searchWrap}>
            <span style={styles.searchIcon}>
              <Icon name="search" size={18} />
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setActionError('')
                setQuery(event.target.value)
              }}
              placeholder="Buscar por usuario, correo o garaje"
              style={styles.searchInput}
            />
          </label>

          <input
            type="text"
            inputMode="numeric"
            value={minDays}
            onChange={(event) => {
              setActionError('')
              setMinDays(normalizeNumberInput(event.target.value))
            }}
            placeholder="Desde días"
            style={styles.input}
          />

          <input
            type="text"
            inputMode="numeric"
            value={maxDays}
            onChange={(event) => {
              setActionError('')
              setMaxDays(normalizeNumberInput(event.target.value))
            }}
            placeholder="Hasta días"
            style={styles.input}
          />

          <button
            type="button"
            style={styles.button('ghost', !hasFilters)}
            disabled={!hasFilters}
            onClick={() => {
              setActionError('')
              setQuery('')
              setMinDays('')
              setMaxDays('')
            }}
          >
            Limpiar
          </button>
        </div>
      </section>

      <section style={styles.tableCard}>
        <div style={styles.tableHead}>
          <div>
            <h2 style={styles.tableTitle}>Usuarios con deuda vigente</h2>
            <p style={styles.tableSub}>Se muestran únicamente registros vencidos del garage actual, con paginación de hasta 50 filas por página.</p>
          </div>
          <div style={styles.tableCount}>
            <Icon name="table_rows" size={16} />
            {pagination.total} registro{pagination.total === 1 ? '' : 's'}
          </div>
        </div>

        {rowsApi.loading && !rows.length ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>
              <Icon name="hourglass_top" size={26} />
            </div>
            <h3 style={styles.emptyTitle}>Cargando morosidad...</h3>
            <p style={styles.emptyText}>Estamos consolidando deudas, días vencidos y últimos pagos del garage.</p>
          </div>
        ) : !rows.length ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>
              <Icon name="verified" size={28} />
            </div>
            <h3 style={styles.emptyTitle}>No hay usuarios morosos</h3>
            <p style={styles.emptyText}>
              {hasFilters
                ? 'Ningún usuario coincide con la búsqueda o el rango de días vencidos seleccionado.'
                : 'Todos los planes vencidos del garage han sido cubiertos o no existen deudas activas en este momento.'}
            </p>
          </div>
        ) : (
          <>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Usuario / Garaje</th>
                    <th style={styles.th}>Deuda Total</th>
                    <th style={styles.th}>Días Vencidos</th>
                    <th style={styles.th}>Último Pago</th>
                    <th style={styles.th}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id || row.user_id}>
                      <td style={styles.td}>
                        <div style={styles.userCell}>
                          <div style={styles.userTitle}>{row.usuario || row.user_name || 'Usuario'}</div>
                          <div style={styles.userMeta}>{row.usuario_email || row.user_email || 'Sin correo registrado'}</div>
                          <div style={styles.userMeta}>
                            {row.garaje || row.garage_id || 'Garage sin identificar'} · {row.planes_pendientes || 0} plan{Number(row.planes_pendientes || 0) === 1 ? '' : 'es'} pendiente{Number(row.planes_pendientes || 0) === 1 ? '' : 's'}
                          </div>
                        </div>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.debtValue}>{formatCurrency(row.deuda_total || 0)}</div>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.overdueBadge}>{row.dias_vencidos || row.days_overdue || 0} días</span>
                      </td>
                      <td style={styles.td}>
                        {row.ultimo_pago ? (
                          <div style={styles.paymentCell}>
                            <div style={styles.paymentTitle}>{formatCurrency(row.ultimo_pago.monto || 0)}</div>
                            <div style={styles.paymentMeta}>{formatDate(row.ultimo_pago.fecha)}</div>
                            <div style={styles.paymentMeta}>
                              {row.ultimo_pago.referencia || 'Sin referencia'} · {row.ultimo_pago.metodo || 'Sin método'}
                            </div>
                          </div>
                        ) : (
                          <div style={styles.paymentMeta}>Sin pagos mensuales registrados.</div>
                        )}
                      </td>
                      <td style={styles.td}>
                        <div style={styles.actionRow}>
                          <button
                            type="button"
                            style={styles.actionButton}
                            onClick={() => navigate('/monthly-plans')}
                          >
                            Gestionar plan
                          </button>
                          <button
                            type="button"
                            style={styles.actionButton}
                            onClick={() => navigate('/users')}
                          >
                            Ver usuario
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={styles.footerRow}>
              <div style={styles.footerText}>
                Mostrando {rows.length} de {pagination.total} usuario{pagination.total === 1 ? '' : 's'} con morosidad activa.
              </div>
              <div style={styles.pager}>
                <button
                  type="button"
                  style={styles.button('ghost', page <= 1 || rowsApi.loading)}
                  disabled={page <= 1 || rowsApi.loading}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Anterior
                </button>
                <div style={styles.footerText}>Página {pagination.page} de {pagination.pageCount}</div>
                <button
                  type="button"
                  style={styles.button('ghost', page >= pagination.pageCount || rowsApi.loading)}
                  disabled={page >= pagination.pageCount || rowsApi.loading}
                  onClick={() => setPage((current) => Math.min(pagination.pageCount, current + 1))}
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      <div style={styles.note}>
        La morosidad se calcula con planes mensuales vencidos del garage autenticado. Si acabas de registrar un pago, el último movimiento puede tardar unos segundos en reflejarse mientras se sincronizan los comprobantes y el historial mensual.
      </div>
    </div>
  )
}
