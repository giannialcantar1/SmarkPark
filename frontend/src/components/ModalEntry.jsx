import { useEffect, useMemo, useState } from 'react'

import { apiGet, getCachedApiData, invalidateApiCache } from '../lib/api'
import { apiRequest } from '../services/api'

const normalizePlate = (value) => {
  const raw = String(value || '').trim().toUpperCase()
  let plate = ''
  let letterCount = 0
  let digitCount = 0
  for (const char of raw) {
    if (letterCount < 3 && /[A-Z]/.test(char)) {
      plate += char
      letterCount += 1
    } else if (letterCount === 3 && digitCount < 4 && /[0-9]/.test(char)) {
      plate += char
      digitCount += 1
    }
    if (letterCount === 3 && digitCount === 4) break
  }
  return plate
}
const getVehiclePlate = (vehicle) => normalizePlate(vehicle?.placa || vehicle?.plate)
const getVehicleOwner = (vehicle) =>
  vehicle?.propietario || vehicle?.owner_name || vehicle?.owner || vehicle?.nombre || ''
const getVehicleType = (vehicle) => vehicle?.tipo || vehicle?.type || vehicle?.vehicle_type || 'carro'
const getVehicleBrand = (vehicle) => vehicle?.marca || vehicle?.brand || ''
const getVehicleModel = (vehicle) => vehicle?.modelo || vehicle?.model || ''
const getVehicleStatus = (vehicle) => String(vehicle?.status || vehicle?.estado || '').trim().toLowerCase()

