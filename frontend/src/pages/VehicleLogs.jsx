import { useEffect, useState } from 'react'

import { apiGet } from '../lib/api'

const formatearFecha = (valor) => {
  if (!valor) return 'Sin fecha'

  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return 'Sin fecha'

  return new Intl.DateTimeFormat('es-DO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(fecha)
}

const resumirDetalles = (detalles) => {
  if (!detalles) return 'Sin detalles'
  if (typeof detalles === 'string') return detalles

  const pares = Object.entries(detalles)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${value}`)

  return pares.length ? pares.join(' | ') : 'Sin detalles'
}

export default function VehicleLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const cargarLogs = async () => {
    setError('')
    try {
      const payload = await apiGet('/api/vehiculos/logs')
      setLogs(Array.isArray(payload?.data) ? payload.data : [])
    } catch (err) {
      setError(err.message || 'No fue posible cargar los logs de vehículos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarLogs()
  }, [])

  return (
    <div className="module-page vehicle-logs-page">
      <header className="vehicle-logs-page__header">
        <div>
          <p className="module-kicker">Auditoría</p>
          <h1>Logs de Vehículos</h1>
          <p>Revisa cada creación, edición, entrada y salida registrada en el sistema.</p>
        </div>
      </header>

      {error && <div className="module-feedback error">{error}</div>}

      <section className="vehicle-logs-card">
        <div className="vehicle-logs-head">
          <span>Placa</span>
          <span>Acción</span>
          <span>Usuario</span>
          <span>Detalles</span>
          <span>Fecha</span>
        </div>

        {loading && (
          <div className="module-empty">
            <div className="skeleton skeleton-row" />
            <div className="skeleton skeleton-row" />
            <div className="skeleton skeleton-row" />
          </div>
        )}

        {!loading && !logs.length && <div className="module-empty">No hay logs de vehículos todavía.</div>}

        {!loading &&
          logs.map((log) => (
            <div className="vehicle-logs-row" key={log.id || `${log.placa}-${log.created_at}`}>
              <strong>{log.placa || 'Sin placa'}</strong>
              <span className={`vehicle-logs-action action-${String(log.accion || '').toLowerCase()}`}>
                {log.accion || 'sin acción'}
              </span>
              <span>{log.usuario_email || 'Sistema'}</span>
              <span title={typeof log.detalles === 'string' ? log.detalles : JSON.stringify(log.detalles || {})}>
                {resumirDetalles(log.detalles)}
              </span>
              <span>{formatearFecha(log.created_at)}</span>
            </div>
          ))}
      </section>
    </div>
  )
}

