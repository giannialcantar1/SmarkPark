export default function AuthLoadingScreen({ message = 'Verificando sesión...' }) {
  return (
    <div className="auth-loading-screen">
      <div className="auth-loading-panel">
        <img
          className="auth-loading-logo"
          src="/favicon-smartpark-round.png"
          alt="Logo de SmartPark"
        />
        <div className="auth-loading-spinner" aria-hidden="true" />
        <p className="auth-loading-text">{message}</p>
      </div>
    </div>
  )
}

