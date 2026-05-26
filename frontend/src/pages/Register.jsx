import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { getDefaultRouteForRole } from '../lib/roles'
import { clearStoredAuth, getStoredUser, register as registerRequest } from '../services/api'
import './auth.css'

const RegisterMapModal = lazy(() => import('../components/RegisterMapModal'))

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

function getInvitationCode(payload) {
  return String(payload?.user?.garage_id || payload?.company?.garage_id || '').trim()
}

export default function Register() {
  const navigate = useNavigate()
  const location = useLocation()
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
  const [submittedOnce, setSubmittedOnce] = useState(false)
  const [addressConfirmed, setAddressConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [decorReady, setDecorReady] = useState(false)
  const [invitationModal, setInvitationModal] = useState({ open: false, code: '', email: '' })
  const [copiedInvitationCode, setCopiedInvitationCode] = useState(false)
  const [isMapOpen, setIsMapOpen] = useState(false)
  const panelRef = useRef(null)
  const copyResetRef = useRef(null)
  const forceAccess = new URLSearchParams(location.search).get('force') === '1'
  const PASSWORD_MIN = 6

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

  const companyPhoneValid = useMemo(() => {
    if (!form.company_phone) return null
    return /^[0-9]{10}$/.test(form.company_phone)
  }, [form.company_phone])

  const addressMissing = submittedOnce && !form.company_address.trim()

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmittedOnce(true)
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

    if (!company_address.trim()) {
      setError('Ingresa la dirección del garaje o selecciona una ubicación desde el mapa.')
      setSubmitting(false)
      return
    }

    if (!/^[0-9]{10}$/.test(company_phone)) {
      setError('El teléfono debe tener exactamente 10 dígitos')
      setSubmitting(false)
      return
    }

    const spacesCount = Number(parking_spaces_count)
    if (!Number.isFinite(spacesCount)) {
      setError('Indica una cantidad valida de cupos para el garaje.')
      setSubmitting(false)
      return
    }

    if (password !== confirm_password) {
      setError('Las contrasenas no coinciden.')
      setSubmitting(false)
      return
    }

    if (password.length < PASSWORD_MIN) {
      setError('La contrasena debe tener al menos 6 caracteres.')
      setSubmitting(false)
      return
    }

    try {
      const response = await registerRequest(email, password, name, {
        company_name,
        company_address,
        company_phone,
        parking_spaces_count: spacesCount,
      })
      const invitationCode = getInvitationCode(response)

      if (invitationCode) {
        setInvitationModal({ open: true, code: invitationCode, email })
        setCopiedInvitationCode(false)
        setHint(null)
      } else {
        setHint('Cuenta creada correctamente. Ahora verifica tu correo.')
        window.setTimeout(() => {
          navigate(`/verify-otp?email=${encodeURIComponent(email)}`)
        }, 900)
      }
    } catch (err) {
      setError(getRegisterErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleCopyInvitationCode = async () => {
    if (!invitationModal.code) return

    try {
      await navigator.clipboard.writeText(invitationModal.code)
      setCopiedInvitationCode(true)
      if (copyResetRef.current) {
        window.clearTimeout(copyResetRef.current)
      }
      copyResetRef.current = window.setTimeout(() => {
        setCopiedInvitationCode(false)
      }, 1800)
    } catch (err) {
      setError('No se pudo copiar el codigo. Copialo manualmente por favor.')
    }
  }

  const handleInvitationModalClose = () => {
    const nextEmail = invitationModal.email
    setInvitationModal({ open: false, code: '', email: '' })
    setCopiedInvitationCode(false)
    navigate(`/verify-otp?email=${encodeURIComponent(nextEmail)}`)
  }

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

  useEffect(() => (
    () => {
      if (copyResetRef.current) {
        window.clearTimeout(copyResetRef.current)
      }
    }
  ), [])

  useEffect(() => {
    const storedUser = getStoredUser()

    if (forceAccess) {
      if (!storedUser) return
      clearStoredAuth()
      import('../lib/supabase')
        .then(({ supabase }) => supabase.auth.signOut())
        .catch(() => null)
      return
    }

    if (storedUser) {
      navigate(
        getDefaultRouteForRole(storedUser?.role, storedUser?.status || storedUser?.approval_status),
        { replace: true },
      )
    }
  }, [forceAccess, navigate])

  return (
    <div className={`auth-page auth-page--register${decorReady ? ' auth-page--decor' : ''}`}>
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

            <section className={`register-address-section${addressMissing ? ' invalid' : ''}`}>
              <div className="auth-field register-address-field">
                <label htmlFor="reg-company-address">Dirección del garaje</label>
                <div className="auth-input-icon register-address-input">
                  <span className="material-symbols-outlined">location_on</span>
                  <textarea
                    id="reg-company-address"
                    name="company_address"
                    aria-describedby="reg-company-address-help"
                    rows={2}
                    placeholder="Ej: Av. Winston Churchill 123, Santo Domingo"
                    value={form.company_address}
                    onChange={(event) => {
                      setForm({ ...form, company_address: event.target.value })
                      setAddressConfirmed(false)
                    }}
                    aria-invalid={addressMissing}
                  />
                </div>
                <p
                  id="reg-company-address-help"
                  className={`auth-helper-copy${addressMissing ? ' error' : ''}`}
                  aria-live="polite"
                >
                  {addressMissing
                    ? 'La dirección del garaje es obligatoria.'
                    : 'Ingresa la dirección o selecciona desde el mapa'}
                </p>
              </div>

              <button
                type="button"
                className="register-map-open-button"
                onClick={() => setIsMapOpen(true)}
              >
                <span className="material-symbols-outlined">map</span>
                Seleccionar en mapa
              </button>
            </section>

            <div className="auth-field">
              <label htmlFor="reg-company-phone">Telefono de empresa</label>
              <div
                className={`auth-input-icon ${companyPhoneValid === false ? 'invalid' : ''} ${
                  companyPhoneValid ? 'valid' : ''
                }`}
              >
                <span className="material-symbols-outlined">call</span>
                <input
                  id="reg-company-phone"
                  name="company_phone"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  pattern="[0-9]{10}"
                  placeholder="Telefono del negocio"
                  value={form.company_phone}
                  onChange={(event) => setForm({ ...form, company_phone: event.target.value.replace(/\D/g, '').slice(0, 10) })}
                  required
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
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  pattern="[0-9]{1,4}"
                  placeholder="Ej: 4000"
                  value={form.parking_spaces_count}
                  onChange={(event) => setForm({
                    ...form,
                    parking_spaces_count: event.target.value.replace(/\D/g, '').slice(0, 4),
                  })}
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
                  placeholder="Minimo 6 caracteres"
                  minLength={PASSWORD_MIN}
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

      {invitationModal.open && (
        <div className="sp-modal-overlay" role="presentation">
          <div className="sp-modal" role="dialog" aria-modal="true" aria-labelledby="staff-invitation-title">
            <div className="sp-modal__header">
              <div>
                <p className="auth-modal-eyebrow">Registro completado</p>
                <h3 id="staff-invitation-title" className="auth-modal-title">
                  Codigo de invitacion para personal
                </h3>
              </div>
              <button
                type="button"
                className="sp-modal__close"
                aria-label="Continuar a verificacion"
                onClick={handleInvitationModalClose}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="sp-modal__body">
              <p className="auth-modal-copy">
                Comparte este codigo con tu personal para que pueda registrarse en <strong>/staff-register</strong>.
                Tambien podras verlo siempre despues en la configuracion del garaje.
              </p>

              <div className="auth-modal-code-card">
                <span className="auth-modal-code-label">Codigo de invitacion</span>
                <code className="auth-modal-code">{invitationModal.code}</code>
                <p className="auth-modal-code-note">Este codigo es tu `garage_id`.</p>
              </div>

              {copiedInvitationCode && <p className="auth-alert success">Codigo copiado al portapapeles.</p>}

              <div className="sp-modal__actions auth-modal-actions">
                <button
                  type="button"
                  className="auth-btn auth-btn-ghost"
                  onClick={handleCopyInvitationCode}
                  style={{ width: 'auto', marginTop: 0, paddingInline: 22 }}
                >
                  Copiar
                </button>
                <button
                  type="button"
                  className="auth-btn auth-btn-primary"
                  onClick={handleInvitationModalClose}
                  style={{ width: 'auto', marginTop: 0, paddingInline: 22 }}
                >
                  Continuar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isMapOpen ? (
        <Suspense fallback={null}>
          <RegisterMapModal
            isOpen={isMapOpen}
            initialAddress={form.company_address}
            onClose={() => setIsMapOpen(false)}
            onConfirm={({ address }) => {
              setForm((current) => ({ ...current, company_address: address || current.company_address }))
              setAddressConfirmed(Boolean(address))
              setIsMapOpen(false)
            }}
          />
        </Suspense>
      ) : null}
    </div>
  )
}

