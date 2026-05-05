import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { apiPost } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

export default function SinAcceso() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const deniedPath = location.state?.deniedPath
  const registerAlert = location.state?.registerAlert
  const lastAlertKeyRef = useRef('')

  useEffect(() => {
    if (!registerAlert || !user || !deniedPath) return

    const alertKey = `${user?.user_id || user?.id || user?.email || 'anon'}:${deniedPath}`
    if (lastAlertKeyRef.current === alertKey) return
    lastAlertKeyRef.current = alertKey

    apiPost('/api/alertas-acceso', {
      user_id: user?.user_id || user?.id,
      email: user?.email,
      rol: user?.role,
      ruta_denegada: deniedPath,
    }).catch(() => {})
  }, [deniedPath, registerAlert, user])

  return (
    <div className="module-page sin-acceso-page">
      <section className="module-card sin-acceso-card">
        <p className="small-label">Acceso restringido</p>
        <h1>No tienes permiso para ver esta página</h1>
        <p>
          {deniedPath
            ? `No tienes permisos para acceder a ${deniedPath}.`
            : 'Tu rol actual no tiene acceso a esta sección del sistema.'}
        </p>
        <div className="sin-acceso-actions">
          <button type="button" className="btn btn-primary" onClick={() => navigate(-1)}>
            Volver
          </button>
        </div>
      </section>
    </div>
  )
}

