import { useEffect, useState } from 'react'

import { apiGet } from '../lib/api'

const formatDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('es-DO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const formatDevice = (userAgent) => {
  if (!userAgent) return 'No disponible'

  const agent = userAgent.toLowerCase()
  if (agent.includes('android')) return 'Android'
  if (agent.includes('iphone') || agent.includes('ipad') || agent.includes('ios')) return 'iPhone / iPad'
  if (agent.includes('windows')) return 'Windows'
  if (agent.includes('mac os') || agent.includes('macintosh')) return 'macOS'
  if (agent.includes('linux')) return 'Linux'
  return userAgent
}

export default function LoginSessions() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadSessions = async () => {
    setLoading(true)
    setError(null)

    try {
      const payload = await apiGet('/api/auth/login-sessions')
      setSessions(Array.isArray(payload?.data) ? payload.data : [])
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las sesiones de acceso.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSessions()
  }, [])

  return (
    <div className="module-page">
      <header className="module-header">
        <div>
          <h1>Sesiones de acceso</h1>
          <p>Consulta cada inicio de sesion registrado en SmartPark.</p>
        </div>
      </header>

      {error && <div className="module-feedback error">{error}</div>}

      <section className="module-card login-sessions-card">
        <div className="login-sessions-head">
          <span>Email</span>
          <span>IP</span>
          <span>Dispositivo</span>
          <span>Fecha</span>
        </div>

        {loading && (
          <div className="module-empty">
            <div className="skeleton skeleton-row" />
            <div className="skeleton skeleton-row" />
            <div className="skeleton skeleton-row" />
          </div>
        )}

        {!loading && sessions.length === 0 && (
          <div className="module-empty">No hay sesiones registradas.</div>
        )}

        {!loading &&
          sessions.map((item) => (
            <div key={item.id} className="login-sessions-row">
              <span>{item.email || '-'}</span>
              <span className="mono">{item.ip_address || '-'}</span>
              <span title={item.user_agent || ''}>{formatDevice(item.user_agent)}</span>
              <span>{formatDateTime(item.created_at)}</span>
            </div>
          ))}
      </section>
    </div>
  )
}

