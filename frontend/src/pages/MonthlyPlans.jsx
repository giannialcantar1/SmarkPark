import { Suspense, lazy, useEffect, useMemo, useState } from 'react'

import useChunkedList from '../hooks/useChunkedList'
import useDeferredLoader from '../hooks/useDeferredLoader'
import { apiGet, apiPost, getCachedApiData } from '../lib/api'
import {
  buildLatestPaymentMap,
  createMonthlyPlanPayment,
  deleteMonthlyPaymentReceipt,
  deleteMonthlyPlanPayment,
  listMonthlyPlanPayments,
  uploadMonthlyPaymentReceipt,
} from '../lib/monthlyPlanPayments'
import { getStoredUser } from '../services/api'

const PaymentModal = lazy(() => import('../components/PaymentModal/PaymentModal'))
const PAGE_SIZE = 50

const styles = {
  page: { width: '100%', maxWidth: 1440, margin: '0 auto', color: '#e5eefb' },
  header: { display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 22 },
  title: { margin: 0, color: '#fff', fontSize: 'var(--font-size-h1)', fontWeight: 600, lineHeight: 1.2 },
  subtitle: { margin: '8px 0 0', color: '#94a3b8', fontSize: 14, lineHeight: 1.55, maxWidth: 760 },
  badge: { borderRadius: 999, padding: '9px 14px', background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.26)', color: '#bae6fd', fontWeight: 600, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 8 },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 18 },
  stat: { borderRadius: 18, border: '1px solid rgba(148,163,184,0.16)', background: 'rgba(15,23,42,0.78)', padding: 18 },
  statLabel: { color: '#94a3b8', fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1.35, marginBottom: 8 },
  statValue: { color: '#fff', fontSize: 30, fontWeight: 600, lineHeight: 1.1 },
  layout: { display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) minmax(0, 1fr)', gap: 18, alignItems: 'start' },
  card: { borderRadius: 20, border: '1px solid rgba(148,163,184,0.16)', background: 'rgba(15,23,42,0.78)', overflow: 'hidden' },
  cardHead: { padding: '18px 20px', borderBottom: '1px solid rgba(148,163,184,0.12)' },
  cardTitle: { margin: 0, color: '#fff', fontSize: 'var(--font-size-h2)', fontWeight: 600, lineHeight: 1.2 },
  cardSub: { margin: '6px 0 0', color: '#94a3b8', fontSize: 14, lineHeight: 1.55 },
  cardBody: { padding: 20 },
  form: { display: 'grid', gap: 14 },
  label: { display: 'grid', gap: 8, color: '#a8bee0', fontSize: 12, fontWeight: 500, lineHeight: 1.35 },
  input: { width: '100%', boxSizing: 'border-box', borderRadius: 12, border: '1px solid rgba(148,163,184,0.18)', background: 'rgba(2,6,23,0.42)', color: '#fff', padding: '11px 13px', fontFamily: 'inherit', outline: 'none' },
  button: (variant = 'primary', disabled = false) => ({
    borderRadius: 12,
    border: variant === 'ghost' ? '1px solid rgba(148,163,184,0.18)' : 'none',
    background: disabled ? 'rgba(56,189,248,0.25)' : variant === 'ghost' ? 'rgba(15,23,42,0.6)' : 'linear-gradient(135deg, #0284c7, #38bdf8)',
    color: variant === 'ghost' ? '#cbd5e1' : '#04111f',
    padding: '11px 16px',
    fontWeight: 600,
    fontSize: 14,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
  }),
  feedbackOk: { borderRadius: 14, padding: '12px 16px', marginBottom: 16, background: 'rgba(22,101,52,0.26)', border: '1px solid rgba(74,222,128,0.28)', color: '#bbf7d0', fontWeight: 500, fontSize: 14, lineHeight: 1.55 },
  feedbackError: { borderRadius: 14, padding: '12px 16px', marginBottom: 16, background: 'rgba(127,29,29,0.28)', border: '1px solid rgba(248,113,113,0.28)', color: '#fecaca', fontWeight: 500, fontSize: 14, lineHeight: 1.55 },
  summaryBox: { borderRadius: 16, border: '1px solid rgba(56,189,248,0.2)', background: 'rgba(8,47,73,0.28)', padding: 16, display: 'grid', gap: 10 },
  row: { display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14, lineHeight: 1.55 },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  lastPaymentCell: { display: 'grid', gap: 4 },
  lastPaymentRef: { color: '#fff', fontSize: 14, fontWeight: 600, lineHeight: 1.35 },
  lastPaymentMeta: { color: '#94a3b8', fontSize: 12, lineHeight: 1.35 },
  receiptLink: { color: '#7dd3fc', fontSize: 12, fontWeight: 600, textDecoration: 'none' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '13px 18px', color: '#94a3b8', fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(148,163,184,0.12)' },
  td: { padding: '14px 18px', color: '#fff', fontSize: 14, lineHeight: 1.55, borderTop: '1px solid rgba(148,163,184,0.08)', verticalAlign: 'top' },
  skeleton: {
    borderRadius: 10,
    background: 'linear-gradient(90deg, rgba(2,6,23,0.88) 0%, rgba(30,41,59,0.95) 50%, rgba(2,6,23,0.88) 100%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.2s linear infinite',
  },
  status: (status) => ({
    display: 'inline-flex',
    padding: '6px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    background: status === 'pagado' || status === 'approved' ? 'rgba(22,101,52,0.26)' : status === 'vencido' ? 'rgba(127,29,29,0.28)' : 'rgba(180,83,9,0.24)',
    color: status === 'pagado' || status === 'approved' ? '#bbf7d0' : status === 'vencido' ? '#fecaca' : '#fde68a',
    border: `1px solid ${status === 'pagado' || status === 'approved' ? 'rgba(74,222,128,0.28)' : status === 'vencido' ? 'rgba(248,113,113,0.28)' : 'rgba(245,158,11,0.28)'}`,
  }),
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
const getUserKey = (user) => String(user?.id || user?.auth_user_id || user?.user_id || '').trim()

const createPaymentReference = (prefix = 'SPK') => {
  const seed = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
    .replace(/[^a-z0-9]/gi, '')
    .toUpperCase()
  return `${prefix}-${seed.slice(-8).padStart(8, '0')}`
}

export default function MonthlyPlans() {
  const cachedUsers = getCachedApiData('/api/usuarios/')
  const cachedAllPlans = getCachedApiData('/api/monthly-plans')
  const [users, setUsers] = useState(() => (Array.isArray(cachedUsers?.data) ? cachedUsers.data : []))
  const [allPlans, setAllPlans] = useState(() => (Array.isArray(cachedAllPlans?.data) ? cachedAllPlans.data : []))
  const [paymentRows, setPaymentRows] = useState([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [loading, setLoading] = useState(!cachedAllPlans)
  const [loadingSecondary, setLoadingSecondary] = useState(false)
  const [saving, setSaving] = useState(false)
  const [payingId, setPayingId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({ amount: '3500', due_date: '' })
  const currentUser = getStoredUser()
  const currentGarageId = normalizeKey(currentUser?.garage_id || currentUser?.garageId)

  const normalizeMonthlyPlanUsers = (rows = []) =>
    rows
      .filter((user) => {
        const rowGarageId = normalizeKey(user?.garage_id || user?.garageId)
        return !currentGarageId || !rowGarageId || rowGarageId === currentGarageId
      })
      .map((user) => ({
        ...user,
        id: getUserKey(user),
      }))
      .filter((user) => Boolean(user.id))

  const loadSecondary = async (allPlansData, { forceFresh = true } = {}) => {
    setLoadingSecondary(true)
    try {
      const [usersPayload, monthlyPayments] = await Promise.all([
        apiGet('/api/usuarios/', { forceFresh }),
        allPlansData.length
          ? listMonthlyPlanPayments({
              garageId: currentUser?.garage_id || currentUser?.garageId,
              planIds: allPlansData.map((plan) => plan?.id),
            })
          : Promise.resolve([]),
      ])

      const usersData = normalizeMonthlyPlanUsers(Array.isArray(usersPayload?.data) ? usersPayload.data : [])
      setUsers(usersData)
      setPaymentRows(Array.isArray(monthlyPayments) ? monthlyPayments : [])

      if (!selectedUserId && usersData.length) {
        setSelectedUserId(getUserKey(usersData[0]))
      }
    } finally {
      setLoadingSecondary(false)
    }
  }

  const loadBase = async ({ showLoader = true, deferSecondary = false } = {}) => {
    if (showLoader) setLoading(true)
    try {
      const allPlansPayload = await apiGet('/api/monthly-plans', { forceFresh: true })
      const allPlansData = Array.isArray(allPlansPayload?.data) ? allPlansPayload.data : []
      setAllPlans(allPlansData)
      setError('')
      if (!deferSecondary) {
        await loadSecondary(allPlansData, { forceFresh: true })
      }
    } catch (err) {
      setError(err.message || 'No se pudo cargar la informacion de mensualidades.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBase({ showLoader: !cachedAllPlans, deferSecondary: true })
  }, [])

  useDeferredLoader(
    () => {
      if (loading || loadingSecondary) return null
      return loadSecondary(allPlans, { forceFresh: true })
    },
    [allPlans.length, loading, loadingSecondary, users.length, paymentRows.length],
    { enabled: users.length === 0 || paymentRows.length === 0, timeout: 180 },
  )

  const stats = useMemo(() => ({
    active: allPlans.length,
    pending: allPlans.filter((plan) => normalizeKey(plan.status) === 'pendiente').length,
    overdue: allPlans.filter((plan) => normalizeKey(plan.status) === 'vencido').length,
  }), [allPlans])

  const selectedUser = users.find((user) => getUserKey(user) === String(selectedUserId))
  const latestPaymentByPlanId = useMemo(() => buildLatestPaymentMap(paymentRows), [paymentRows])
  const currentUserPlan = useMemo(
    () => allPlans.find((plan) => normalizeKey(plan.user_id) === normalizeKey(selectedUserId)) || null,
    [allPlans, selectedUserId],
  )

  const plansList = useMemo(() => {
    const statusWeight = { vencido: 0, pendiente: 1, pagado: 2 }
    return [...allPlans].sort((left, right) => {
      const leftWeight = statusWeight[normalizeKey(left?.status)] ?? 9
      const rightWeight = statusWeight[normalizeKey(right?.status)] ?? 9
      if (leftWeight !== rightWeight) return leftWeight - rightWeight
      const leftDate = new Date(left?.due_date || 0).getTime()
      const rightDate = new Date(right?.due_date || 0).getTime()
      return leftDate - rightDate
    })
  }, [allPlans])

  const {
    hasMore,
    sentinelRef,
    visibleCount,
    visibleItems: visiblePlans,
  } = useChunkedList(plansList, {
    enabled: !loading,
    pageSize: PAGE_SIZE,
  })

  const persistApprovedPlanPayment = async ({ plan, method, reference, receiptFile = null }) => {
    let createdPayment = null
    let uploadedReceiptPath = null

    try {
      let receiptUrl = null
      if (method === 'transfer' && receiptFile) {
        const uploaded = await uploadMonthlyPaymentReceipt({
          garageId: currentUser?.garage_id || currentUser?.garageId,
          planId: plan.id,
          reference,
          file: receiptFile,
        })
        receiptUrl = uploaded.publicUrl
        uploadedReceiptPath = uploaded.objectPath
      }

      createdPayment = await createMonthlyPlanPayment({
        garage_id: currentUser?.garage_id || currentUser?.garageId || null,
        plan_id: plan.id,
        user_id: plan.user_id,
        amount: Number(plan.amount || 0),
        method,
        reference,
        status: 'approved',
        receipt_url: receiptUrl,
      })

      await apiPost('/api/monthly-plans/pay', { plan_id: plan.id })
      return createdPayment
    } catch (err) {
      if (createdPayment?.id) {
        await deleteMonthlyPlanPayment(createdPayment.id).catch(() => null)
      }
      if (uploadedReceiptPath) {
        await deleteMonthlyPaymentReceipt(uploadedReceiptPath).catch(() => null)
      }
      throw err
    }
  }

  useEffect(() => {
    setForm({
      amount: currentUserPlan?.amount ? String(currentUserPlan.amount) : '3500',
      due_date: currentUserPlan?.due_date ? String(currentUserPlan.due_date).slice(0, 10) : '',
    })
  }, [currentUserPlan])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await apiPost('/api/monthly-plans/create', {
        user_id: selectedUserId,
        amount: Number(form.amount || 0),
        due_date: form.due_date,
      })
      setSuccess('Plan mensual guardado correctamente.')
      await loadBase({ showLoader: false })
    } catch (err) {
      setError(err.message || 'No se pudo guardar el plan mensual.')
    } finally {
      setSaving(false)
    }
  }

  const handlePay = async (plan) => {
    setPayingId(String(plan.id))
    setError('')
    setSuccess('')
    try {
      const reference = createPaymentReference('SPK-MANUAL')
      await persistApprovedPlanPayment({
        plan,
        method: 'manual',
        reference,
      })
      setSuccess(`Pago mensual registrado correctamente. Referencia ${reference}.`)
      await loadBase({ showLoader: false })
    } catch (err) {
      setError(err.message || 'No se pudo registrar el pago del plan.')
    } finally {
      setPayingId('')
    }
  }

  const handleModalPaymentSuccess = async ({ referenceNumber }) => {
    setError('')
    setSuccess(`Pago mensual registrado correctamente. Referencia ${referenceNumber}.`)
    await loadBase({ showLoader: false })
  }

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Planes Mensuales</h1>
          <p style={styles.subtitle}>Configura cobros fijos por usuario, controla vencimientos y marca pagos desde un solo modulo.</p>
        </div>
      </header>

      {error && <div style={styles.feedbackError}>{error}</div>}
      {success && <div style={styles.feedbackOk}>{success}</div>}
      {loadingSecondary && !loading && (
        <div style={{ marginBottom: 16, color: '#94a3b8', fontSize: 12 }}>
          Sincronizando usuarios y ultimos pagos...
        </div>
      )}

      <section style={styles.stats}>
        <article style={styles.stat}><div style={styles.statLabel}>Planes activos</div><div style={styles.statValue}>{stats.active}</div></article>
        <article style={styles.stat}><div style={styles.statLabel}>Pendientes</div><div style={styles.statValue}>{stats.pending}</div></article>
        <article style={styles.stat}><div style={styles.statLabel}>Vencidos</div><div style={styles.statValue}>{stats.overdue}</div></article>
      </section>

      <section style={styles.layout}>
        <div style={styles.card}>
          <div style={styles.cardHead}>
            <h2 style={styles.cardTitle}>Configurar plan</h2>
            <p style={styles.cardSub}>Selecciona un usuario y asigna monto fijo con fecha de vencimiento.</p>
          </div>
          <div style={styles.cardBody}>
            <form style={styles.form} onSubmit={handleSubmit}>
              <label style={styles.label}>
                <span>Usuario</span>
                <select
                  value={selectedUserId}
                  onChange={(event) => setSelectedUserId(event.target.value)}
                  style={styles.input}
                  disabled={loadingSecondary && users.length === 0}
                >
                  <option value="">{loadingSecondary && users.length === 0 ? 'Cargando usuarios...' : 'Selecciona un usuario'}</option>
                  {users.map((user) => (
                    <option key={getUserKey(user)} value={getUserKey(user)}>
                      {(user.name || user.full_name || user.email || 'Usuario')} - {user.email || 'Sin correo'}
                    </option>
                  ))}
                </select>
              </label>

              <label style={styles.label}>
                <span>Monto mensual (DOP)</span>
                <input type="number" min="1" step="0.01" value={form.amount} onChange={(event) => setForm((cur) => ({ ...cur, amount: event.target.value }))} style={styles.input} />
              </label>

              <label style={styles.label}>
                <span>Fecha de vencimiento</span>
                <input type="date" value={form.due_date} onChange={(event) => setForm((cur) => ({ ...cur, due_date: event.target.value }))} style={styles.input} />
              </label>

              <button type="submit" style={styles.button('primary', saving)} disabled={saving || !selectedUserId}>
                {saving ? 'Guardando...' : selectedPlan ? 'Actualizar plan' : 'Crear plan'}
              </button>
            </form>

            <div style={{ height: 16 }} />

            <div style={styles.summaryBox}>
              <div style={styles.row}><span>Usuario</span><strong>{selectedUser?.name || selectedUser?.full_name || selectedUser?.email || '--'}</strong></div>
              <div style={styles.row}><span>Estado actual</span><span style={styles.status(currentUserPlan?.status || 'pendiente')}>{currentUserPlan?.status || 'sin plan'}</span></div>
              <div style={styles.row}><span>Monto</span><strong>{currentUserPlan ? money(currentUserPlan.amount) : '--'}</strong></div>
              <div style={styles.row}><span>Vencimiento</span><strong>{currentUserPlan ? formatDate(currentUserPlan.due_date) : '--'}</strong></div>
            </div>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHead}>
            <h2 style={styles.cardTitle}>Planes registrados</h2>
            <p style={styles.cardSub}>Aqui ves todas las personas del garage que ya tienen un plan mensual.</p>
          </div>
          <div style={styles.tableWrap}>
            {loading ? (
              <div style={{ padding: 20, display: 'grid', gap: 12 }}>
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} style={{ ...styles.skeleton, height: 52 }} />
                ))}
              </div>
            ) : plansList.length === 0 ? (
              <div style={styles.empty}>Todavia no hay planes creados para este garage.</div>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Usuario</th>
                    <th style={styles.th}>Monto</th>
                    <th style={styles.th}>Vence</th>
                    <th style={styles.th}>Estado</th>
                    <th style={styles.th}>Ultimo pago</th>
                    <th style={styles.th}>Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePlans.map((plan) => {
                    const latestPayment = latestPaymentByPlanId[String(plan.id || '').trim()]
                    return (
                      <tr key={plan.id}>
                        <td style={styles.td}>{plan.user_name || plan.user_email || '--'}</td>
                        <td style={styles.td}>{money(plan.amount)}</td>
                        <td style={styles.td}>{formatDate(plan.due_date)}</td>
                        <td style={styles.td}><span style={styles.status(plan.status)}>{plan.status}</span></td>
                        <td style={styles.td}>
                          {latestPayment ? (
                            <div style={styles.lastPaymentCell}>
                              <span style={styles.lastPaymentRef}>{latestPayment.reference || '--'}</span>
                              <span style={styles.lastPaymentMeta}>{formatDateTime(latestPayment.paid_at)}</span>
                              {latestPayment.receipt_url ? (
                                <a href={latestPayment.receipt_url} target="_blank" rel="noreferrer" style={styles.receiptLink}>
                                  Ver comprobante
                                </a>
                              ) : null}
                            </div>
                          ) : (
                            <span style={styles.lastPaymentMeta}>{loadingSecondary ? 'Cargando...' : '--'}</span>
                          )}
                        </td>
                        <td style={styles.td}>
                          {normalizeKey(plan.status) === 'pagado' ? (
                            <span style={styles.status('pagado')}>Pagado</span>
                          ) : (
                            <div style={styles.actions}>
                              <button type="button" style={styles.button('primary', false)} onClick={() => setSelectedPlan(plan)}>
                                Pagar
                              </button>
                              <button type="button" style={styles.button('ghost', payingId === String(plan.id))} disabled={payingId === String(plan.id)} onClick={() => handlePay(plan)}>
                                {payingId === String(plan.id) ? 'Procesando...' : 'Marcar pagado'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
          {!loading && plansList.length > 0 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              padding: '14px 18px 18px',
              color: '#94a3b8',
              fontSize: 12,
            }}>
              <span>Mostrando {visibleCount} de {plansList.length} planes</span>
              {hasMore ? <span ref={sentinelRef}>Cargando mas...</span> : <span>Fin del listado</span>}
            </div>
          )}
        </div>
      </section>

      {selectedPlan && (
        <Suspense fallback={null}>
          <PaymentModal
            isOpen={selectedPlan !== null}
            onClose={() => setSelectedPlan(null)}
            garageId={currentUser?.garage_id || currentUser?.garageId || ''}
            onPaymentSuccess={handleModalPaymentSuccess}
            planData={{
              cliente: selectedPlan.user_name || 'Cliente',
              monto: selectedPlan.amount || 0,
              vencimiento: selectedPlan.due_date || '',
              planId: selectedPlan.id,
              userId: selectedPlan.user_id,
              status: selectedPlan.status,
            }}
          />
        </Suspense>
      )}
    </div>
  )
}
