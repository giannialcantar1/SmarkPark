import { useNavigate } from 'react-router-dom'

export default function AwaitingActivation() {
  const navigate = useNavigate()

  return (
    <div className="module-page sin-acceso-page">
      <section className="module-card sin-acceso-card">
        <p className="small-label">Cuenta pendiente</p>
        <h1>Esperando activación</h1>
        <p>Tu cuenta está pendiente de activación. Contacta al administrador.</p>
        <div className="sin-acceso-actions">
          <button type="button" className="btn btn-primary" onClick={() => navigate('/login', { replace: true })}>
            Volver al login
          </button>
        </div>
      </section>
    </div>
  )
}

