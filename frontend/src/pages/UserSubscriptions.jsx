import { Suspense, lazy, useEffect, useState } from 'react'

import { useAuth } from '../contexts/AuthContext'
import { apiGet } from '../lib/api'
import { buildLatestPaymentMap, listMonthlyPlanPayments } from '../lib/monthlyPlanPayments'

const PaymentModal = lazy(() => import('../components/PaymentModal/PaymentModal'))

const styles = {
  page: { width: '100%', maxWidth: 1200, margin: '0 auto', color: '#e5eefb' },
  hero: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 0.9fr)',
    gap: 18,
    alignItems: 'stretch',
    marginBottom: 22,
  },
  heroCard: {
    borderRadius: 24,
    padding: '28px 28px 24px',
    border: '1px solid rgba(56,189,248,0.2)',
    background: 'linear-gradient(135deg, rgba(8,47,73,0.92), rgba(15,23,42,0.94))',
    boxShadow: '0 22px 48px rgba(2,6,23,0.28)',
  },
  eyebrow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 14px',
    borderRadius: 999,
    background: 'rgba(56,189,248,0.12)',
    border: '1px solid rgba(125,211,252,0.24)',
    color: '#bae6fd',
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  title: { margin: '18px 0 10px', color: '#fff', fontSize: 'clamp(2rem, 4vw, 3.1rem)', fontWeight: 900, lineHeight: 1.02 },
  subtitle: { margin: 0, color: '#cbd5e1', fontSize: 15, maxWidth: 620, lineHeight: 1.6 },
  heroMeta: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 22 },
  heroMetaCard: {
    borderRadius: 18,
    padding: '14px 16px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(148,163,184,0.16)',
  },
  heroMetaLabel: { color: '#94a3b8', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 },
  heroMetaValue: { color: '#fff', fontSize: 20, fontWeight: 900 },
  summaryCard: {
    borderRadius: 24,
    padding: 24,
    border: '1px solid rgba(148,163,184,0.16)',
    background: 'rgba(15,23,42,0.86)',
    display: 'grid',
    gap: 14,
  },
  summaryLabel: { color: '#94a3b8', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' },
  summaryValue: { color: '#fff', fontSize: 26, fontWeight: 900 },
  summaryHint: { color: '#cbd5e1', fontSize: 14, lineHeight: 1.6 },
  primaryButton: {
    border: 'none',
    borderRadius: 16,
    background: 'linear-gradient(135deg, #f59e0b, #facc15)',
    color: '#291300',
    padding: '14px 18px',
    fontWeight: 900,
    fontFamily: 'inherit',
    cursor: 'pointer',
    boxShadow: '0 18px 34px rgba(245,158,11,0.28)',
  },
  mutedButton: {
    border: '1px solid rgba(148,163,184,0.16)',
    borderRadius: 16,
    background: 'rgba(15,23,42,0.65)',
    color: '#cbd5e1',
    padding: '14px 18px',
    fontWeight: 800,
    fontFamily: 'inherit',
  },
  feedbackOk: {
    borderRadius: 16,
    padding: '12px 16px',
    marginBottom: 18,
    background: 'rgba(22,101,52,0.26)',
    border: '1px solid rgba(74,222,128,0.26)',
    color: '#bbf7d0',
    fontWeight: 700,
  },
  feedbackError: {
    borderRadius: 16,
    padding: '12px 16px',
    marginBottom: 18,
    background: 'rgba(127,29,29,0.28)',
    border: '1px solid rgba(248,113,113,0.28)',
    color: '#fecaca',
    fontWeight: 700,
  },
  contentGrid: { display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(280px, 0.8fr)', gap: 18, alignItems: 'start' },
  panel: {
    borderRadius: 24,
    border: '1px solid rgba(148,163,184,0.16)',
    background: 'rgba(15,23,42,0.82)',
    overflow: 'hidden',
  },
  panelHead: { padding: '20px 22px', borderBottom: '1px solid rgba(148,163,184,0.12)' },
  panelTitle: { margin: 0, color: '#fff', fontSize: 18, fontWeight: 900 },
  panelSub: { margin: '6px 0 0', color: '#94a3b8', fontSize: 13, lineHeight: 1.6 },
  panelBody: { padding: 22 },
  detailsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 },
  detailCard: {
    borderRadius: 18,
    padding: '16px 18px',
    background: 'rgba(2,6,23,0.38)',
    border: '1px solid rgba(148,163,184,0.12)',
  },
  detailLabel: { color: '#94a3b8', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 },
  detailValue: { color: '#fff', fontSize: 18, fontWeight: 800 },
  detailHint: { color: '#cbd5e1', fontSize: 12, marginTop: 6, lineHeight: 1.5 },
  statusBadge: (status) => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px 12px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    textTransform: 'capitalize',
    background:
      status === 'pagado'
        ? 'rgba(22,101,52,0.26)'
        : status === 'vencido'
          ? 'rgba(127,29,29,0.28)'
          : 'rgba(180,83,9,0.24)',
    color:
      status === 'pagado'
        ? '#bbf7d0'
        : status === 'vencido'
          ? '#fecaca'
          : '#fde68a',
    border: `1px solid ${
      status === 'pagado'
        ? 'rgba(74,222,128,0.28)'
        : status === 'vencido'
          ? 'rgba(248,113,113,0.28)'
          : 'rgba(245,158,11,0.28)'
    }`,
  }),
  paymentCard: {
    borderRadius: 20,
    padding: 18,
    background: 'linear-gradient(135deg, rgba(3,105,161,0.18), rgba(15,23,42,0.32))',
    border: '1px solid rgba(56,189,248,0.16)',
    display: 'grid',
    gap: 8,
  },
  paymentTitle: { color: '#fff', fontSize: 16, fontWeight: 800 },
  paymentMeta: { color: '#cbd5e1', fontSize: 13, lineHeight: 1.6 },
  paymentRef: { color: '#7dd3fc', fontSize: 13, fontWeight: 800, wordBreak: 'break-word' },
  emptyState: {
    borderRadius: 24,
    border: '1px dashed rgba(148,163,184,0.24)',
    background: 'rgba(15,23,42,0.58)',
    padding: '44px 24px',
    textAlign: 'center',
    color: '#94a3b8',
  },
}

