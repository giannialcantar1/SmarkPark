import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { apiPost } from '../lib/api'
import './auth.css'

export default function Verify() {
  const navigate = useNavigate()
  const location = useLocation()
  const panelRef = useRef(null)
  const params = new URLSearchParams(location.search)
  const emailFromUrl = params.get('email') || ''
  const sent = params.get('sent') === '1'

  const [email, setEmail] = useState(emailFromUrl)
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(sent ? 'Te enviamos un código de verificación a tu correo.' : null)

  const handleMouseMove = (event) => {
    if (!panelRef.current) return
    const rect = event.currentTarget.getBoundingClientRect()
    panelRef.current.style.setProperty('--mouse-x', `${event.clientX - rect.left}px`)
    panelRef.current.style.setProperty('--mouse-y', `${event.clientY - rect.top}px`)
  }

  useEffect(() => {
    document.body.classList.add('auth-active')
    return () => {
      document.body.classList.remove('auth-active')
    }
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      await apiPost('/api/auth/verify', { email, token })
      navigate(`/login?force=1&verified=1&email=${encodeURIComponent(email)}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo verificar el código.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    setError(null)
    setSuccess(null)

    try {
      await apiPost('/api/auth/verify/resend', { email })
      setSuccess('Te reenviamos un nuevo código OTP.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo reenviar el código.')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-screen">
        <div className="auth-panel auth-panel--narrow auth-fade-in" ref={panelRef} onMouseMove={handleMouseMove}>
          <h1>Verificar Cuenta</h1>
          <p className="auth-alert success">
            Ingresa el código de verificación que enviamos a tu correo para activar tu cuenta.
          </p>
          {success && <p className="auth-alert success">{success}</p>}
          {error && (
            <p className="auth-alert error" role="alert">
              {error}
            </p>
          )}

          <form onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="verify-email">Correo electrónico</label>
              <div className="auth-input-icon">
                <span className="material-symbols-outlined">mail</span>
                <input
                  id="verify-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="tuusuario@gmail.com"
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="verify-token">Código OTP</label>
              <div className="auth-input-icon">
                <span className="material-symbols-outlined">password</span>
                <input
                  id="verify-token"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={token}
                  onChange={(event) => setToken(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  required
                />
              </div>
            </div>

            <button className="auth-btn auth-btn-primary" type="submit" disabled={loading}>
              {loading ? (
                <span className="auth-btn-loading">
                  <span className="auth-spinner" aria-hidden="true" />
                  Verificando...
                </span>
              ) : (
                'Verificar código'
              )}
            </button>

            <button className="auth-btn auth-btn-ghost" type="button" onClick={handleResend} disabled={resending}>
              {resending ? 'Reenviando...' : 'Reenviar código'}
            </button>

            <button className="auth-btn auth-btn-ghost" type="button" onClick={() => navigate('/login?force=1')}>
              Volver al login
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}

