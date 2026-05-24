import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import {
  getStoredUser,
  listPublicGarages,
  login as loginRequest,
  register as registerRequest,
  registerVisitor,
  setStoredAuth,
} from '../services/api'
import { getDefaultRouteForRole } from '../lib/roles'
import './auth.css'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_MIN = 6

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [activeTab, setActiveTab] = useState('login')
  const [form, setForm] = useState({ email: '', password: '' })
  const [registerForm, setRegisterForm] = useState({
    full_name: '',
    email: '',
    password: '',
    confirm_password: '',
    company_name: '',
    company_phone: '',
    parking_spaces_count: '20',
  })
  const [visitorForm, setVisitorForm] = useState({
    full_name: '',
    email: '',
    password: '',
    confirm_password: '',
    garage_id: '',
  })
  const [garages, setGarages] = useState([])
  const [garagesLoading, setGaragesLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showRegisterPassword, setShowRegisterPassword] = useState(false)
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false)
  const [showVisitorPassword, setShowVisitorPassword] = useState(false)
  const [showVisitorConfirmPassword, setShowVisitorConfirmPassword] = useState(false)
  const [error, setError] = useState(null)
  const authMessage = location.state?.authMessage || null
  const [status, setStatus] = useState(() => {
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

  const registerEmailValid = useMemo(() => {
    if (!registerForm.email) return null
    return EMAIL_REGEX.test(registerForm.email)
  }, [registerForm.email])

  const visitorEmailValid = useMemo(() => {
    if (!visitorForm.email) return null
    return EMAIL_REGEX.test(visitorForm.email)
  }, [visitorForm.email])

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setError(null)
    if (tab !== 'login') {
      setStatus(null)
    }
  }

  const handleLoginSubmit = async (event) => {
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

  const handleVisitorRegisterSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setStatus(null)

    const {
      full_name: name,
      email,
      password,
      confirm_password,
      garage_id,
    } = visitorForm
    const normalizedEmail = email.trim().toLowerCase()

    if (!name.trim() || !normalizedEmail || !password || !confirm_password) {
      setError('Debes completar todos los campos del registro de usuario.')
      setSubmitting(false)
      return
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setError('Ingresa un email valido.')
      setSubmitting(false)
      return
    }

    if (password.length < PASSWORD_MIN) {
      setError('La contrasena debe tener al menos 6 caracteres.')
      setSubmitting(false)
      return
    }

    if (password !== confirm_password) {
      setError('Las contrasenas no coinciden.')
      setSubmitting(false)
      return
    }

    if (!garage_id) {
      setError('Debes seleccionar un garage.')
      setSubmitting(false)
      return
    }

    try {
      await registerVisitor({
        email: normalizedEmail,
        password,
        name: name.trim(),
        garage_id,
      })
      setStatus('Usuario registrado correctamente. Verifica el codigo enviado a tu correo.')
      navigate(`/verify-otp?email=${encodeURIComponent(normalizedEmail)}`)
    } catch (err) {
      setError(err.message || 'No se pudo completar el registro de usuario.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRegisterSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setStatus(null)

    const {
      full_name: name,
      email,
      password,
      confirm_password,
      company_name,
      company_phone,
      parking_spaces_count,
    } = registerForm
    const normalizedEmail = email.trim().toLowerCase()
    const spacesCount = Number(parking_spaces_count)

    if (!name.trim() || !normalizedEmail || !password || !confirm_password || !company_name.trim() || !company_phone.trim()) {
      setError('Debes completar todos los campos del registro.')
      setSubmitting(false)
      return
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setError('Ingresa un email valido.')
      setSubmitting(false)
      return
    }

    if (password.length < PASSWORD_MIN) {
      setError('La contrasena debe tener al menos 6 caracteres.')
      setSubmitting(false)
      return
    }

    if (password !== confirm_password) {
      setError('Las contrasenas no coinciden.')
      setSubmitting(false)
      return
    }

    if (!Number.isFinite(spacesCount) || spacesCount <= 0) {
      setError('Indica una cantidad valida de espacios de parqueo.')
      setSubmitting(false)
      return
    }

    try {
      await registerRequest(normalizedEmail, password, name.trim(), {
        company_name: company_name.trim(),
        company_phone: company_phone.trim(),
        parking_spaces_count: spacesCount,
      })
      setStatus('Cuenta registrada correctamente. Verifica el codigo enviado a tu correo.')
      navigate(`/verify-otp?email=${encodeURIComponent(normalizedEmail)}`)
    } catch (err) {
      setError(err.message || 'No se pudo completar el registro.')
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
    if (activeTab !== 'visitor' || garages.length) return

    let cancelled = false
    setGaragesLoading(true)
    setError(null)

    listPublicGarages()
      .then((rows) => {
        if (!cancelled) {
          setGarages(rows)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'No se pudieron cargar los garages disponibles.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setGaragesLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [activeTab, garages.length])

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
        <div
          className={`auth-panel auth-fade-in${activeTab !== 'login' ? ' auth-panel--register auth-panel--login-register' : ''}`}
          ref={panelRef}
          onMouseMove={handleMouseMove}
        >
          <h1>
            {activeTab === 'login' && 'Iniciar sesion'}
            {activeTab === 'register' && 'Registro empresa'}
            {activeTab === 'visitor' && 'Registro usuario'}
          </h1>
          <div className="auth-tabs" role="tablist" aria-label="Opciones de acceso">
            <button
              type="button"
              className={`auth-tab${activeTab === 'login' ? ' active' : ''}`}
              onClick={() => handleTabChange('login')}
              role="tab"
              aria-selected={activeTab === 'login'}
            >
              Iniciar sesion
            </button>
            <button
              type="button"
              className={`auth-tab${activeTab === 'register' ? ' active' : ''}`}
              onClick={() => handleTabChange('register')}
              role="tab"
              aria-selected={activeTab === 'register'}
            >
              Registrarse como empresa
            </button>
            <button
              type="button"
              className={`auth-tab${activeTab === 'visitor' ? ' active' : ''}`}
              onClick={() => handleTabChange('visitor')}
              role="tab"
              aria-selected={activeTab === 'visitor'}
            >
              Registrarse como usuario
            </button>
          </div>
          {status && <p className="auth-alert success">{status}</p>}
          {error && (
            <p className="auth-alert error" role="alert">
              {error}
            </p>
          )}
          {activeTab === 'login' && (
            <form onSubmit={handleLoginSubmit}>
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
              <button type="button" className="auth-btn auth-btn-ghost" onClick={() => navigate('/staff-register')}>
                Registro de personal
              </button>
            </form>
          )}
          {activeTab === 'register' && (
            <form onSubmit={handleRegisterSubmit}>
              <div className="auth-field">
                <label htmlFor="reg-name">Nombre completo</label>
                <div className="auth-input-icon">
                  <span className="material-symbols-outlined">person</span>
                  <input
                    id="reg-name"
                    name="full_name"
                    type="text"
                    placeholder="Tu nombre completo"
                    value={registerForm.full_name}
                    onChange={(event) => setRegisterForm({ ...registerForm, full_name: event.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="auth-field">
                <label htmlFor="reg-email">Gmail</label>
                <div className={`auth-input-icon ${registerEmailValid === false ? 'invalid' : ''} ${registerEmailValid ? 'valid' : ''}`}>
                  <span className="material-symbols-outlined">mail</span>
                  <input
                    id="reg-email"
                    name="email"
                    type="email"
                    placeholder="tuusuario@gmail.com"
                    value={registerForm.email}
                    onChange={(event) => setRegisterForm({ ...registerForm, email: event.target.value })}
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
                    type={showRegisterPassword ? 'text' : 'password'}
                    placeholder="Minimo 6 caracteres"
                    minLength={PASSWORD_MIN}
                    value={registerForm.password}
                    onChange={(event) => setRegisterForm({ ...registerForm, password: event.target.value })}
                    required
                  />
                  <button
                    type="button"
                    className="auth-visibility-btn"
                    onClick={() => setShowRegisterPassword((current) => !current)}
                    aria-label={showRegisterPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                  >
                    <span className="material-symbols-outlined">
                      {showRegisterPassword ? 'visibility_off' : 'visibility'}
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
                    type={showRegisterConfirmPassword ? 'text' : 'password'}
                    placeholder="Repite tu password"
                    minLength={PASSWORD_MIN}
                    value={registerForm.confirm_password}
                    onChange={(event) => setRegisterForm({ ...registerForm, confirm_password: event.target.value })}
                    required
                  />
                  <button
                    type="button"
                    className="auth-visibility-btn"
                    onClick={() => setShowRegisterConfirmPassword((current) => !current)}
                    aria-label={showRegisterConfirmPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                  >
                    <span className="material-symbols-outlined">
                      {showRegisterConfirmPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="auth-field">
                <label htmlFor="reg-company">Nombre de empresa</label>
                <div className="auth-input-icon">
                  <span className="material-symbols-outlined">apartment</span>
                  <input
                    id="reg-company"
                    name="company_name"
                    type="text"
                    placeholder="Nombre de tu empresa"
                    value={registerForm.company_name}
                    onChange={(event) => setRegisterForm({ ...registerForm, company_name: event.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="auth-field">
                <label htmlFor="reg-phone">Telefono</label>
                <div className="auth-input-icon">
                  <span className="material-symbols-outlined">call</span>
                  <input
                    id="reg-phone"
                    name="company_phone"
                    type="tel"
                    inputMode="tel"
                    placeholder="Telefono del negocio"
                    value={registerForm.company_phone}
                    onChange={(event) => setRegisterForm({ ...registerForm, company_phone: event.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="auth-field">
                <label htmlFor="reg-spaces">Espacios de parqueo</label>
                <div className="auth-input-icon">
                  <span className="material-symbols-outlined">local_parking</span>
                  <input
                    id="reg-spaces"
                    name="parking_spaces_count"
                    type="number"
                    min="1"
                    placeholder="Ej: 20"
                    value={registerForm.parking_spaces_count}
                    onChange={(event) => setRegisterForm({ ...registerForm, parking_spaces_count: event.target.value })}
                    required
                  />
                </div>
              </div>

              {registerForm.password &&
                registerForm.confirm_password &&
                registerForm.password !== registerForm.confirm_password && (
                  <p className="auth-inline error">Las contrasenas no coinciden.</p>
                )}

              <button className="auth-btn auth-btn-primary" type="submit" disabled={submitting}>
                {submitting ? (
                  <span className="auth-btn-loading">
                    <span className="auth-spinner" aria-hidden="true" />
                    Registrando...
                  </span>
                ) : (
                  'Registrarse'
                )}
              </button>
            </form>
          )}
          {activeTab === 'visitor' && (
            <form onSubmit={handleVisitorRegisterSubmit}>
              <div className="auth-field">
                <label htmlFor="visitor-name">Nombre completo</label>
                <div className="auth-input-icon">
                  <span className="material-symbols-outlined">person</span>
                  <input
                    id="visitor-name"
                    name="full_name"
                    type="text"
                    placeholder="Tu nombre completo"
                    value={visitorForm.full_name}
                    onChange={(event) => setVisitorForm({ ...visitorForm, full_name: event.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="auth-field">
                <label htmlFor="visitor-email">Gmail</label>
                <div className={`auth-input-icon ${visitorEmailValid === false ? 'invalid' : ''} ${visitorEmailValid ? 'valid' : ''}`}>
                  <span className="material-symbols-outlined">mail</span>
                  <input
                    id="visitor-email"
                    name="email"
                    type="email"
                    placeholder="tuusuario@gmail.com"
                    value={visitorForm.email}
                    onChange={(event) => setVisitorForm({ ...visitorForm, email: event.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="auth-field">
                <label htmlFor="visitor-password">Password</label>
                <div className="auth-input-icon">
                  <span className="material-symbols-outlined">lock</span>
                  <input
                    id="visitor-password"
                    name="password"
                    type={showVisitorPassword ? 'text' : 'password'}
                    placeholder="Minimo 6 caracteres"
                    minLength={PASSWORD_MIN}
                    value={visitorForm.password}
                    onChange={(event) => setVisitorForm({ ...visitorForm, password: event.target.value })}
                    required
                  />
                  <button
                    type="button"
                    className="auth-visibility-btn"
                    onClick={() => setShowVisitorPassword((current) => !current)}
                    aria-label={showVisitorPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                  >
                    <span className="material-symbols-outlined">
                      {showVisitorPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="auth-field">
                <label htmlFor="visitor-confirm">Confirmar password</label>
                <div className="auth-input-icon">
                  <span className="material-symbols-outlined">lock</span>
                  <input
                    id="visitor-confirm"
                    name="confirm_password"
                    type={showVisitorConfirmPassword ? 'text' : 'password'}
                    placeholder="Repite tu password"
                    minLength={PASSWORD_MIN}
                    value={visitorForm.confirm_password}
                    onChange={(event) => setVisitorForm({ ...visitorForm, confirm_password: event.target.value })}
                    required
                  />
                  <button
                    type="button"
                    className="auth-visibility-btn"
                    onClick={() => setShowVisitorConfirmPassword((current) => !current)}
                    aria-label={showVisitorConfirmPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                  >
                    <span className="material-symbols-outlined">
                      {showVisitorConfirmPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="auth-field">
                <label htmlFor="visitor-garage">Garage</label>
                <div className="auth-input-icon">
                  <span className="material-symbols-outlined">garage</span>
                  <select
                    id="visitor-garage"
                    name="garage_id"
                    value={visitorForm.garage_id}
                    onChange={(event) => setVisitorForm({ ...visitorForm, garage_id: event.target.value })}
                    disabled={garagesLoading}
                    required
                  >
                    <option value="">
                      {garagesLoading ? 'Cargando garages...' : 'Seleccione un garage'}
                    </option>
                    {garages.map((garage) => (
                      <option key={garage.garage_id || garage.id} value={garage.garage_id || garage.id}>
                        {garage.name || garage.nombre || 'Garage sin nombre'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {visitorForm.password &&
                visitorForm.confirm_password &&
                visitorForm.password !== visitorForm.confirm_password && (
                  <p className="auth-inline error">Las contrasenas no coinciden.</p>
                )}

              <button className="auth-btn auth-btn-primary" type="submit" disabled={submitting}>
                {submitting ? (
                  <span className="auth-btn-loading">
                    <span className="auth-spinner" aria-hidden="true" />
                    Registrando...
                  </span>
                ) : (
                  'Registrarse como usuario'
                )}
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  )
}
