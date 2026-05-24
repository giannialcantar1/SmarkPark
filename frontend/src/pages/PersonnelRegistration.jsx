import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'
import { apiGet, apiPost } from '../lib/api'
import { ROLES, normalizeRole } from '../lib/roles'
import { registerStaff } from '../services/api'

const ROLE_OPTIONS = [
  { value: ROLES.ADMIN, label: 'Admin' },
  { value: ROLES.OPERADOR, label: 'Operador' },
  { value: ROLES.SEGURIDAD, label: 'Seguridad' },
  { value: ROLES.MANTENIMIENTO, label: 'Mantenimiento' },
  { value: ROLES.PORTERO, label: 'Portero' },
]

const APPROVAL_ROLE_OPTIONS = [
  ...ROLE_OPTIONS,
  { value: ROLES.USUARIO, label: 'Usuario' },
]

const styles = {
  page: { width: '100%', maxWidth: 1240, margin: '0 auto', color: '#e5eefb' },
  publicPage: {
    minHeight: '100vh',
    background: 'radial-gradient(circle at top, rgba(14,165,233,0.16), rgba(2,6,23,0.96) 50%)',
    padding: '48px 20px',
  },
  hero: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 18,
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    marginBottom: 22,
  },
  title: { margin: 0, color: '#fff', fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 800 },
  subtitle: { margin: '8px 0 0', color: '#94a3b8', fontSize: 15, maxWidth: 760, lineHeight: 1.55 },
  badge: {
    borderRadius: 999,
    padding: '9px 14px',
    background: 'rgba(56,189,248,0.12)',
    border: '1px solid rgba(56,189,248,0.26)',
    color: '#bae6fd',
    fontWeight: 800,
    fontSize: 13,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
  },
  grid: { display: 'grid', gridTemplateColumns: 'minmax(320px, 460px) minmax(0, 1fr)', gap: 18, alignItems: 'start' },
  card: {
    borderRadius: 20,
    border: '1px solid rgba(148,163,184,0.16)',
    background: 'rgba(15,23,42,0.78)',
    overflow: 'hidden',
    boxShadow: '0 22px 42px rgba(2,6,23,0.28)',
  },
  cardHead: { padding: '18px 20px', borderBottom: '1px solid rgba(148,163,184,0.12)' },
  cardTitle: { margin: 0, color: '#fff', fontSize: 18, fontWeight: 800 },
  cardSub: { margin: '6px 0 0', color: '#94a3b8', fontSize: 13, lineHeight: 1.55 },
  cardBody: { padding: 20 },
  form: { display: 'grid', gap: 14 },
  label: { display: 'grid', gap: 8, color: '#cbd5e1', fontSize: 13, fontWeight: 700 },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: 12,
    border: '1px solid rgba(148,163,184,0.18)',
    background: 'rgba(2,6,23,0.42)',
    color: '#fff',
    padding: '11px 13px',
    fontFamily: 'inherit',
    outline: 'none',
  },
  button: (variant = 'primary', disabled = false) => ({
    borderRadius: 12,
    border: variant === 'ghost' ? '1px solid rgba(148,163,184,0.18)' : 'none',
    background: disabled
      ? 'rgba(56,189,248,0.25)'
      : variant === 'ghost'
        ? 'rgba(15,23,42,0.6)'
        : 'linear-gradient(135deg, #0284c7, #38bdf8)',
    color: variant === 'ghost' ? '#cbd5e1' : '#04111f',
    padding: '11px 16px',
    fontWeight: 800,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
  }),
  secondaryButtonRow: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  feedbackOk: {
    borderRadius: 14,
    padding: '12px 16px',
    marginBottom: 16,
    background: 'rgba(22,101,52,0.26)',
    border: '1px solid rgba(74,222,128,0.28)',
    color: '#bbf7d0',
    fontWeight: 700,
  },
  feedbackError: {
    borderRadius: 14,
    padding: '12px 16px',
    marginBottom: 16,
    background: 'rgba(127,29,29,0.28)',
    border: '1px solid rgba(248,113,113,0.28)',
    color: '#fecaca',
    fontWeight: 700,
  },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 18 },
  stat: { borderRadius: 18, border: '1px solid rgba(148,163,184,0.16)', background: 'rgba(15,23,42,0.78)', padding: 18 },
  statLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 8,
  },
  statValue: { color: '#fff', fontSize: 30, fontWeight: 800 },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left',
    padding: '13px 18px',
    color: '#94a3b8',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    borderBottom: '1px solid rgba(148,163,184,0.12)',
  },
  td: { padding: '14px 18px', color: '#fff', fontSize: 13, borderTop: '1px solid rgba(148,163,184,0.08)' },
  roleSelect: {
    minWidth: 150,
    borderRadius: 10,
    border: '1px solid rgba(148,163,184,0.2)',
    background: 'rgba(2,6,23,0.52)',
    color: '#fff',
    padding: '9px 11px',
    fontFamily: 'inherit',
    fontWeight: 700,
    outline: 'none',
  },
  status: (status) => ({
    display: 'inline-flex',
    padding: '6px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    background: status === 'aprobado' ? 'rgba(22,101,52,0.26)' : 'rgba(180,83,9,0.24)',
    color: status === 'aprobado' ? '#bbf7d0' : '#fde68a',
    border: `1px solid ${status === 'aprobado' ? 'rgba(74,222,128,0.28)' : 'rgba(245,158,11,0.28)'}`,
  }),
  empty: { padding: 30, color: '#94a3b8', textAlign: 'center' },
}

