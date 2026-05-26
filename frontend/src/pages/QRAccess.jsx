import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'

import { apiPost } from '../lib/api'

const PAGE_BG = '#0f172a'
const CARD_ALT = '#16213d'
const BORDER = 'rgba(148, 163, 184, 0.18)'
const TEXT = '#e2e8f0'
const TEXT_SOFT = '#94a3b8'
const CYAN = '#22d3ee'

const styles = {
  page: {
    minHeight: '100%',
    background: `radial-gradient(circle at top, rgba(34, 211, 238, 0.14), transparent 30%), ${PAGE_BG}`,
    color: TEXT,
    borderRadius: 28,
    padding: '28px clamp(18px, 3vw, 32px)',
    boxSizing: 'border-box',
  },
  header: {
    display: 'grid',
    gap: 10,
    marginBottom: 24,
  },
  eyebrow: {
    display: 'inline-flex',
    width: 'fit-content',
    alignItems: 'center',
    gap: 8,
    padding: '8px 14px',
    borderRadius: 999,
    background: 'rgba(34, 211, 238, 0.12)',
    color: '#a5f3fc',
    border: '1px solid rgba(34, 211, 238, 0.28)',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  title: {
    margin: 0,
    fontSize: 'clamp(2rem, 4vw, 3rem)',
    lineHeight: 1.05,
    color: '#f8fafc',
    fontWeight: 800,
  },
  subtitle: {
    margin: 0,
    maxWidth: 760,
    color: TEXT_SOFT,
    fontSize: 15,
    lineHeight: 1.6,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
    gap: 20,
  },
  card: {
    background: 'linear-gradient(180deg, rgba(22, 33, 61, 0.98), rgba(12, 22, 43, 0.98))',
    border: `1px solid ${BORDER}`,
    borderRadius: 24,
    overflow: 'hidden',
    boxShadow: '0 22px 60px rgba(2, 6, 23, 0.28)',
  },
  cardHead: {
    padding: '22px 22px 16px',
    borderBottom: `1px solid ${BORDER}`,
  },
  cardBody: {
    padding: 22,
    display: 'grid',
    gap: 18,
  },
  cardTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
    color: '#f8fafc',
  },
  cardSub: {
    margin: '6px 0 0',
    color: TEXT_SOFT,
    fontSize: 13,
    lineHeight: 1.6,
  },
  scannerWrap: {
    position: 'relative',
    borderRadius: 20,
    overflow: 'hidden',
    background: '#020617',
    border: `1px solid ${BORDER}`,
    minHeight: 360,
  },
  video: {
    display: 'block',
    width: '100%',
    minHeight: 360,
    objectFit: 'cover',
    background: '#020617',
  },
  scannerHud: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    background: 'linear-gradient(180deg, rgba(2, 6, 23, 0.15), rgba(2, 6, 23, 0.48))',
  },
  scannerFrame: {
    position: 'absolute',
    inset: '16% 14%',
    borderRadius: 24,
    border: '2px solid rgba(34, 211, 238, 0.85)',
    boxShadow: '0 0 0 999px rgba(2, 6, 23, 0.22)',
  },
  scannerLine: {
    position: 'absolute',
    left: '16%',
    right: '16%',
    top: '50%',
    height: 3,
    borderRadius: 999,
    background: 'linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.95), transparent)',
    boxShadow: '0 0 18px rgba(34, 211, 238, 0.55)',
  },
  statusRow: {
    display: 'grid',
    gap: 10,
  },
  statusChip: (tone) => ({
    display: 'inline-flex',
    width: 'fit-content',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 700,
    border: `1px solid ${tone === 'error' ? 'rgba(239, 68, 68, 0.28)' : 'rgba(34, 211, 238, 0.28)'}`,
    color: tone === 'error' ? '#fecaca' : '#a5f3fc',
    background: tone === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 211, 238, 0.1)',
  }),
  form: {
    display: 'grid',
    gap: 14,
  },
  label: {
    display: 'grid',
    gap: 8,
    color: TEXT_SOFT,
    fontSize: 13,
    fontWeight: 700,
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    background: CARD_ALT,
    border: `1px solid ${BORDER}`,
    borderRadius: 16,
    color: '#f8fafc',
    padding: '16px 18px',
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: '0.08em',
    outline: 'none',
    textTransform: 'uppercase',
  },
  helper: {
    margin: 0,
    color: TEXT_SOFT,
    fontSize: 12,
    lineHeight: 1.6,
  },
  button: (busy) => ({
    border: 'none',
    borderRadius: 16,
    background: busy ? 'rgba(34, 211, 238, 0.4)' : `linear-gradient(135deg, ${CYAN}, #34d399)`,
    color: '#06243a',
    fontWeight: 900,
    fontSize: 15,
    padding: '15px 18px',
    cursor: busy ? 'not-allowed' : 'pointer',
    boxShadow: busy ? 'none' : '0 18px 40px rgba(34, 211, 238, 0.24)',
  }),
  secondaryButton: {
    border: `1px solid ${BORDER}`,
    borderRadius: 14,
    background: 'rgba(15, 23, 42, 0.72)',
    color: TEXT,
    fontWeight: 700,
    fontSize: 14,
    padding: '12px 14px',
    cursor: 'pointer',
  },
  result: (valid) => ({
    borderRadius: 22,
    padding: 22,
    border: `1px solid ${valid ? 'rgba(34, 197, 94, 0.32)' : 'rgba(239, 68, 68, 0.32)'}`,
    background: valid ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
    display: 'grid',
    gap: 16,
  }),
  resultTitle: (valid) => ({
    margin: 0,
    color: valid ? '#86efac' : '#fca5a5',
    fontSize: 26,
    fontWeight: 900,
  }),
  resultMessage: {
    margin: 0,
    color: '#dbeafe',
    fontSize: 14,
    lineHeight: 1.6,
  },
  resultGrid: {
    display: 'grid',
    gap: 12,
  },
  resultRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    paddingBottom: 10,
    borderBottom: `1px solid ${BORDER}`,
    fontSize: 14,
  },
}

