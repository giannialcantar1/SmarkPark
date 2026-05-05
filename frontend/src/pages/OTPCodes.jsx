import { useEffect, useState } from 'react'

import { apiGet } from '../lib/api'

const formatDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('es-DO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default function OTPCodes() {
  const [codes, setCodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadCodes = async () => {
    setLoading(true)
    setError(null)

    try {
      const payload = await apiGet('/api/otp/codigos')
      setCodes(Array.isArray(payload?.data) ? payload.data : [])
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los codigos OTP.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCodes()
  }, [])

  return (
    <div className="module-page">
      <header className="module-header">
        <div>
          <h1>Codigos OTP</h1>
          <p>Consulta todos los codigos enviados y su estado actual.</p>
        </div>
      </header>

      {error && <div className="module-feedback error">{error}</div>}

      <section className="module-card otp-card">
        <div className="otp-table-head">
          <span>Email</span>
          <span>Codigo</span>
          <span>Tipo</span>
          <span>Usado</span>
          <span>Expira</span>
          <span>Fecha</span>
        </div>

        {loading && (
          <div className="module-empty">
            <div className="skeleton skeleton-row" />
            <div className="skeleton skeleton-row" />
            <div className="skeleton skeleton-row" />
          </div>
        )}

        {!loading && codes.length === 0 && (
          <div className="module-empty">No hay codigos OTP registrados.</div>
        )}

        {!loading &&
          codes.map((code) => (
            <div key={code.id} className="otp-table-row">
              <span>{code.email || '-'}</span>
              <span className="mono">{code.codigo || '-'}</span>
              <span className="otp-type">{code.tipo || '-'}</span>
              <span>
                <span className={`module-badge ${code.usado ? 'fuera' : 'dentro'}`}>
                  {code.usado ? 'Si' : 'No'}
                </span>
              </span>
              <span>{formatDateTime(code.expira_at)}</span>
              <span>{formatDateTime(code.created_at)}</span>
            </div>
          ))}
      </section>
    </div>
  )
}

