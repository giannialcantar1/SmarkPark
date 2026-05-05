import { useEffect, useState } from 'react'

import useApi from '../hooks/useApi'
import { invalidateApiCache } from '../lib/api'
import { registerExit } from '../services/api'

function formatMoney(value) {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: 2,
  }).format(Number(value) || 0)
}

export default function ModalExit({ isOpen, onClose, onSuccess, initialPlate = '' }) {
  const [plate, setPlate] = useState(initialPlate)
  const [validationError, setValidationError] = useState('')
  const [result, setResult] = useState(null)
  const exitApi = useApi(registerExit, { retries: 1 })

  useEffect(() => {
    if (isOpen) {
      setPlate(initialPlate)
      return
    }

    if (!isOpen) {
      setPlate('')
      setValidationError('')
      setResult(null)
      exitApi.reset()
    }
  }, [isOpen, initialPlate, exitApi])

  if (!isOpen) return null

  const handleSubmit = async (event) => {
    event.preventDefault()
    const normalizedPlate = plate.trim().toUpperCase()

    if (!normalizedPlate || normalizedPlate.length < 4) {
      setValidationError('Ingresa una placa valida.')
      return
    }

    setValidationError('')

    try {
      const payload = await exitApi.execute(normalizedPlate)
      setResult(payload)
      invalidateApiCache([
        '/api/dashboard/stats',
        '/api/parking-spaces',
        '/api/parking-spaces/stats',
        '/api/vehiculos',
        '/api/vehicles',
        '/api/parking-sessions',
        '/api/parking-sessions/active',
        '/api/payments',
      ])
      await onSuccess?.(payload)
      // FIX: Disparar evento para actualización inmediata del dashboard
      window.dispatchEvent(new CustomEvent('dashboard-refresh'))
      window.dispatchEvent(new CustomEvent('smartpark:data-refresh'))
      window.setTimeout(() => {
        onClose?.()
      }, 1200)
    } catch (error) {
      setResult(null)
    }
  }

  return (
    <div className="sp-modal-overlay" onClick={onClose} role="presentation">
      <div className="sp-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="sp-modal__header">
          <div>
            <p className="sp-modal__eyebrow">Cobro de salida</p>
            <h3>Registrar salida</h3>
          </div>
          <button type="button" className="sp-modal__close" onClick={onClose} aria-label="Cerrar modal">
            x
          </button>
        </div>

        <form className="sp-modal__body" onSubmit={handleSubmit}>
          <label className="sp-field">
            <span>Placa del vehiculo</span>
            <input
              type="text"
              value={plate}
              onChange={(event) => setPlate(event.target.value.toUpperCase())}
              placeholder="ABC-123"
              maxLength={12}
            />
          </label>

          {(validationError || exitApi.error) && (
            <div className="sp-alert sp-alert--error">{validationError || exitApi.error}</div>
          )}

          {result && (
            <div className="sp-payment-card">
              <div>
                <span>Tiempo estacionado</span>
                <strong>{result.duration_minutes || 0} min</strong>
              </div>
              <div>
                <span>Monto a pagar</span>
                <strong>{formatMoney(result.amount_to_pay)}</strong>
              </div>
            </div>
          )}

          <div className="sp-modal__actions">
            <button type="button" className="sp-button sp-button--ghost" onClick={onClose}>
              Cerrar
            </button>
            <button type="submit" className="sp-button" disabled={exitApi.loading}>
              {exitApi.loading ? 'Procesando...' : 'Pagar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

