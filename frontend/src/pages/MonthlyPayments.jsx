import { useEffect, useMemo, useState } from 'react'

import { apiGet } from '../lib/api'
import { listMonthlyPlanPayments } from '../lib/monthlyPlanPayments'
import { getStoredUser } from '../services/api'

const styles = {
  page: { width: '100%', maxWidth: 1440, margin: '0 auto', color: '#e5eefb' },
  header: { display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 22 },
  title: { margin: 0, color: '#fff', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800 },
  subtitle: { margin: '8px 0 0', color: '#94a3b8', fontSize: 15, maxWidth: 760 },
  badge: { borderRadius: 999, padding: '9px 14px', background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.26)', color: '#bae6fd', fontWeight: 800, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8 },
  card: { borderRadius: 20, border: '1px solid rgba(148,163,184,0.16)', background: 'rgba(15,23,42,0.78)', overflow: 'hidden' },
  cardHead: { padding: '18px 20px', borderBottom: '1px solid rgba(148,163,184,0.12)' },
  cardTitle: { margin: 0, color: '#fff', fontSize: 17, fontWeight: 800 },
  cardSub: { margin: '6px 0 0', color: '#94a3b8', fontSize: 13 },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '13px 18px', color: '#94a3b8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(148,163,184,0.12)' },
  td: { padding: '14px 18px', color: '#fff', fontSize: 13, borderTop: '1px solid rgba(148,163,184,0.08)', verticalAlign: 'top' },
  empty: { padding: 30, color: '#94a3b8', textAlign: 'center' },
  feedbackError: { borderRadius: 14, padding: '12px 16px', marginBottom: 16, background: 'rgba(127,29,29,0.28)', border: '1px solid rgba(248,113,113,0.28)', color: '#fecaca', fontWeight: 700 },
  status: { display: 'inline-flex', padding: '6px 10px', borderRadius: 999, fontSize: 12, fontWeight: 800, background: 'rgba(22,101,52,0.26)', color: '#bbf7d0', border: '1px solid rgba(74,222,128,0.28)' },
  receiptLink: { color: '#7dd3fc', textDecoration: 'none', fontWeight: 700 },
}

const money = (value) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 2 }).format(Number(value) || 0)

const formatDateTime = (value) => {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return new Intl.DateTimeFormat('es-DO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const normalizeKey = (value) => String(value || '').trim().toLowerCase()

export default function MonthlyPayments() {
  const currentUser = getStoredUser()
  const currentGarageId = normalizeKey(currentUser?.garage_id || currentUser?.garageId)
  const [users, setUsers] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const usersPayload = await apiGet('/api/usuarios/', { forceFresh: true })
      const usersData = (Array.isArray(usersPayload?.data) ? usersPayload.data : []).filter((user) => {
        const rowGarageId = normalizeKey(user?.garage_id || user?.garageId)
        return !currentGarageId || !rowGarageId || rowGarageId === currentGarageId
      })

      const paymentRows = await listMonthlyPlanPayments({
        garageId: currentUser?.garage_id || currentUser?.garageId,
      })

      setUsers(usersData)
      setPayments(paymentRows)
      setError('')
    } catch (err) {
      setError(err.message || 'No se pudo cargar el historial de pagos mensuales.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const userMap = useMemo(() => {
    return users.reduce((acc, user) => {
      const keys = [user?.id, user?.auth_user_id, user?.user_id]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
      keys.forEach((key) => {
        acc[key] = user
      })
      return acc
    }, {})
  }, [users])

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Pagos Mensuales</h1>
          <p style={styles.subtitle}>Historial real de pagos aprobados para las mensualidades del garage actual.</p>
        </div>
        <div style={styles.badge}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>receipt_long</span>
          Ledger mensual
        </div>
      </header>

      {error && <div style={styles.feedbackError}>{error}</div>}

      <div style={styles.card}>
        <div style={styles.cardHead}>
          <h2 style={styles.cardTitle}>Historial de pagos</h2>
          <p style={styles.cardSub}>Cada fila corresponde a un pago aprobado guardado en Supabase.</p>
        </div>
        <div style={styles.tableWrap}>
          {loading ? (
            <div style={styles.empty}>Cargando pagos mensuales...</div>
          ) : payments.length === 0 ? (
            <div style={styles.empty}>Todavia no hay pagos mensuales registrados.</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Usuario</th>
                  <th style={styles.th}>Monto</th>
                  <th style={styles.th}>Metodo</th>
                  <th style={styles.th}>Referencia</th>
                  <th style={styles.th}>Fecha</th>
                  <th style={styles.th}>Estado</th>
                  <th style={styles.th}>Comprobante</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => {
                  const user = userMap[String(payment?.user_id || '').trim()]
                  return (
                    <tr key={payment.id}>
                      <td style={styles.td}>{user?.name || user?.full_name || user?.email || payment.user_id || '--'}</td>
                      <td style={styles.td}>{money(payment.amount)}</td>
                      <td style={styles.td}>{payment.method || '--'}</td>
                      <td style={styles.td}>{payment.reference || '--'}</td>
                      <td style={styles.td}>{formatDateTime(payment.paid_at)}</td>
                      <td style={styles.td}><span style={styles.status}>{payment.status || 'approved'}</span></td>
                      <td style={styles.td}>
                        {payment.receipt_url ? (
                          <a href={payment.receipt_url} target="_blank" rel="noreferrer" style={styles.receiptLink}>
                            Ver comprobante
                          </a>
                        ) : (
                          '--'
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
