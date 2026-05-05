import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'
import { getDefaultRouteForRole } from '../lib/roles'
import './auth.css'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_MIN = 6
const PASSWORD_MAX = 8

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const authMessage = location.state?.authMessage || null
  const [status] = useState(() => {
    if (authMessage) return authMessage
    return new URLSearchParams(location.search).get('verified') === '1'
      ? 'Cuenta verificada correctamente. Ahora inicia sesion.'
      : null
  })
  const [submitting, setSubmitting] = useState(false)
  const panelRef = useRef(null)
  const redirectTo = location.state?.from?.pathname
  const handleMouseMove = (event) => {
    if (!panelRef.current) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    panelRef.current.style.setProperty('--mouse-x', `${x}px`)
    panelRef.current.style.setProperty('--mouse-y', `${y}px`)
  }

  const emailValid = useMemo(() => {
    if (!form.email) return null
    return EMAIL_REGEX.test(form.email)
  }, [form.email])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    if (!form.email || !form.password) {
      setError('Debes completar email y password.')
      setSubmitting(false)
      return
    }

    if (form.password.length < PASSWORD_MIN || form.password.length > PASSWORD_MAX) {
      setError('La contrasena debe tener entre 6 y 8 caracteres.')
      setSubmitting(false)
      return
    }

    try {
      const result = await login(form.email, form.password)
      const nextRoute = redirectTo || getDefaultRouteForRole(result?.user?.role)
      navigate(nextRoute, { replace: true })
    } catch (err) {
      setError(err.message || 'Credenciales incorrectas.')
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    const email = new URLSearchParams(location.search).get('email')
    if (email) {
      setForm((current) => ({ ...current, email }))
    }
  }, [location.search])

  useEffect(() => {
    document.body.classList.add('auth-active')
    return () => {
      document.body.classList.remove('auth-active')
    }
  }, [])


  return (
    <div className="auth-page">
      <section className="auth-screen">
        <div className="auth-panel auth-fade-in" ref={panelRef} onMouseMove={handleMouseMove}>
          <h1>Iniciar sesion</h1>
          {status && <p className="auth-alert success">{status}</p>}
          {error && (
            <p className="auth-alert error" role="alert">
              {error}
            </p>
          )}
          <form onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="login-email">Gmail</label>
              <div className={`auth-input-icon ${emailValid === false ? 'invalid' : ''} ${emailValid ? 'valid' : ''}`}>
                <span className="material-symbols-outlined">mail</span>
                <input
                  id="login-email"
                  type="email"
                  name="email"
                  placeholder="tuusuario@gmail.com"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="login-password">Password</label>
              <div className="auth-input-icon">
                <span className="material-symbols-outlined">lock</span>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="De 6 a 8 caracteres"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  minLength={PASSWORD_MIN}
                  maxLength={PASSWORD_MAX}
                  required
                />
                <button
                  type="button"
                  className="auth-visibility-btn"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                >
                  <span className="material-symbols-outlined">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <button className="auth-btn auth-btn-primary" type="submit" disabled={submitting}>
              {submitting ? (
                <span className="auth-btn-loading">
                  <span className="auth-spinner" aria-hidden="true" />
                  Iniciando sesion...
                </span>
              ) : (
                'Iniciar sesion'
              )}
            </button>
            <button type="button" className="auth-btn auth-btn-ghost" onClick={() => navigate('/register?force=1')}>
              Crear cuenta
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}