function formatDateTime(value) {
  if (!value) return '--'
  const parsed = new Date(String(value).replace('Z', '+00:00'))
  if (Number.isNaN(parsed.getTime())) return '--'
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed)
}

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase()
}

async function requestCameraStream() {
  if (!navigator.mediaDevices?.getUserMedia) {
    const unsupported = new Error('getUserMedia no esta disponible en este navegador.')
    unsupported.name = 'NotSupportedError'
    throw unsupported
  }

  const attempts = [
    {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    },
    {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    },
    { video: true, audio: false },
  ]

  let lastError = null
  for (const constraints of attempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      console.info('[QRAccess] Camara obtenida', {
        tracks: stream.getVideoTracks().map((track) => ({
          label: track.label,
          readyState: track.readyState,
          settings: track.getSettings?.(),
        })),
      })
      return stream
    } catch (error) {
      lastError = error
      console.error('[QRAccess] Error getUserMedia:', error?.name || 'UnknownError', error?.message || String(error))
      console.error('[QRAccess] Constraints usadas:', JSON.stringify(constraints))
      const errorName = String(error?.name || '').toLowerCase()
      if (errorName.includes('notallowed') || errorName.includes('security')) {
        throw error
      }
    }
  }
  throw lastError || new Error('No se pudo iniciar la camara.')
}

function waitForVideoMetadata(video) {
  if (video.readyState >= 1 && video.videoWidth > 0) return Promise.resolve()

  return new Promise((resolve) => {
    const timeout = window.setTimeout(resolve, 1800)
    const done = () => {
      window.clearTimeout(timeout)
      video.removeEventListener('loadedmetadata', done)
      video.removeEventListener('canplay', done)
      resolve()
    }
    video.addEventListener('loadedmetadata', done, { once: true })
    video.addEventListener('canplay', done, { once: true })
  })
}

async function attachStreamToVideo(video, stream) {
  video.muted = true
  video.autoplay = true
  video.playsInline = true
  video.srcObject = stream

  await waitForVideoMetadata(video)
  await video.play()

  console.info('[QRAccess] Video de camara activo', {
    readyState: video.readyState,
    paused: video.paused,
    width: video.videoWidth,
    height: video.videoHeight,
    hasStream: Boolean(video.srcObject),
  })
}

