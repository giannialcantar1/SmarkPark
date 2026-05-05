import { useEffect, useMemo, useState } from 'react'

import { apiGet, apiPost, getCachedApiData } from '../lib/api'

const styles = {
  page: { width: '100%', maxWidth: 1440, margin: '0 auto', color: '#e5eefb' },
  header: { display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 22 },
  title: { margin: 0, color: '#fff', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800 },
  subtitle: { margin: '8px 0 0', color: '#94a3b8', fontSize: 15, maxWidth: 760 },
  badge: { borderRadius: 999, padding: '9px 14px', background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.26)', color: '#fecaca', fontWeight: 800, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8 },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 18 },
  stat: { borderRadius: 18, border: '1px solid rgba(148,163,184,0.16)', background: 'rgba(15,23,42,0.78)', padding: 18 },
  statLabel: { color: '#94a3b8', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 },
  statValue: { color: '#fff', fontSize: 30, fontWeight: 800 },
  card: { borderRadius: 20, border: '1px solid rgba(148,163,184,0.16)', background: 'rgba(15,23,42,0.78)', overflow: 'hidden' },
  cardHead: { padding: '18px 20px', borderBottom: '1px solid rgba(148,163,184,0.12)' },
  cardTitle: { margin: 0, color: '#fff', fontSize: 17, fontWeight: 800 },
  cardSub: { margin: '6px 0 0', color: '#94a3b8', fontSize: 13 },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '13px 18px', color: '#94a3b8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(148,163,184,0.12)' },
  td: { padding: '14px 18px', color: '#fff', fontSize: 13, borderTop: '1px solid rgba(148,163,184,0.08)' },
  button: (disabled = false) => ({ borderRadius: 12, border: '1px solid rgba(148,163,184,0.18)', background: disabled ? 'rgba(56,189,248,0.16)' : 'rgba(15,23,42,0.6)', color: '#cbd5e1', padding: '10px 14px', fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }),
  status: { display: 'inline-flex', padding: '6px 10px', borderRadius: 999, fontSize: 12, fontWeight: 800, background: 'rgba(127,29,29,0.28)', color: '#fecaca', border: '1px solid rgba(248,113,113,0.28)' },
  feedbackOk: { borderRadius: 14, padding: '12px 16px', marginBottom: 16, background: 'rgba(22,101,52,0.26)', border: '1px solid rgba(74,222,128,0.28)', color: '#bbf7d0', fontWeight: 700 },
  feedbackError: { borderRadius: 14, padding: '12px 16px', marginBottom: 16, background: 'rgba(127,29,29,0.28)', border: '1px solid rgba(248,113,113,0.28)', color: '#fecaca', fontWeight: 700 },
  empty: { padding: 30, color: '#94a3b8', textAlign: 'center' },
}

const money = (value) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 2 }).format(Number(value) || 0)

const formatDate = (value) => {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return new Intl.DateTimeFormat('es-DO', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

export default function Morosidad() {
  const cachedUsers = getCachedApiData('/api/morosidad/usuarios')
  const cachedStats = getCachedApiData('/api/morosidad/stats')
  const [rows, setRows] = useState(() => (Array.isArray(cachedUsers?.data) ? cachedUsers.data : []))
  const [stats, setStats] = useState(() => cachedStats?.data || { total_morosos: 0, monto_adeudado: 0 })
  const [loading, setLoading] = useState(!cachedUsers)
  const [payingId, setPayingId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = async ({ showLoader = true } = {}) => {
    if (showLoader) setLoading(true)
    try {
      const [usersPayload, statsPayload] = await Promise.all([
        apiGet('/api/morosidad/usuarios', { forceFresh: true }),
        apiGet('/api/morosidad/stats', { forceFresh: true }),
      ])
      setRows(Array.isArray(usersPayload?.data) ? usersPayload.data : [])
      setStats(statsPayload?.data || { total_morosos: 0, monto_adeudado: 0 })
      setError('')
    } catch (err) {
      setError(err.message || 'No se pudo cargar la morosidad.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load({ showLoader: !cachedUsers })
  }, [])

  const summary = useMemo(() => ({
    overdueCount: Number(stats.total_morosos || 0),
    debtAmount: Number(stats.monto_adeudado || 0),
  }), [stats])

  const markPaid = async (row) => {
    setPayingId(String(row.id))
    setError('')
    setSuccess('')
    try {
      await apiPost('/api/monthly-plans/pay', { plan_id: row.id })
      setSuccess('Usuario marcado como pagado correctamente.')
      await load({ showLoader: false })
    } catch (err) {
      setError(err.message || 'No se pudo registrar el pago.')
    } finally {
      setPayingId('')
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Usuarios Morosos</h1>
          <p style={styles.subtitle}>Identifica deudas vigentes, dias vencidos y salda planes pendientes sin salir del modulo.</p>
        </div>
        <div style={styles.badge}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>warning</span>
          RF19 - Morosidad
        </div>
      </header>

      {error && <div style={styles.feedbackError}>{error}</div>}
      {success && <div style={styles.feedbackOk}>{success}</div>}

      <section style={styles.stats}>
        <article style={styles.stat}><div style={styles.statLabel}>Usuarios morosos</div><div style={styles.statValue}>{summary.overdueCount}</div></article>
        <article style={styles.stat}><div style={styles.statLabel}>Monto adeudado</div><div style={styles.statValue}>{money(summary.debtAmount)}</div></article>
      </section>

      <div style={styles.card}>
        <div style={styles.cardHead}>
          <h2 style={styles.cardTitle}>Listado de morosidad</h2>
          <p style={styles.cardSub}>Solo aparecen planes vencidos al dia de hoy.</p>
        </div>
        <div style={styles.tableWrap}>
          {loading ? (
            <div style={styles.empty}>Cargando morosidad...</div>
          ) : rows.length === 0 ? (
            <div style={styles.empty}>No hay usuarios morosos en este momento.</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Usuario</th>
                  <th style={styles.th}>Monto</th>
                  <th style={styles.th}>Vencimiento</th>
                  <th style={styles.th}>Dias vencido</th>
                  <th style={styles.th}>Estado</th>
                  <th style={styles.th}>Accion</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td style={styles.td}>{row.user_name || '--'}</td>
                    <td style={styles.td}>{money(row.amount)}</td>
                    <td style={styles.td}>{formatDate(row.due_date)}</td>
                    <td style={styles.td}>{row.days_overdue || 0}</td>
                    <td style={styles.td}><span style={styles.status}>Moroso</span></td>
                    <td style={styles.td}>
                      <button type="button" style={styles.button(payingId === String(row.id))} disabled={payingId === String(row.id)} onClick={() => markPaid(row)}>
                        {payingId === String(row.id) ? 'Procesando...' : 'Marcar pagado'}
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
  )
}
