import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../hooks/useAuth'
import { getDefaultRouteForRole } from '../lib/roles'
import './auth.css'

function getRegisterErrorMessage(error) {
  const rawMessage = error instanceof Error ? error.message : String(error || '')
  const message = rawMessage.trim()
  const lowerMessage = message.toLowerCase()

  if (lowerMessage.includes('codigo') && lowerMessage.includes('garajes')) {
    return 'No se pudo crear el garaje porque faltaba su codigo interno. Intenta registrarte otra vez.'
  }

  if (lowerMessage.includes('violates not-null constraint') || lowerMessage.includes('not-null')) {
    return 'Faltan datos obligatorios para completar el registro. Revisa el formulario e intenta nuevamente.'
  }

  if (message.length > 180 || message.startsWith('{')) {
    return 'No se pudo completar el registro. Intenta nuevamente en unos segundos.'
  }

  return message || 'No se pudo registrar el usuario.'
}

export default function Register() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading, logout, register } = useAuth()
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    company_name: '',
    company_address: '',
    company_phone: '',
    parking_spaces_count: '20',
    password: '',
    confirm_password: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState(null)
  const [hint, setHint] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const panelRef = useRef(null)
  const forceAccess = new URLSearchParams(location.search).get('force') === '1'
  const PASSWORD_MIN = 6
  const PASSWORD_MAX = 8

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
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
  }, [form.email])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setHint(null)

    const {
      full_name: name,
      email,
      company_name,
      company_address,
      company_phone,
      parking_spaces_count,
      password,
      confirm_password,
    } = form

    if (!company_name.trim()) {
      setError('El nombre de la empresa es requerido.')
      setSubmitting(false)
      return
    }

    const spacesCount = Number(parking_spaces_count)
    if (!Number.isFinite(spacesCount) || spacesCount < 1) {
      setError('Indica al menos 1 cupo para el garaje.')
      setSubmitting(false)
      return
    }

    if (password !== confirm_password) {
      setError('Las contrasenas no coinciden.')
      setSubmitting(false)
      return
    }

    if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
      setError('La contrasena debe tener entre 6 y 8 caracteres.')
      setSubmitting(false)
      return
    }

    try {
      await register(email, password, name, {
        company_name,
        company_address,
        company_phone,
        parking_spaces_count: spacesCount,
      })
      setHint('Cuenta creada correctamente. Ahora inicia sesion.')
      window.setTimeout(() => {
        navigate(`/verify-otp?email=${encodeURIComponent(email)}`)
      }, 900)
    } catch (err) {
      setError(getRegisterErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    document.body.classList.add('auth-active')
    return () => {
      document.body.classList.remove('auth-active')
    }
  }, [])

  useEffect(() => {
    if (!forceAccess || !user) return
    logout().catch(() => null)
  }, [forceAccess, user, logout])

  useEffect(() => {
    if (!forceAccess && !loading && user) {
      navigate(getDefaultRouteForRole(user?.role), { replace: true })
    }
  }, [forceAccess, loading, user, navigate])

  return (
    <div className="auth-page">
      <section className="auth-screen">
        <div className="auth-panel auth-panel--register auth-fade-in" ref={panelRef} onMouseMove={handleMouseMove}>
          <h1>Registro</h1>
          {hint && <p className="auth-alert success">{hint}</p>}
          {error && (
            <p className="auth-alert error" role="alert">
              {error}
            </p>
          )}
          <form onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="reg-name">Nombre completo</label>
              <div className="auth-input-icon">
                <span className="material-symbols-outlined">person</span>
                <input
                  id="reg-name"
                  name="full_name"
                  type="text"
                  placeholder="Tu nombre completo"
                  value={form.full_name}
                  onChange={(event) => setForm({ ...form, full_name: event.target.value })}
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="reg-email">Gmail</label>
              <div
                className={`auth-input-icon ${emailValid === false ? 'invalid' : ''} ${
                  emailValid ? 'valid' : ''
                }`}
              >
                <span className="material-symbols-outlined">mail</span>
                <input
                  id="reg-email"
                  name="email"
                  type="email"
                  placeholder="tuusuario@gmail.com"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="reg-company">Empresa / garaje</label>
              <div className="auth-input-icon">
                <span className="material-symbols-outlined">apartment</span>
                <input
                  id="reg-company"
                  name="company_name"
                  type="text"
                  placeholder="Nombre de tu empresa"
                  value={form.company_name}
                  onChange={(event) => setForm({ ...form, company_name: event.target.value })}
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="reg-company-address">Direccion</label>
              <div className="auth-input-icon">
                <span className="material-symbols-outlined">location_on</span>
                <input
                  id="reg-company-address"
                  name="company_address"
                  type="text"
                  placeholder="Direccion del garaje"
                  value={form.company_address}
                  onChange={(event) => setForm({ ...form, company_address: event.target.value })}
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="reg-company-phone">Telefono de empresa</label>
              <div className="auth-input-icon">
                <span className="material-symbols-outlined">call</span>
                <input
                  id="reg-company-phone"
                  name="company_phone"
                  type="tel"
                  placeholder="Telefono del negocio"
                  value={form.company_phone}
                  onChange={(event) => setForm({ ...form, company_phone: event.target.value })}
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="reg-spaces-count">Cupos iniciales</label>
              <div className="auth-input-icon">
                <span className="material-symbols-outlined">local_parking</span>
                <input
                  id="reg-spaces-count"
                  name="parking_spaces_count"
                  type="number"
                  min="1"
                  max="300"
                  placeholder="20"
                  value={form.parking_spaces_count}
                  onChange={(event) => setForm({ ...form, parking_spaces_count: event.target.value })}
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="reg-password">Password</label>
              <div className="auth-input-icon">
                <span className="material-symbols-outlined">lock</span>
                <input
                  id="reg-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="De 6 a 8 caracteres"
                  minLength={PASSWORD_MIN}
                  maxLength={PASSWORD_MAX}
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
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

            <div className="auth-field">
              <label htmlFor="reg-confirm">Confirmar password</label>
              <div className="auth-input-icon">
                <span className="material-symbols-outlined">lock</span>
                <input
                  id="reg-confirm"
                  name="confirm_password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Repite tu password"
                  minLength={PASSWORD_MIN}
                  maxLength={PASSWORD_MAX}
                  value={form.confirm_password}
                  onChange={(event) => setForm({ ...form, confirm_password: event.target.value })}
                  required
                />
                <button
                  type="button"
                  className="auth-visibility-btn"
                  onClick={() => setShowConfirmPassword((current) => !current)}
                  aria-label={showConfirmPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                >
                  <span className="material-symbols-outlined">
                    {showConfirmPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {form.password &&
              form.confirm_password &&
              form.password !== form.confirm_password && (
                <p className="auth-inline error">Las contrasenas no coinciden.</p>
              )}

            <button className="auth-btn auth-btn-primary" type="submit" disabled={submitting}>
              {submitting ? (
                <span className="auth-btn-loading">
                  <span className="auth-spinner" aria-hidden="true" />
                  Registrando...
                </span>
              ) : (
                'Registrarme'
              )}
            </button>

            <button
              className="auth-btn auth-btn-ghost"
              type="button"
              onClick={() => navigate('/login?force=1')}
            >
              Ya tengo cuenta
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}