function formatDate(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return new Intl.DateTimeFormat('es-DO', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

export default function PersonnelRegistration({ mode = 'public' }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = normalizeRole(user?.role || user?.user_metadata?.role) === ROLES.ADMIN
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: ROLES.OPERADOR,
    garageCode: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [loadingPending, setLoadingPending] = useState(false)
  const [pendingRequests, setPendingRequests] = useState([])
  const [approvalRoles, setApprovalRoles] = useState({})
  const [approvingId, setApprovingId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadPendingRequests = async () => {
    if (!isAdmin) return
    setLoadingPending(true)
    try {
      const payload = await apiGet('/api/users/personnel/pending', { forceFresh: true })
      const requests = Array.isArray(payload?.data) ? payload.data : []
      setPendingRequests(requests)
      setApprovalRoles((current) => {
        const next = {}
        requests.forEach((requestItem) => {
          const requestId = String(requestItem.id)
          next[requestId] = current[requestId] || normalizeRole(requestItem.role) || ROLES.OPERADOR
        })
        return next
      })
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las solicitudes pendientes.')
    } finally {
      setLoadingPending(false)
    }
  }

  useEffect(() => {
    if (mode === 'admin' && isAdmin) {
      loadPendingRequests()
    }
  }, [mode, isAdmin])

  const stats = useMemo(() => ({
    pending: pendingRequests.length,
    admins: pendingRequests.filter((item) => item.role === ROLES.ADMIN).length,
    operations: pendingRequests.filter((item) => [ROLES.OPERADOR, ROLES.PORTERO, ROLES.SEGURIDAD].includes(item.role)).length,
  }), [pendingRequests])

  const handleChange = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const handleApprovalRoleChange = (requestId, role) => {
    setApprovalRoles((current) => ({ ...current, [String(requestId)]: role }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!form.name.trim() || !form.email.trim() || !form.password.trim() || !form.garageCode.trim()) {
      setError('Completa nombre, email, password y codigo de invitacion.')
      return
    }

    if (form.password !== form.confirmPassword) {
      setError('Las contrasenas no coinciden.')
      return
    }

    if (form.password.length < 6) {
      setError('La contrasena debe tener al menos 6 caracteres.')
      return
    }

    setSubmitting(true)
    try {
      await registerStaff({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        garage_code: form.garageCode.trim(),
      })
      setSuccess('Solicitud enviada. Tu cuenta quedo pendiente de aprobacion del administrador.')
      setForm({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: ROLES.OPERADOR,
        garageCode: '',
      })
    } catch (err) {
      setError(err.message || 'No se pudo registrar la solicitud del personal.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleApprove = async (requestId) => {
    const selectedRole = approvalRoles[String(requestId)] || ROLES.OPERADOR
    setApprovingId(String(requestId))
    setError('')
    setSuccess('')
    try {
      await apiPost(`/api/users/personnel/${requestId}/approve`, { role: selectedRole })
      setSuccess('Solicitud aprobada correctamente. El personal ya puede iniciar sesion.')
      await loadPendingRequests()
    } catch (err) {
      setError(err.message || 'No se pudo aprobar la solicitud.')
    } finally {
      setApprovingId('')
    }
  }

  const content = (
    <div style={styles.page}>
      <header style={styles.hero}>
        <div>
          <h1 style={styles.title}>Registro de Personal</h1>
          <p style={styles.subtitle}>
            Permite que operadores, seguridad y mantenimiento soliciten acceso al sistema. El registro queda pendiente
            hasta que un administrador lo apruebe. Solo necesitan el codigo de invitacion del garaje.
          </p>
        </div>
        <div style={styles.badge}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>badge</span>
          Staff onboarding
        </div>
      </header>

      {error && <div style={styles.feedbackError}>{error}</div>}
      {success && <div style={styles.feedbackOk}>{success}</div>}

      {mode === 'admin' && isAdmin && (
        <section style={styles.stats}>
          <article style={styles.stat}><div style={styles.statLabel}>Solicitudes pendientes</div><div style={styles.statValue}>{stats.pending}</div></article>
          <article style={styles.stat}><div style={styles.statLabel}>Admins solicitados</div><div style={styles.statValue}>{stats.admins}</div></article>
          <article style={styles.stat}><div style={styles.statLabel}>Operativos</div><div style={styles.statValue}>{stats.operations}</div></article>
        </section>
      )}

      <section style={styles.grid}>
        <div style={styles.card}>
          <div style={styles.cardHead}>
            <h2 style={styles.cardTitle}>Solicitud de registro</h2>
            <p style={styles.cardSub}>
              El personal crea su cuenta, elige su rol y queda pendiente de aprobacion. Usa el codigo de invitacion entregado por tu administrador.
            </p>
          </div>
          <div style={styles.cardBody}>
            <form style={styles.form} onSubmit={handleSubmit}>
              <label style={styles.label}>
                <span>Nombre completo</span>
                <input value={form.name} onChange={(event) => handleChange('name', event.target.value)} style={styles.input} placeholder="Nombre del empleado" />
              </label>
              <label style={styles.label}>
                <span>Email</span>
                <input type="email" value={form.email} onChange={(event) => handleChange('email', event.target.value)} style={styles.input} placeholder="empleado@empresa.com" />
              </label>
              <label style={styles.label}>
                <span>Rol</span>
                <select value={form.role} onChange={(event) => handleChange('role', event.target.value)} style={styles.input}>
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label style={styles.label}>
                <span>Codigo de invitacion del garaje</span>
                <input value={form.garageCode} onChange={(event) => handleChange('garageCode', event.target.value)} style={styles.input} placeholder="UUID del garage_id" />
              </label>
              <label style={styles.label}>
                <span>Contrasena</span>
                <input type="password" value={form.password} onChange={(event) => handleChange('password', event.target.value)} style={styles.input} placeholder="Minimo 6 caracteres" />
              </label>
              <label style={styles.label}>
                <span>Confirmar contrasena</span>
                <input type="password" value={form.confirmPassword} onChange={(event) => handleChange('confirmPassword', event.target.value)} style={styles.input} placeholder="Repite la contrasena" />
              </label>
              <button type="submit" style={styles.button('primary', submitting)} disabled={submitting}>
                {submitting ? 'Enviando solicitud...' : 'Registrar personal'}
              </button>
            </form>
            {mode === 'public' && (
              <div style={{ ...styles.secondaryButtonRow, marginTop: 14 }}>
                <button type="button" style={styles.button('ghost', false)} onClick={() => navigate('/login')}>
                  Ir al login
                </button>
                <button type="button" style={styles.button('ghost', false)} onClick={() => navigate('/')}>
                  Volver al inicio
                </button>
              </div>
            )}
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHead}>
            <h2 style={styles.cardTitle}>{mode === 'admin' && isAdmin ? 'Aprobar Personal' : 'Como funciona'}</h2>
            <p style={styles.cardSub}>
              {mode === 'admin' && isAdmin
                ? 'Revisa las solicitudes pendientes y aprueba al personal que ya deba tener acceso.'
                : 'Despues del registro, un administrador debe aprobar la cuenta antes del primer inicio de sesion.'}
            </p>
          </div>
          <div style={styles.tableWrap}>
            {mode === 'admin' && isAdmin ? (
              loadingPending ? (
                <div style={styles.empty}>Cargando solicitudes...</div>
              ) : pendingRequests.length === 0 ? (
                <div style={styles.empty}>No hay solicitudes pendientes por ahora.</div>
              ) : (
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Nombre</th>
                      <th style={styles.th}>Rol solicitado</th>
                      <th style={styles.th}>Rol a aprobar</th>
                      <th style={styles.th}>Email</th>
                      <th style={styles.th}>Solicitud</th>
                      <th style={styles.th}>Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRequests.map((requestItem) => {
                        const requestId = String(requestItem.id)
                        const selectedRole = approvalRoles[requestId] || normalizeRole(requestItem.role) || ROLES.OPERADOR
                        return (
                          <tr key={requestItem.id}>
                            <td style={styles.td}>{requestItem.name || '--'}</td>
                            <td style={styles.td}><span style={styles.status('pendiente_aprobacion')}>{requestItem.role}</span></td>
                            <td style={styles.td}>
                              <select
                                value={selectedRole}
                                onChange={(event) => handleApprovalRoleChange(requestItem.id, event.target.value)}
                                style={styles.roleSelect}
                                disabled={approvingId === requestId}
                              >
                                {APPROVAL_ROLE_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            </td>
                            <td style={styles.td}>{requestItem.email || '--'}</td>
                            <td style={styles.td}>{formatDate(requestItem.created_at)}</td>
                            <td style={styles.td}>
                              <button
                                type="button"
                                style={styles.button('ghost', approvingId === requestId)}
                                disabled={approvingId === requestId}
                                onClick={() => handleApprove(requestItem.id)}
                              >
                                {approvingId === requestId ? 'Aprobando...' : 'Aprobar'}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              )
            ) : (
              <div style={styles.cardBody}>
                <div style={{ color: '#cbd5e1', lineHeight: 1.7, fontSize: 14 }}>
                  1. El empleado crea su cuenta con email, contrasena, rol y codigo de invitacion.
                  <br />
                  Ese codigo corresponde al `garage_id` compartido por el administrador.
                  <br />
                  2. La solicitud se registra con estado pendiente de aprobacion.
                  <br />
                  3. Un administrador revisa y aprueba la cuenta desde el modulo interno.
                  <br />
                  4. Solo despues de aprobarse podra iniciar sesion y usar el sistema.
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )

  if (mode === 'public') {
    return <div style={styles.publicPage}>{content}</div>
  }

  return content
}