export default function ModalEntry({ onClose, onSuccess, isOpen }) {
  const cachedVehicles = getCachedApiData('/api/vehiculos')
  const [form, setForm] = useState({
    plate: '',
    driverName: '',
    vehicleType: 'carro',
    brand: '',
    model: '',
  })
  const [knownVehicles, setKnownVehicles] = useState(() =>
    Array.isArray(cachedVehicles?.data) ? cachedVehicles.data : [],
  )
  const [vehiclesLoading, setVehiclesLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (!isOpen) {
      setForm({ plate: '', driverName: '', vehicleType: 'carro', brand: '', model: '' })
      setError(null)
      setResult(null)
      return
    }

    const loadVehicles = async () => {
      setVehiclesLoading(true)
      try {
        const payload = await apiGet('/api/vehiculos', { forceFresh: true })
        setKnownVehicles(Array.isArray(payload?.data) ? payload.data : [])
      } catch {
        setKnownVehicles(Array.isArray(cachedVehicles?.data) ? cachedVehicles.data : [])
      } finally {
        setVehiclesLoading(false)
      }
    }

    loadVehicles()
  }, [cachedVehicles?.data, isOpen])

  const plateQuery = normalizePlate(form.plate)
  const exactKnownVehicle = useMemo(
    () => knownVehicles.find((vehicle) => getVehiclePlate(vehicle) === plateQuery),
    [knownVehicles, plateQuery],
  )
  const plateSuggestions = useMemo(() => {
    if (!plateQuery) return knownVehicles.slice(0, 4)
    return knownVehicles.filter((vehicle) => getVehiclePlate(vehicle).includes(plateQuery)).slice(0, 4)
  }, [knownVehicles, plateQuery])

  const applyKnownVehicle = (vehicle) => {
    setForm({
      plate: getVehiclePlate(vehicle),
      driverName: getVehicleOwner(vehicle),
      vehicleType: getVehicleType(vehicle),
      brand: getVehicleBrand(vehicle),
      model: getVehicleModel(vehicle),
    })
    setError(null)
  }

  const handlePlateChange = (value) => {
    const nextPlate = normalizePlate(value)
    const vehicle = knownVehicles.find((item) => getVehiclePlate(item) === nextPlate)
    if (vehicle) {
      applyKnownVehicle(vehicle)
      return
    }
    setForm((current) => ({ ...current, plate: nextPlate }))
  }

  const getAssignedSpace = (payload) => {
    return (
      payload?.space?.numero_mostrar ||
      payload?.space?.codigo ||
      payload?.space?.code ||
      payload?.session?.espacio ||
      payload?.session?.space_code ||
      payload?.data?.espacio ||
      'Asignado'
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.plate.trim()) return setError('La placa es requerida')
    if (!/^[A-Z]{3}[0-9]{4}$/.test(normalizePlate(form.plate))) {
      return setError('La placa debe tener 3 letras y 4 numeros. Ejemplo: ABC1234.')
    }
    if (exactKnownVehicle && ['dentro', 'activo', 'active', 'inside'].includes(getVehicleStatus(exactKnownVehicle))) {
      return setError('Ese vehiculo ya esta estacionado en el garaje.')
    }
    setLoading(true)
    setError(null)
    try {
      const data = await apiRequest('/api/parking-sessions/entry', {
        method: 'POST',
        body: {
          placa: normalizePlate(form.plate),
          conductor: form.driverName,
          propietario: form.driverName,
          tipo_vehiculo: form.vehicleType,
          tipo: form.vehicleType,
          marca: form.brand,
          modelo: form.model,
        },
      })
      if (data.success) {
        setResult(data)
        invalidateApiCache([
          '/api/dashboard/stats',
          '/api/parking-spaces',
          '/api/parking-spaces/stats',
          '/api/vehiculos',
          '/api/vehicles',
          '/api/parking-sessions',
          '/api/parking-sessions/active',
        ])
        if (onSuccess) onSuccess(data)
        // FIX: Disparar evento para actualización inmediata del dashboard
        window.dispatchEvent(new CustomEvent('dashboard-refresh'))
        window.dispatchEvent(new CustomEvent('smartpark:data-refresh'))
        setTimeout(() => {
          onClose()
        }, 2000)
      } else {
        setError(data.error || data.message || 'Error al registrar entrada')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexion con el servidor')
    } finally {
      setLoading(false)
    }
  }

  const vehicleTypes = [
    { value: 'carro', label: 'Carro' },
    { value: 'moto', label: 'Moto' },
    { value: 'camion', label: 'Camión' },
    { value: 'van', label: 'Van' },
  ]

  if (!isOpen) return null

  return (
    <div style={{
      position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',
      display:'flex',alignItems:'center',justifyContent:'center',
      zIndex:1000,padding:'16px',backdropFilter:'blur(4px)'
    }} onClick={onClose}>
      <div style={{
        background:'#1e293b',borderRadius:'20px',width:'100%',maxWidth:'480px',
        border:'1px solid rgba(255,255,255,0.1)',overflow:'hidden',maxHeight:'90vh',overflowY:'auto',
        boxShadow:'0 25px 50px rgba(0,0,0,0.5)'
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          background:'linear-gradient(135deg,#0f172a,#1e293b)',
          borderBottom:'2px solid #00d4ff',
          padding:'24px 28px',display:'flex',justifyContent:'space-between',alignItems:'center'
        }}>
          <div>
            <p style={{color:'#00d4ff',fontSize:'11px',letterSpacing:'2px',margin:'0 0 4px',textTransform:'uppercase'}}>Control de acceso</p>
            <h3 style={{color:'#fff',margin:0,fontSize:'20px',fontWeight:'700'}}>Registrar entrada</h3>
          </div>
          <button onClick={onClose} type="button" style={{
            background:'rgba(0,212,255,0.1)',border:'1px solid #00d4ff',borderRadius:'50%',
            width:'32px',height:'32px',color:'#fff',cursor:'pointer',fontSize:'16px',
            display:'flex',alignItems:'center',justifyContent:'center'
          }}>X</button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{padding:'28px'}}>

          {/* Tipo de vehículo */}
          <div style={{marginBottom:'20px'}}>
            <label style={{color:'#94a3b8',fontSize:'12px',letterSpacing:'1px',textTransform:'uppercase',display:'block',marginBottom:'10px'}}>
              Tipo de vehículo
            </label>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
              {vehicleTypes.map(v => (
                <button key={v.value} type="button"
                  onClick={() => setForm({...form, vehicleType: v.value})}
                  style={{
                    padding:'10px',borderRadius:'10px',border:'2px solid',
                    borderColor: form.vehicleType === v.value ? '#00d4ff' : '#334155',
                    background: form.vehicleType === v.value ? 'rgba(0,212,255,0.1)' : '#0f172a',
                    color: form.vehicleType === v.value ? '#00d4ff' : '#64748b',
                    cursor:'pointer',fontSize:'13px',fontWeight:'600',transition:'all 0.2s'
                  }}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Placa */}
          <div style={{marginBottom:'16px'}}>
            <label style={{color:'#94a3b8',fontSize:'12px',letterSpacing:'1px',textTransform:'uppercase',display:'block',marginBottom:'8px'}}>
              Placa del vehículo *
            </label>
            <input
              type="text" required
              value={form.plate}
              onChange={e => handlePlateChange(e.target.value)}
              placeholder="ABC1234"
              maxLength={7}
              style={{
                width:'100%',padding:'12px 16px',borderRadius:'10px',
                border:'2px solid #334155',background:'#0f172a',
                color:'#f1f5f9',fontSize:'16px',fontWeight:'700',
                letterSpacing:'4px',textAlign:'center',outline:'none',
                boxSizing:'border-box',transition:'border-color 0.2s'
              }}
              onFocus={e => e.target.style.borderColor='#00d4ff'}
              onBlur={e => e.target.style.borderColor='#334155'}
            />
            {(vehiclesLoading || plateSuggestions.length > 0 || exactKnownVehicle) && (
              <div style={{marginTop:'10px'}}>
                {vehiclesLoading && (
                  <div style={{color:'#94a3b8',fontSize:'12px'}}>Buscando placas registradas...</div>
                )}
                {exactKnownVehicle && (
                  <div style={{background:'rgba(52,211,153,0.08)',border:'1px solid rgba(52,211,153,0.35)',borderRadius:'10px',padding:'10px 12px',color:'#bbf7d0',fontSize:'12px',marginBottom:'8px'}}>
                    Placa encontrada: {getVehicleOwner(exactKnownVehicle) || 'Sin propietario'} - {getVehicleBrand(exactKnownVehicle)} {getVehicleModel(exactKnownVehicle)}
                  </div>
                )}
                {!exactKnownVehicle && plateSuggestions.length > 0 && (
                  <div style={{display:'grid',gap:'6px'}}>
                    {plateSuggestions.map((vehicle) => (
                      <button
                        key={vehicle.id || getVehiclePlate(vehicle)}
                        type="button"
                        onClick={() => applyKnownVehicle(vehicle)}
                        style={{
                          display:'flex',justifyContent:'space-between',alignItems:'center',gap:'8px',
                          padding:'9px 10px',borderRadius:'9px',border:'1px solid rgba(0,212,255,0.18)',
                          background:'#0f172a',color:'#e2e8f0',cursor:'pointer',fontSize:'12px',textAlign:'left'
                        }}
                      >
                        <strong style={{letterSpacing:'1px',color:'#00d4ff'}}>{getVehiclePlate(vehicle)}</strong>
                        <span style={{color:'#94a3b8',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                          {getVehicleOwner(vehicle) || 'Sin propietario'} - {getVehicleBrand(vehicle)} {getVehicleModel(vehicle)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Nombre conductor */}
          <div style={{marginBottom:'16px'}}>
            <label style={{color:'#94a3b8',fontSize:'12px',letterSpacing:'1px',textTransform:'uppercase',display:'block',marginBottom:'8px'}}>
              Nombre del conductor
            </label>
            <input
              type="text"
              value={form.driverName}
              onChange={e => setForm({...form, driverName: e.target.value})}
              placeholder="Nombre completo"
              style={{
                width:'100%',padding:'12px 16px',borderRadius:'10px',
                border:'2px solid #334155',background:'#0f172a',
                color:'#f1f5f9',fontSize:'14px',outline:'none',
                boxSizing:'border-box',transition:'border-color 0.2s'
              }}
              onFocus={e => e.target.style.borderColor='#00d4ff'}
              onBlur={e => e.target.style.borderColor='#334155'}
            />
          </div>

          {/* Marca y Modelo */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'20px'}}>
            <div>
              <label style={{color:'#94a3b8',fontSize:'12px',letterSpacing:'1px',textTransform:'uppercase',display:'block',marginBottom:'8px'}}>
                Marca
              </label>
              <input
                type="text"
                value={form.brand}
                onChange={e => setForm({...form, brand: e.target.value})}
                placeholder="Toyota"
                style={{
                  width:'100%',padding:'12px 16px',borderRadius:'10px',
                  border:'2px solid #334155',background:'#0f172a',
                  color:'#f1f5f9',fontSize:'14px',outline:'none',
                  boxSizing:'border-box',transition:'border-color 0.2s'
                }}
                onFocus={e => e.target.style.borderColor='#00d4ff'}
                onBlur={e => e.target.style.borderColor='#334155'}
              />
            </div>
            <div>
              <label style={{color:'#94a3b8',fontSize:'12px',letterSpacing:'1px',textTransform:'uppercase',display:'block',marginBottom:'8px'}}>
                Modelo
              </label>
              <input
                type="text"
                value={form.model}
                onChange={e => setForm({...form, model: e.target.value})}
                placeholder="Corolla"
                style={{
                  width:'100%',padding:'12px 16px',borderRadius:'10px',
                  border:'2px solid #334155',background:'#0f172a',
                  color:'#f1f5f9',fontSize:'14px',outline:'none',
                  boxSizing:'border-box',transition:'border-color 0.2s'
                }}
                onFocus={e => e.target.style.borderColor='#00d4ff'}
                onBlur={e => e.target.style.borderColor='#334155'}
              />
            </div>
          </div>

          {error && (
            <div style={{background:'rgba(239,68,68,0.1)',border:'1px solid #ef4444',borderRadius:'10px',padding:'12px',color:'#ef4444',fontSize:'13px',marginBottom:'16px'}}>
              {error}
            </div>
          )}

          {result && (
            <div style={{background:'rgba(52,211,153,0.1)',border:'1px solid #34d399',borderRadius:'10px',padding:'12px',color:'#34d399',fontSize:'13px',marginBottom:'16px'}}>
              <strong>Espacio asignado: {getAssignedSpace(result)}</strong><br/>
              <span>Placa: {result?.session?.placa || result?.session?.plate || normalizePlate(form.plate)}</span><br/>
              <span>Conductor: {result?.session?.owner_name || form.driverName || 'Sin nombre'}</span><br/>
              {result.message || 'Entrada registrada correctamente.'}
            </div>
          )}

          {/* Botones */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
            <button type="button" onClick={onClose} style={{
              padding:'14px',borderRadius:'12px',border:'2px solid #334155',
              background:'transparent',color:'#94a3b8',cursor:'pointer',
              fontSize:'14px',fontWeight:'600',transition:'all 0.2s'
            }}>
              Cerrar
            </button>
            <button type="submit" disabled={loading} style={{
              padding:'14px',borderRadius:'12px',border:'none',
              background: loading ? '#334155' : 'linear-gradient(135deg,#00b4d8,#0077b6)',
              color:'#fff',cursor: loading ? 'not-allowed' : 'pointer',
              fontSize:'14px',fontWeight:'700',transition:'all 0.2s'
            }}>
              {loading ? 'Registrando...' : 'Confirmar entrada'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
