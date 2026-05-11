import { useEffect, useMemo, useState } from 'react'

import { apiGet, apiPost, getCachedApiData } from '../lib/api'
import { getStoredUser } from '../services/api'

const styles = {
  page: { width: '100%', maxWidth: 1440, margin: '0 auto', color: '#e5eefb' },
  header: { display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 22 },
  title: { margin: 0, color: '#fff', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800 },
  subtitle: { margin: '8px 0 0', color: '#94a3b8', fontSize: 15, maxWidth: 760 },
  badge: { borderRadius: 999, padding: '9px 14px', background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.26)', color: '#bae6fd', fontWeight: 800, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8 },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 18 },
  stat: { borderRadius: 18, border: '1px solid rgba(148,163,184,0.16)', background: 'rgba(15,23,42,0.78)', padding: 18 },
  statLabel: { color: '#94a3b8', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 },
  statValue: { color: '#fff', fontSize: 30, fontWeight: 800 },
  layout: { display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) minmax(0, 1fr)', gap: 18, alignItems: 'start' },
  card: { borderRadius: 20, border: '1px solid rgba(148,163,184,0.16)', background: 'rgba(15,23,42,0.78)', overflow: 'hidden' },
  cardHead: { padding: '18px 20px', borderBottom: '1px solid rgba(148,163,184,0.12)' },
  cardTitle: { margin: 0, color: '#fff', fontSize: 17, fontWeight: 800 },
  cardSub: { margin: '6px 0 0', color: '#94a3b8', fontSize: 13 },
  cardBody: { padding: 20 },
  form: { display: 'grid', gap: 14 },
  label: { display: 'grid', gap: 8, color: '#a8bee0', fontSize: 13, fontWeight: 700 },
  input: { width: '100%', boxSizing: 'border-box', borderRadius: 12, border: '1px solid rgba(148,163,184,0.18)', background: 'rgba(2,6,23,0.42)', color: '#fff', padding: '11px 13px', fontFamily: 'inherit', outline: 'none' },
  button: (variant = 'primary', disabled = false) => ({
    borderRadius: 12,
    border: variant === 'ghost' ? '1px solid rgba(148,163,184,0.18)' : 'none',
    background: disabled ? 'rgba(56,189,248,0.25)' : variant === 'ghost' ? 'rgba(15,23,42,0.6)' : 'linear-gradient(135deg, #0284c7, #38bdf8)',
    color: variant === 'ghost' ? '#cbd5e1' : '#04111f',
    padding: '11px 16px',
    fontWeight: 800,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
  }),
  feedbackOk: { borderRadius: 14, padding: '12px 16px', marginBottom: 16, background: 'rgba(22,101,52,0.26)', border: '1px solid rgba(74,222,128,0.28)', color: '#bbf7d0', fontWeight: 700 },
  feedbackError: { borderRadius: 14, padding: '12px 16px', marginBottom: 16, background: 'rgba(127,29,29,0.28)', border: '1px solid rgba(248,113,113,0.28)', color: '#fecaca', fontWeight: 700 },
  summaryBox: { borderRadius: 16, border: '1px solid rgba(56,189,248,0.2)', background: 'rgba(8,47,73,0.28)', padding: 16, display: 'grid', gap: 10 },
  row: { display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '13px 18px', color: '#94a3b8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(148,163,184,0.12)' },
  td: { padding: '14px 18px', color: '#fff', fontSize: 13, borderTop: '1px solid rgba(148,163,184,0.08)' },
  status: (status) => ({
    display: 'inline-flex',
    padding: '6px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    background: status === 'pagado' ? 'rgba(22,101,52,0.26)' : status === 'vencido' ? 'rgba(127,29,29,0.28)' : 'rgba(180,83,9,0.24)',
    color: status === 'pagado' ? '#bbf7d0' : status === 'vencido' ? '#fecaca' : '#fde68a',
    border: `1px solid ${status === 'pagado' ? 'rgba(74,222,128,0.28)' : status === 'vencido' ? 'rgba(248,113,113,0.28)' : 'rgba(245,158,11,0.28)'}`,
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

const normalizeKey = (value) => String(value || '').trim().toLowerCase()

export default function MonthlyPlans() {
  const cachedUsers = getCachedApiData('/api/usuarios/')
  const cachedPending = getCachedApiData('/api/monthly-plans/pending')
  const [users, setUsers] = useState(() => (Array.isArray(cachedUsers?.data) ? cachedUsers.data : []))
  const [pendingPlans, setPendingPlans] = useState(() => (Array.isArray(cachedPending?.data) ? cachedPending.data : []))
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [loading, setLoading] = useState(!cachedUsers)
  const [saving, setSaving] = useState(false)
  const [payingId, setPayingId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({ amount: '3500', due_date: '' })

  const loadBase = async ({ showLoader = true } = {}) => {
    if (showLoader) setLoading(true)
    try {
      const [usersPayload, plansPayload] = await Promise.all([
        apiGet('/api/usuarios/', { forceFresh: true }),
        apiGet('/api/monthly-plans/pending', { forceFresh: true }),
      ])
      const usersData = Array.isArray(usersPayload?.data) ? usersPayload.data : []
      const plansData = Array.isArray(plansPayload?.data) ? plansPayload.data : []
      setUsers(usersData)
      setPendingPlans(plansData)
      if (!selectedUserId && usersData.length) {
        setSelectedUserId(String(usersData[0].id || usersData[0].auth_user_id || usersData[0].user_id || ''))
      }
      setError('')
    } catch (err) {
      setError(err.message || 'No se pudo cargar la informacion de mensualidades.')
    } finally {
      setLoading(false)
    }
  }

  const loadSelectedPlan = async (userId) => {
    if (!userId) {
      setSelectedPlan(null)
      return
    }
    try {
      const payload = await apiGet(`/api/monthly-plans/user/${userId}`, { forceFresh: true })
      const plan = payload?.data || null
      setSelectedPlan(plan)
      setForm({
        amount: plan?.amount ? String(plan.amount) : '3500',
        due_date: plan?.due_date ? String(plan.due_date).slice(0, 10) : '',
      })
    } catch (err) {
      setSelectedPlan(null)
      setForm({ amount: '3500', due_date: '' })
      setError(err.message || 'No se pudo cargar el plan del usuario.')
    }
  }

  useEffect(() => {
    loadBase({ showLoader: !cachedUsers })
  }, [])

  useEffect(() => {
    loadSelectedPlan(selectedUserId)
  }, [selectedUserId])

  const stats = useMemo(() => {
    const activeIds = new Set()
    users.forEach((user) => {
      const matching = pendingPlans.find((plan) => String(plan.user_id) === String(user.id))
      if (matching) activeIds.add(String(user.id))
    })
    return {
      active: activeIds.size + (selectedPlan && !activeIds.has(String(selectedPlan.user_id)) ? 1 : 0),
      pending: pendingPlans.filter((plan) => plan.status === 'pendiente').length,
      overdue: pendingPlans.filter((plan) => plan.status === 'vencido').length,
    }
  }, [pendingPlans, selectedPlan, users])

  const selectedUser = users.find((user) => String(user.id) === String(selectedUserId))
  const currentUser = getStoredUser()

  const currentUserPendingPlans = useMemo(() => {
    const currentUserKeys = new Set(
      [
        currentUser?.id,
        currentUser?.user_id,
        currentUser?.auth_user_id,
      ]
        .map(normalizeKey)
        .filter(Boolean),
    )

    const isPendingStatus = (status) => {
      const normalizedStatus = normalizeKey(status)
      return normalizedStatus === 'pendiente' || normalizedStatus === 'vencido'
    }

    const filtered = pendingPlans.filter((plan) => {
      const planUserKeys = [
        plan?.user_id,
        plan?.auth_user_id,
        plan?.userId,
      ]
        .map(normalizeKey)
        .filter(Boolean)

      return planUserKeys.some((key) => currentUserKeys.has(key)) && isPendingStatus(plan?.status)
    })

    if (
      selectedPlan &&
      isPendingStatus(selectedPlan.status) &&
      !filtered.some((plan) => normalizeKey(plan?.id) === normalizeKey(selectedPlan?.id))
    ) {
      const selectedPlanKeys = [
        selectedPlan?.user_id,
        selectedPlan?.auth_user_id,
        selectedPlan?.userId,
      ]
        .map(normalizeKey)
        .filter(Boolean)

      if (selectedPlanKeys.some((key) => currentUserKeys.has(key))) {
        filtered.push({
          ...selectedPlan,
          user_name:
            selectedPlan.user_name ||
            selectedUser?.name ||
            selectedUser?.full_name ||
            selectedUser?.email ||
            currentUser?.name ||
            currentUser?.full_name ||
            currentUser?.email ||
            '--',
        })
      }
    }

    return filtered
  }, [currentUser, pendingPlans, selectedPlan, selectedUser])

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
      await loadSelectedPlan(selectedUserId)
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
      await apiPost('/api/monthly-plans/pay', { plan_id: plan.id })
      setSuccess('Pago mensual registrado correctamente.')
      await loadBase({ showLoader: false })
      if (String(plan.user_id) === String(selectedUserId)) {
        await loadSelectedPlan(selectedUserId)
      }
    } catch (err) {
      setError(err.message || 'No se pudo registrar el pago del plan.')
    } finally {
      setPayingId('')
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Planes Mensuales</h1>
          <p style={styles.subtitle}>Configura cobros fijos por usuario, controla vencimientos y marca pagos desde un solo modulo.</p>
        </div>
        <div style={styles.badge}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>payments</span>
          RF18 - Mensualidad
        </div>
      </header>

      {error && <div style={styles.feedbackError}>{error}</div>}
      {success && <div style={styles.feedbackOk}>{success}</div>}

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
                <select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)} style={styles.input}>
                  <option value="">Selecciona un usuario</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
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
              <div style={styles.row}><span>Estado actual</span><span style={styles.status(selectedPlan?.status || 'pendiente')}>{selectedPlan?.status || 'sin plan'}</span></div>
              <div style={styles.row}><span>Monto</span><strong>{selectedPlan ? money(selectedPlan.amount) : '--'}</strong></div>
              <div style={styles.row}><span>Vencimiento</span><strong>{selectedPlan ? formatDate(selectedPlan.due_date) : '--'}</strong></div>
            </div>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHead}>
            <h2 style={styles.cardTitle}>Pendientes de pago</h2>
            <p style={styles.cardSub}>Listado operativo de planes pendientes o vencidos.</p>
          </div>
          <div style={styles.tableWrap}>
            {loading ? (
              <div style={styles.empty}>Cargando mensualidades...</div>
            ) : currentUserPendingPlans.length === 0 ? (
              <div style={styles.empty}>No hay planes pendientes por ahora.</div>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Usuario</th>
                    <th style={styles.th}>Monto</th>
                    <th style={styles.th}>Vence</th>
                    <th style={styles.th}>Estado</th>
                    <th style={styles.th}>Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {currentUserPendingPlans.map((plan) => (
                    <tr key={plan.id}>
                      <td style={styles.td}>{plan.user_name || '--'}</td>
                      <td style={styles.td}>{money(plan.amount)}</td>
                      <td style={styles.td}>{formatDate(plan.due_date)}</td>
                      <td style={styles.td}><span style={styles.status(plan.status)}>{plan.status}</span></td>
                      <td style={styles.td}>
                        <button type="button" style={styles.button('ghost', payingId === String(plan.id))} disabled={payingId === String(plan.id)} onClick={() => handlePay(plan)}>
                          {payingId === String(plan.id) ? 'Procesando...' : 'Marcar pagado'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
