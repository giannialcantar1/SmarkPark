import { useEffect, useMemo, useRef, useState } from 'react'

import CreditCardPreview from './CreditCardPreview'
import { apiPost } from '../../lib/api'
import styles from './PaymentModal.module.css'

const EMPTY_CARD = {
  number: '',
  holder: '',
  expiry: '',
  cvv: '',
}

const EMPTY_TRANSFER = {
  reference: '',
  date: '',
  receipt: null,
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: 2,
  }).format(Number(value) || 0)
}

function formatDueDate(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return new Intl.DateTimeFormat('es-DO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms))

const getCardExpiryError = (value) => {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length < 4) return ''

  const month = Number(digits.slice(0, 2))
  const year = 2000 + Number(digits.slice(2, 4))

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return 'Fecha de vencimiento invalida'
  }

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    return 'La tarjeta está vencida'
  }

  return ''
}

export default function PaymentModal({ isOpen, onClose, planData, garageId, onPaymentSuccess }) {
  const [paymentMethod, setPaymentMethod] = useState('card')
  const [cardData, setCardData] = useState(EMPTY_CARD)
  const [transferData, setTransferData] = useState(EMPTY_TRANSFER)
  const [cardSaved, setCardSaved] = useState(false)
  const [paymentState, setPaymentState] = useState('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const isMountedRef = useRef(true)

  const isBusy = paymentState === 'processing' || paymentState === 'success'

  useEffect(() => {
    if (!isOpen) return undefined

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isBusy) {
        onClose?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isBusy, isOpen, onClose])

  useEffect(() => {
    if (!isOpen) {
      setPaymentMethod('card')
      setCardData(EMPTY_CARD)
      setTransferData(EMPTY_TRANSFER)
      setCardSaved(false)
      setPaymentState('idle')
      setErrorMessage('')
      setReferenceNumber('')
    }
  }, [isOpen])

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const detectCardBrand = (value) => {
    const digits = String(value || '').replace(/\D/g, '')
    if (digits.startsWith('4')) return 'visa'
    if (/^3[47]/.test(digits)) return 'amex'
    if (/^5[1-5]/.test(digits) || /^2(2[2-9]|[3-6]\d|7[01])/.test(digits)) return 'mastercard'
    return 'unknown'
  }

  const formatCardNumber = (value) => {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 16)
    return digits.replace(/(.{4})/g, '$1 ').trim()
  }

  const handleCardChange = (field, value) => {
    setCardData((current) => {
      if (field === 'number') {
        return { ...current, number: formatCardNumber(value) }
      }

      if (field === 'expiry') {
        const digits = String(value || '').replace(/\D/g, '').slice(0, 4)
        const formatted = digits.length <= 2 ? digits : `${digits.slice(0, 2)}/${digits.slice(2)}`
        return { ...current, expiry: formatted }
      }

      if (field === 'cvv') {
        return { ...current, cvv: String(value || '').replace(/\D/g, '').slice(0, 4) }
      }

      if (field === 'holder') {
        return { ...current, holder: String(value || '').toUpperCase() }
      }

      return { ...current, [field]: value }
    })
  }

  const handleTransferChange = (field, value) => {
    setTransferData((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const cardBrand = useMemo(() => detectCardBrand(cardData.number), [cardData.number])
  const cardExpiryError = useMemo(() => getCardExpiryError(cardData.expiry), [cardData.expiry])

  const isCardValid = useMemo(() => {
    const digits = cardData.number.replace(/\D/g, '')
    return (
      digits.length >= 15 &&
      cardData.holder.trim().length > 2 &&
      cardData.expiry.length === 5 &&
      !cardExpiryError &&
      cardData.cvv.length >= 3
    )
  }, [cardData, cardExpiryError])

  const isTransferValid = useMemo(() => {
    return (
      transferData.reference.trim().length > 2 &&
      Boolean(transferData.date) &&
      Boolean(transferData.receipt)
    )
  }, [transferData])

  const isSubmitDisabled = paymentMethod === 'card' ? !isCardValid : !isTransferValid

  const amountLabel = formatCurrency(planData?.monto || planData?.amount || 0)
  const paymentAmount = Number(planData?.monto || planData?.amount || 0)
  const clientLabel = planData?.cliente || planData?.client || planData?.user_name || planData?.name || 'Cliente'
  const dueDateLabel = formatDueDate(planData?.vencimiento || planData?.due_date)
  const planId = String(planData?.planId || '').trim()
  const userId = String(planData?.userId || planData?.user_id || '').trim()

  const generateReferenceNumber = () => `REF-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`

  const validatePaymentData = () => {
    if (!paymentMethod) return 'Selecciona un metodo de pago para continuar.'
    if (!planId) return 'No se encontro el plan mensual que se debe pagar.'
    if (!garageId) return 'No se encontro el garage asociado a este pago.'
    if (paymentMethod === 'card' && cardExpiryError) return cardExpiryError
    if (paymentMethod === 'card' && !isCardValid) return 'Completa todos los datos de la tarjeta.'
    if (paymentMethod === 'transfer' && !isTransferValid) {
      return 'Completa la referencia, la fecha y el comprobante de la transferencia.'
    }
    return ''
  }

  const updatePaymentInSupabase = async (targetPlanId, paymentReference, amount, method) => {
    try {
      await apiPost('/api/monthly-plans/process-payment', {
        plan_id: targetPlanId,
        reference: paymentReference,
        amount,
        method,
        garage_id: garageId,
        user_id: userId || null,
      })
      return true
    } catch (err) {
      console.error('Error al procesar pago mensual:', err)
      throw err
    }
  }

  const handleRetry = () => {
    setErrorMessage('')
    setPaymentState('idle')
  }

  const handlePayment = async (event) => {
    event.preventDefault()

    const validationMessage = validatePaymentData()
    if (validationMessage) {
      setReferenceNumber('')
      setErrorMessage(validationMessage)
      setPaymentState('error')
      return
    }

    setErrorMessage('')
    setReferenceNumber('')
    setPaymentState('processing')

    await wait(2000)
    if (!isMountedRef.current) return

    const paymentApproved = Math.random() < 0.85
    if (!paymentApproved) {
      setPaymentState('error')
      setErrorMessage('Pago rechazado por la entidad emisora. Puedes reintentar o cambiar el metodo.')
      return
    }

    const generatedReference = generateReferenceNumber()

    try {
      await updatePaymentInSupabase(planId, generatedReference, paymentAmount, paymentMethod)
      if (!isMountedRef.current) return

      setReferenceNumber(generatedReference)
      setPaymentState('success')

      await wait(3000)
      if (!isMountedRef.current) return

      await onPaymentSuccess?.({
        planId,
        method: paymentMethod,
        amount: paymentAmount,
        referenceNumber: generatedReference,
      })

      onClose?.()
    } catch (error) {
      if (!isMountedRef.current) return
      setReferenceNumber('')
      setPaymentState('error')
      setErrorMessage(error.message || 'No se pudo registrar el pago en Supabase.')
    }
  }

  const handleRequestClose = () => {
    if (isBusy) return
    onClose?.()
  }

  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={handleRequestClose}>
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <div className={styles.secureBadge}>
              <span className="material-symbols-outlined">verified_user</span>
              <span>SSL seguro</span>
            </div>
            <h2 className={styles.title}>Pago de mensualidad</h2>
            <p className={styles.subtitle}>Confirma el metodo de pago y revisa los datos antes de continuar.</p>
          </div>

          <button type="button" className={styles.closeButton} onClick={handleRequestClose} aria-label="Cerrar modal" disabled={isBusy}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Cliente</span>
            <strong className={styles.summaryValue}>{clientLabel}</strong>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Monto</span>
            <strong className={styles.summaryValue}>{amountLabel}</strong>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Vencimiento</span>
            <strong className={styles.summaryValue}>{dueDateLabel}</strong>
          </div>
        </div>

        <div className={styles.layout}>
          <aside className={styles.methods}>
            <button
              type="button"
              className={`${styles.methodButton} ${paymentMethod === 'card' ? styles.methodButtonActive : ''}`}
              onClick={() => setPaymentMethod('card')}
              disabled={paymentState !== 'idle'}
            >
              <span className={styles.methodTitle}>Tarjeta</span>
              <span className={styles.methodDescription}>Pago inmediato con tarjeta de credito o debito.</span>
            </button>

            <button
              type="button"
              className={`${styles.methodButton} ${paymentMethod === 'transfer' ? styles.methodButtonActive : ''}`}
              onClick={() => setPaymentMethod('transfer')}
              disabled={paymentState !== 'idle'}
            >
              <span className={styles.methodTitle}>Transferencia</span>
              <span className={styles.methodDescription}>Adjunta referencia y comprobante del deposito.</span>
            </button>
          </aside>

          <form className={styles.formPanel} onSubmit={handlePayment}>
            {paymentState === 'idle' ? (
              <>
                <div className={styles.panels}>
                  <section className={`${styles.panel} ${paymentMethod === 'card' ? styles.panelActive : styles.panelHidden}`}>
                    <CreditCardPreview cardData={cardData} brand={cardBrand} />

                    <div className={styles.fieldGrid}>
                      <label className={styles.field}>
                        <span className={styles.fieldLabel}>Numero de tarjeta</span>
                        <input
                          className={styles.input}
                          type="text"
                          inputMode="numeric"
                          placeholder="1234 5678 9012 3456"
                          value={cardData.number}
                          onChange={(event) => handleCardChange('number', event.target.value)}
                        />
                      </label>

                      <label className={styles.field}>
                        <span className={styles.fieldLabel}>Titular</span>
                        <input
                          className={styles.input}
                          type="text"
                          placeholder="NOMBRE DEL TITULAR"
                          value={cardData.holder}
                          onChange={(event) => handleCardChange('holder', event.target.value)}
                        />
                      </label>

                      <div className={styles.row}>
                        <label className={styles.field}>
                          <span className={styles.fieldLabel}>Expiracion</span>
                          <input
                            className={`${styles.input} ${cardExpiryError ? styles.inputError : ''}`}
                            type="text"
                            inputMode="numeric"
                            placeholder="MM/AA"
                            value={cardData.expiry}
                            onChange={(event) => handleCardChange('expiry', event.target.value)}
                            aria-invalid={Boolean(cardExpiryError)}
                          />
                          {cardExpiryError && <span className={styles.fieldError}>{cardExpiryError}</span>}
                        </label>

                        <label className={styles.field}>
                          <span className={styles.fieldLabel}>CVV</span>
                          <input
                            className={styles.input}
                            type="password"
                            inputMode="numeric"
                            placeholder="123"
                            value={cardData.cvv}
                            onChange={(event) => handleCardChange('cvv', event.target.value)}
                          />
                        </label>
                      </div>

                      <label className={styles.checkbox}>
                        <input
                          type="checkbox"
                          checked={cardSaved}
                          onChange={(event) => setCardSaved(event.target.checked)}
                        />
                        <span>Guardar para futuros pagos</span>
                      </label>
                    </div>
                  </section>

                  <section className={`${styles.panel} ${paymentMethod === 'transfer' ? styles.panelActive : styles.panelHidden}`}>
                    <div className={styles.bankCard}>
                      <div className={styles.bankRow}><span>Banco</span><strong>Banco Popular Dominicano</strong></div>
                      <div className={styles.bankRow}><span>Cuenta</span><strong>001-987654321</strong></div>
                      <div className={styles.bankRow}><span>Titular</span><strong>SmartPark Control Total SRL</strong></div>
                      <div className={styles.bankRow}><span>Monto</span><strong>{amountLabel}</strong></div>
                    </div>

                    <div className={styles.fieldGrid}>
                      <label className={styles.field}>
                        <span className={styles.fieldLabel}>Referencia de transferencia</span>
                        <input
                          className={styles.input}
                          type="text"
                          placeholder="REF-123456"
                          value={transferData.reference}
                          onChange={(event) => handleTransferChange('reference', event.target.value)}
                        />
                      </label>

                      <label className={styles.field}>
                        <span className={styles.fieldLabel}>Fecha de transferencia</span>
                        <input
                          className={styles.input}
                          type="date"
                          value={transferData.date}
                          onChange={(event) => handleTransferChange('date', event.target.value)}
                        />
                      </label>

                      <label className={styles.field}>
                        <span className={styles.fieldLabel}>Comprobante</span>
                        <label className={styles.uploadBox}>
                          <span className="material-symbols-outlined">upload</span>
                          <span>{transferData.receipt?.name || 'Subir imagen del comprobante'}</span>
                          <input
                            className={styles.hiddenInput}
                            type="file"
                            accept="image/*"
                            onChange={(event) => handleTransferChange('receipt', event.target.files?.[0] || null)}
                          />
                        </label>
                      </label>
                    </div>
                  </section>
                </div>

                <div className={styles.footer}>
                  <button type="button" className={styles.cancelButton} onClick={handleRequestClose}>
                    Cancelar
                  </button>
                  <button type="submit" className={styles.payButton} disabled={isSubmitDisabled}>
                    Pagar {amountLabel}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className={styles.statePanel}>
                  {paymentState === 'processing' ? (
                    <>
                      <div className={styles.spinner} aria-hidden="true" />
                      <h3 className={styles.stateTitle}>Procesando...</h3>
                      <p className={styles.stateMessage}>Estamos validando el pago y registrando la transaccion en Supabase.</p>
                    </>
                  ) : null}

                  {paymentState === 'success' ? (
                    <>
                      <div className={`${styles.stateIcon} ${styles.stateIconSuccess}`}>
                        <span className="material-symbols-outlined">check_circle</span>
                      </div>
                      <h3 className={styles.stateTitle}>Pago aprobado</h3>
                      <p className={styles.stateMessage}>Referencia unica generada para esta mensualidad.</p>
                      <div className={styles.referenceBox}>{referenceNumber}</div>
                    </>
                  ) : null}

                  {paymentState === 'error' ? (
                    <>
                      <div className={`${styles.stateIcon} ${styles.stateIconError}`}>
                        <span className="material-symbols-outlined">error</span>
                      </div>
                      <h3 className={styles.stateTitle}>No se pudo completar el pago</h3>
                      <p className={styles.stateMessage}>{errorMessage || 'Ocurrio un problema procesando el pago.'}</p>
                    </>
                  ) : null}
                </div>

                <div className={styles.footer}>
                  {paymentState === 'processing' ? (
                    <>
                      <button type="button" className={styles.cancelButton} disabled>
                        Espera...
                      </button>
                      <button type="button" className={styles.payButton} disabled>
                        Procesando...
                      </button>
                    </>
                  ) : null}

                  {paymentState === 'success' ? (
                    <button type="button" className={styles.payButton} disabled>
                      Cerrando...
                    </button>
                  ) : null}

                  {paymentState === 'error' ? (
                    <>
                      <button type="button" className={styles.cancelButton} onClick={handleRequestClose}>
                        Cancelar
                      </button>
                      <button type="button" className={styles.payButton} onClick={handleRetry}>
                        Reintentar
                      </button>
                    </>
                  ) : null}
                </div>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
