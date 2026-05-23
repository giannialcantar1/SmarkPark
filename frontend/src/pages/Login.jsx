import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { getStoredUser, login as loginRequest, setStoredAuth } from '../services/api'
import { getDefaultRouteForRole } from '../lib/roles'
import './auth.css'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_MIN = 6

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
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
  const [decorReady, setDecorReady] = useState(false)
  const panelRef = useRef(null)
  const redirectTo = location.state?.from?.pathname
  const forceAccess = new URLSearchParams(location.search).get('force') === '1'
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

    if (form.password.length < PASSWORD_MIN) {
      setError('La contrasena debe tener al menos 6 caracteres.')
      setSubmitting(false)
      return
    }

    try {
      const result = await loginRequest(form.email, form.password)
      const token = String(result?.access_token || result?.token || '').trim()
      const refreshToken = String(result?.refresh_token || '').trim()
      const nextUser = result?.user || {
        id: result?.user_id || null,
        user_id: result?.user_id || null,
        email: result?.email || form.email,
        role: result?.role,
        garage_id: result?.garage_id,
      }

      if (token && nextUser) {
        setStoredAuth(token, nextUser)
      }

      if (token && refreshToken) {
        try {
          const { supabase } = await import('../lib/supabase')
          await supabase.auth.setSession({
            access_token: token,
            refresh_token: refreshToken,
          })
        } catch {
          // The backend session stored above is enough for API auth.
        }
      }

      if (token && nextUser) {
        setStoredAuth(token, nextUser)
      }

      const nextRoute = redirectTo || getDefaultRouteForRole(nextUser?.role, nextUser?.status || nextUser?.approval_status)
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
    if (forceAccess) return

    const storedUser = getStoredUser()
    if (!storedUser) return

    navigate(
      getDefaultRouteForRole(storedUser?.role, storedUser?.status || storedUser?.approval_status),
      { replace: true },
    )
  }, [forceAccess, navigate])

  useEffect(() => {
    document.body.classList.add('auth-active')
    return () => {
      document.body.classList.remove('auth-active')
    }
  }, [])

  useEffect(() => {
    let timeoutId = null
    let idleId = null

    const enableDecor = () => setDecorReady(true)

    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(enableDecor, { timeout: 900 })
    } else {
      timeoutId = window.setTimeout(enableDecor, 350)
    }

    return () => {
      if (idleId !== null && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId)
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [])


  return (
    <div className={`auth-page${decorReady ? ' auth-page--decor' : ''}`}>
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
                  placeholder="Minimo 6 caracteres"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  minLength={PASSWORD_MIN}
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
            <button type="button" className="auth-btn auth-btn-ghost" onClick={() => navigate('/staff-register')}>
              Registro de personal
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}
