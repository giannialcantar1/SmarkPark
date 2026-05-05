import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import './auth.css'

export default function VerifyOTP() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const email = searchParams.get('email') || ''
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendMsg, setResendMsg] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch('http://127.0.0.1:5000/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      })
      const data = await response.json()
      if (data.success) {
        setSuccess(true)
        setTimeout(() => navigate(`/login?email=${encodeURIComponent(email)}`), 2000)
      } else {
        setError(data.error || 'Código incorrecto.')
      }
    } catch {
      setError('Error de conexión.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    setResendMsg(null)
    setError(null)
    try {
      const response = await fetch('http://127.0.0.1:5000/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await response.json()
      if (data.success) {
        setResendMsg('Código reenviado. Revisa tu correo.')
        setCode('')
      } else {
        setError(data.error || 'No se pudo reenviar.')
      }
    } catch {
      setError('Error de conexión.')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-screen">
        <div className="auth-panel auth-fade-in">
          <h1>Verifica tu cuenta</h1>
          <p style={{color:'#94a3b8',fontSize:'0.9rem',marginBottom:'1.5rem',textAlign:'center'}}>
            Ingresa el código de 6 dígitos enviado a<br/>
            <strong style={{color:'#e2e8f0'}}>{email}</strong>
          </p>

          {success && <p className="auth-alert success">Cuenta verificada. Redirigiendo...</p>}
          {error && <p className="auth-alert error">{error}</p>}
          {resendMsg && <p className="auth-alert success">{resendMsg}</p>}

          <form onSubmit={handleSubmit}>
            <div className="auth-field">
              <label>Código de verificación</label>
              <div className="auth-input-icon">
                <span className="material-symbols-outlined">pin</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  required
                  style={{letterSpacing:'8px',fontSize:'1.4rem',textAlign:'center',fontWeight:'700'}}
                />
              </div>
            </div>

            <button className="auth-btn auth-btn-primary" type="submit" disabled={submitting || code.length !== 6}>
              {submitting ? 'Verificando...' : 'Verificar cuenta'}
            </button>
          </form>

          <p style={{color:'#64748b',fontSize:'0.85rem',margin:'1rem 0 0.5rem',textAlign:'center'}}>
            ¿No recibiste el código?
          </p>
          <button className="auth-btn auth-btn-ghost" type="button" onClick={handleResend} disabled={resending}>
            {resending ? 'Reenviando...' : 'Reenviar código'}
          </button>

        </div>
      </section>
    </div>
  )
}