export default function QRAccess() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const detectorRef = useRef(null)
  const intervalRef = useRef(null)
  const verificationLockRef = useRef(false)
  const lastAttemptRef = useRef({ code: '', at: 0 })

  const [manualCode, setManualCode] = useState('')
  const [scannerStatus, setScannerStatus] = useState('Inicializando camara...')
  const [verifying, setVerifying] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    let cancelled = false

    const stopScanner = () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      const stream = streamRef.current
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
    }

    const startScanner = async () => {
      if (typeof window === 'undefined') return
      if (!navigator.mediaDevices?.getUserMedia) {
        setScannerStatus('')
        return
      }

      try {
        const stream = await requestCameraStream()

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream
        if (videoRef.current) {
          try {
            await attachStreamToVideo(videoRef.current, stream)
          } catch (error) {
            console.warn('[QRAccess] No se pudo reproducir el video de camara', {
              name: error?.name,
              message: error?.message,
            })
          }
        }

        if ('BarcodeDetector' in window) {
          try {
            detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] })
            setScannerStatus('Camara activa. Enfoca el QR frente al lector.')
          } catch {
            detectorRef.current = null
            setScannerStatus('Camara activa. Escaneando QR con lector alternativo.')
          }
        } else {
          detectorRef.current = null
          setScannerStatus('Camara activa. Escaneando QR con lector alternativo.')
        }

        intervalRef.current = window.setInterval(async () => {
          const video = videoRef.current
          const canvas = canvasRef.current
          if (!video || !canvas) return
          if (video.readyState < 2 || verificationLockRef.current) return

          const ctx = canvas.getContext('2d', { willReadFrequently: true })
          if (!ctx) return

          canvas.width = video.videoWidth || 1280
          canvas.height = video.videoHeight || 720
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

          try {
            let detectedValue = ''
            const detectorInstance = detectorRef.current
            if (detectorInstance) {
              const detections = await detectorInstance.detect(canvas)
              detectedValue = normalizeCode(detections?.[0]?.rawValue || '')
            }

            if (!detectedValue) {
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
              const qr = jsQR(imageData.data, canvas.width, canvas.height, {
                inversionAttempts: 'attemptBoth',
              })
              detectedValue = normalizeCode(qr?.data || '')
            }

            if (!detectedValue) return

            const now = Date.now()
            if (lastAttemptRef.current.code === detectedValue && now - lastAttemptRef.current.at < 5000) {
              return
            }

            lastAttemptRef.current = { code: detectedValue, at: now }
            setManualCode(detectedValue)
            setScannerStatus(`Lectura detectada: ${detectedValue}`)
            await handleVerify(detectedValue, 'qr_data')
          } catch {
            return
          }
        }, 800)
      } catch (error) {
        setScannerStatus('')
      }
    }

    startScanner()

    return () => {
      cancelled = true
      stopScanner()
    }
  }, [])

  async function handleVerify(rawCode, source = 'code') {
    const candidate = normalizeCode(rawCode)
    if (!candidate || verificationLockRef.current) return

    verificationLockRef.current = true
    setVerifying(true)

    try {
      const payload = source === 'qr_data' ? { qr_data: candidate } : { code: candidate }
      const response = await apiPost('/api/qr-access/verify', payload)
      const nextResult = {
        valid: Boolean(response?.valid),
        access: response?.access || (response?.valid ? 'granted' : 'denied'),
        message: response?.message || '',
        code: response?.code || candidate,
        movement: response?.movement || '',
        vehicle: response?.vehicle || null,
        space: response?.space || null,
        session: response?.session || null,
      }

      setResult(nextResult)
      if (nextResult.valid) {
        setScannerStatus(nextResult.movement === 'exit' ? 'Salida registrada correctamente.' : 'Entrada registrada correctamente.')
        window.dispatchEvent(new CustomEvent('smartpark:data-refresh'))
      } else {
        setScannerStatus('Acceso denegado. Revisa el codigo o el QR.')
      }
    } catch (error) {
      setResult({
        valid: false,
        access: 'denied',
        message: error.message || 'No se pudo verificar el acceso.',
        code: candidate,
        movement: '',
        vehicle: null,
        space: null,
        session: null,
      })
      setScannerStatus('Fallo la verificacion del acceso.')
    } finally {
      setVerifying(false)
      verificationLockRef.current = false
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    await handleVerify(manualCode, 'code')
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <span style={styles.eyebrow}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>qr_code_scanner</span>
          Control de acceso SmartPark
        </span>
        <h1 style={styles.title}>{'Acceso por QR/C\u00f3digo'}</h1>
        <p style={styles.subtitle}>
          {'Escanea el QR en tiempo real o introduce el c\u00f3digo manualmente para verificar el acceso '}
          {'del veh\u00edculo y registrar autom\u00e1ticamente la entrada o la salida.'}
        </p>
      </header>

      <section style={styles.grid}>
        <article style={styles.card}>
          <div style={styles.cardHead}>
            <h2 style={styles.cardTitle}>Escaneo en vivo</h2>
            <p style={styles.cardSub}>
              {'Enfoca el QR o c\u00f3digo frente a la webcam. SmartPark intentar\u00e1 verificarlo apenas lo detecte.'}
            </p>
          </div>
          <div style={styles.cardBody}>
            <div style={styles.scannerWrap}>
              <video ref={videoRef} style={styles.video} autoPlay muted playsInline />
              <div style={styles.scannerHud}>
                <div style={styles.scannerFrame} />
                <div style={styles.scannerLine} />
              </div>
            </div>
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>
        </article>

        <div style={{ display: 'grid', gap: 20 }}>
          <article style={styles.card}>
            <div style={styles.cardHead}>
              <h2 style={styles.cardTitle}>{'Verificaci\u00f3n manual'}</h2>
              <p style={styles.cardSub}>
                {'Si no hay lector disponible, ingresa aqu\u00ed el c\u00f3digo y pulsa verificar.'}
              </p>
            </div>
            <div style={styles.cardBody}>
              <form style={styles.form} onSubmit={handleSubmit}>
                <label style={styles.label}>
                  {'C\u00f3digo o contenido QR'}
                  <input
                    value={manualCode}
                    onChange={(event) => setManualCode(normalizeCode(event.target.value))}
                    placeholder="Ej. 123456"
                    style={styles.input}
                    autoComplete="off"
                  />
                </label>
                <p style={styles.helper}>
                  {'Puedes pegar un c\u00f3digo corto o el contenido completo del QR. El backend intentar\u00e1 extraerlo.'}
                </p>
                <button type="submit" style={styles.button(verifying)} disabled={verifying}>
                  {verifying ? 'Verificando acceso...' : 'Verificar acceso'}
                </button>
              </form>
            </div>
          </article>

          <article style={styles.card}>
            <div style={styles.cardHead}>
              <h2 style={styles.cardTitle}>Resultado</h2>
              <p style={styles.cardSub}>
                {'Estado del \u00faltimo intento de acceso procesado por SmartPark.'}
              </p>
            </div>
            <div style={styles.cardBody}>
              {result ? (
                <div style={styles.result(result.valid)}>
                  <h3 style={styles.resultTitle(result.valid)}>
                    {result.valid ? '\u2705 ACCESO PERMITIDO' : '\u274c ACCESO DENEGADO'}
                  </h3>
                  <p style={styles.resultMessage}>{result.message || 'Sin respuesta del verificador.'}</p>

                  {result.valid && (
                    <div style={styles.resultGrid}>
                      <div style={styles.resultRow}>
                        <span>Movimiento</span>
                        <strong>{result.movement === 'exit' ? 'Salida' : 'Entrada'}</strong>
                      </div>
                      <div style={styles.resultRow}>
                        <span>Placa</span>
                        <strong>{result.vehicle?.placa || '--'}</strong>
                      </div>
                      <div style={styles.resultRow}>
                        <span>Propietario</span>
                        <strong>{result.vehicle?.propietario || '--'}</strong>
                      </div>
                      <div style={styles.resultRow}>
                        <span>{'Veh\u00edculo'}</span>
                        <strong>{result.vehicle?.marca || '--'} {result.vehicle?.modelo || ''}</strong>
                      </div>
                      <div style={styles.resultRow}>
                        <span>Espacio</span>
                        <strong>{result.space?.numero_mostrar || result.space?.codigo || '--'}</strong>
                      </div>
                      <div style={styles.resultRow}>
                        <span>Hora</span>
                        <strong>
                          {formatDateTime(
                            result.session?.entry_time ||
                            result.session?.entrada ||
                            result.session?.exit_time ||
                            result.session?.salida,
                          )}
                        </strong>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    borderRadius: 22,
                    border: `1px dashed ${BORDER}`,
                    padding: 24,
                    background: 'rgba(15, 23, 42, 0.4)',
                    color: TEXT_SOFT,
                    lineHeight: 1.7,
                  }}
                >
                  {'A\u00fan no se ha procesado ning\u00fan acceso. Escanea un QR o escribe un c\u00f3digo para comenzar.'}
                </div>
              )}
            </div>
          </article>
        </div>
      </section>
    </div>
  )
}