const normalizeKey = (value) => String(value || '').trim().toLowerCase()

const money = (value) =>
  new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: 2,
  }).format(Number(value) || 0)

const formatDate = (value) => {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return new Intl.DateTimeFormat('es-DO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
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

export default function UserSubscriptions() {
  const { user, loading: authLoading } = useAuth()
  const [plan, setPlan] = useState(null)
  const [latestPayment, setLatestPayment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)

  const userId = String(user?.id || '').trim()
  const garageId = String(user?.garage_id || user?.garageId || user?.user_metadata?.garage_id || '').trim()
  const displayName = user?.full_name || user?.name || user?.email || 'Usuario'
  const planStatus = normalizeKey(plan?.status)
  const canPay = planStatus === 'pendiente' || planStatus === 'vencido'

  const loadSubscription = async () => {
    if (!userId) {
      setPlan(null)
      setLatestPayment(null)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const payload = await apiGet(`/api/monthly-plans/user/${userId}`, { forceFresh: true })
      const nextPlan = payload?.data || null

      let nextLatestPayment = null
      if (nextPlan?.id) {
        const paymentRows = await listMonthlyPlanPayments({
          garageId,
          planIds: [nextPlan.id],
        })
        const latestMap = buildLatestPaymentMap(paymentRows)
        nextLatestPayment = latestMap[String(nextPlan.id).trim()] || null
      }

      setPlan(nextPlan)
      setLatestPayment(nextLatestPayment)
      setError('')
    } catch (err) {
      setError(err.message || 'No se pudo cargar tu mensualidad.')
      setPlan(null)
      setLatestPayment(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authLoading) return
    loadSubscription()
  }, [authLoading, userId, garageId])

  const handlePaymentSuccess = async ({ referenceNumber }) => {
    setSuccess(`Pago mensual registrado correctamente. Referencia ${referenceNumber}.`)
    setError('')
    await loadSubscription()
  }

  return (
    <div style={styles.page}>
      {error ? <div style={styles.feedbackError}>{error}</div> : null}
      {success ? <div style={styles.feedbackOk}>{success}</div> : null}

      <section style={styles.hero}>
        <article style={styles.heroCard}>
          <div style={styles.eyebrow}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>credit_card</span>
            Suscripcion mensual
          </div>
          <h1 style={styles.title}>Tu plan mensual, claro y listo para pagar.</h1>
          <p style={styles.subtitle}>
            Revisa el monto, la fecha de vencimiento y el ultimo pago registrado sin salir del panel.
          </p>

          <div style={styles.heroMeta}>
            <div style={styles.heroMetaCard}>
              <div style={styles.heroMetaLabel}>Titular</div>
              <div style={styles.heroMetaValue}>{displayName}</div>
            </div>
            <div style={styles.heroMetaCard}>
              <div style={styles.heroMetaLabel}>Estado actual</div>
              <div style={styles.heroMetaValue}>{loading ? 'Cargando...' : plan?.status || 'Sin plan'}</div>
            </div>
          </div>
        </article>

        <aside style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Proximo paso</div>
          <div style={styles.summaryValue}>
            {loading ? '...' : canPay ? 'Pagar ahora' : planStatus === 'pagado' ? 'Todo al dia' : 'Sin plan'}
          </div>
          <p style={styles.summaryHint}>
            {loading
              ? 'Estamos consultando tu informacion.'
              : canPay
                ? 'Tu mensualidad esta lista para procesarse desde este mismo modulo.'
                : planStatus === 'pagado'
                  ? 'Tu ultimo plan aparece como pagado. Aqui mismo veras la referencia registrada.'
                  : 'Todavia no tienes una mensualidad activa asignada en este garage.'}
          </p>

          {canPay ? (
            <button type="button" style={styles.primaryButton} onClick={() => setIsPaymentOpen(true)}>
              Pagar ahora
            </button>
          ) : (
            <button type="button" style={styles.mutedButton} disabled>
              {planStatus === 'pagado' ? 'Pago aplicado' : 'Sin acciones disponibles'}
            </button>
          )}
        </aside>
      </section>

      {loading ? (
        <div style={styles.emptyState}>Cargando tu mensualidad...</div>
      ) : !plan ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 8 }}>No tienes un plan mensual activo</div>
          <div>Pide a la administracion del garage que te asigne una mensualidad para poder verla y pagarla aqui.</div>
        </div>
      ) : (
        <section style={styles.contentGrid}>
          <article style={styles.panel}>
            <div style={styles.panelHead}>
              <h2 style={styles.panelTitle}>Resumen del plan</h2>
              <p style={styles.panelSub}>Estos son los datos principales de tu mensualidad actual dentro del garage.</p>
            </div>
            <div style={styles.panelBody}>
              <div style={styles.detailsGrid}>
                <div style={styles.detailCard}>
                  <div style={styles.detailLabel}>Monto mensual</div>
                  <div style={styles.detailValue}>{money(plan.amount)}</div>
                  <div style={styles.detailHint}>Cobro fijo del periodo actual.</div>
                </div>
                <div style={styles.detailCard}>
                  <div style={styles.detailLabel}>Vencimiento</div>
                  <div style={styles.detailValue}>{formatDate(plan.due_date)}</div>
                  <div style={styles.detailHint}>Fecha limite para pagar esta mensualidad.</div>
                </div>
                <div style={styles.detailCard}>
                  <div style={styles.detailLabel}>Estado</div>
                  <div style={{ marginBottom: 8 }}>
                    <span style={styles.statusBadge(planStatus || 'pendiente')}>{plan.status || 'pendiente'}</span>
                  </div>
                  <div style={styles.detailHint}>
                    {planStatus === 'vencido'
                      ? `${plan.days_overdue || 0} dias de atraso registrados.`
                      : planStatus === 'pagado'
                        ? 'El sistema ya tiene este periodo como cubierto.'
                        : 'Pendiente de pago en este periodo.'}
                  </div>
                </div>
                <div style={styles.detailCard}>
                  <div style={styles.detailLabel}>Plan ID</div>
                  <div style={{ ...styles.detailValue, fontSize: 15, wordBreak: 'break-word' }}>{plan.id || '--'}</div>
                  <div style={styles.detailHint}>Identificador usado para registrar el pago.</div>
                </div>
              </div>
            </div>
          </article>

          <aside style={styles.panel}>
            <div style={styles.panelHead}>
              <h2 style={styles.panelTitle}>Ultimo pago</h2>
              <p style={styles.panelSub}>Si ya existe una referencia registrada, la veras aqui junto al metodo utilizado.</p>
            </div>
            <div style={styles.panelBody}>
              {latestPayment ? (
                <div style={styles.paymentCard}>
                  <div style={styles.paymentTitle}>{money(latestPayment.amount)}</div>
                  <div style={styles.paymentRef}>{latestPayment.reference || '--'}</div>
                  <div style={styles.paymentMeta}>Metodo: {latestPayment.method || '--'}</div>
                  <div style={styles.paymentMeta}>Estado: {latestPayment.status || '--'}</div>
                  <div style={styles.paymentMeta}>Fecha: {formatDateTime(latestPayment.paid_at || latestPayment.created_at)}</div>
                </div>
              ) : (
                <div style={styles.emptyState}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Aun no hay pagos registrados</div>
                  <div>Cuando completes tu mensualidad, la referencia y el metodo apareceran aqui.</div>
                </div>
              )}
            </div>
          </aside>
        </section>
      )}

      {plan && isPaymentOpen ? (
        <Suspense fallback={null}>
          <PaymentModal
            isOpen={isPaymentOpen}
            onClose={() => setIsPaymentOpen(false)}
            garageId={garageId}
            onPaymentSuccess={handlePaymentSuccess}
            planData={{
              cliente: plan.user_name || displayName,
              monto: plan.amount || 0,
              vencimiento: plan.due_date || '',
              planId: plan.id,
              userId: plan.user_id || userId,
              status: plan.status,
            }}
          />
        </Suspense>
      ) : null}
    </div>
  )
}
