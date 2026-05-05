import { useEffect, useMemo, useState } from 'react'
import { apiGet, getCachedApiData } from '../lib/api'

const formatDate = (value) => {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-DO', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(date)
}

const TIPO_META = {
  acceso_denegado: { label: 'Acceso denegado', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)' },
  login_fallido:   { label: 'Login fallido',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)' },
}

export default function AccessAlerts() {
  const cached = getCachedApiData('/api/alertas-acceso')
  const [alerts, setAlerts] = useState(Array.isArray(cached?.data) ? cached.data : [])
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const payload = await apiGet('/api/alertas-acceso', { forceFresh: true })
        setAlerts(Array.isArray(payload?.data) ? payload.data : [])
      } catch (err) {
        setError(err.message || 'No fue posible cargar las alertas.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const summary = useMemo(() => ({
    total:  alerts.length,
    denied: alerts.filter(a => a.tipo === 'acceso_denegado').length,
    failed: alerts.filter(a => a.tipo === 'login_fallido').length,
  }), [alerts])

  const stats = [
    { label: 'Total de alertas',   value: summary.total,  color: '#818cf8', desc: 'Eventos registrados' },
    { label: 'Accesos denegados',  value: summary.denied, color: '#ef4444', desc: 'Rutas bloqueadas' },
    { label: 'Logins fallidos',    value: summary.failed, color: '#f59e0b', desc: 'Autenticaciones fallidas' },
  ]

  return (
    <div style={{padding:'24px',maxWidth:'1400px',margin:'0 auto'}}>

      {/* Header */}
      <div style={{marginBottom:'28px'}}>
        <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'8px'}}>
          <div style={{width:'4px',height:'32px',background:'linear-gradient(#ef4444,#f59e0b)',borderRadius:'2px'}}/>
          <h1 style={{margin:0,fontSize:'28px',fontWeight:'700',color:'#f1f5f9'}}>Alertas de Acceso</h1>
        </div>
        <p style={{margin:0,color:'#64748b',fontSize:'14px',paddingLeft:'16px'}}>
          Revisa los intentos de acceso no autorizado y logins fallidos del sistema.
        </p>
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'16px',marginBottom:'24px'}}>
        {stats.map(s => (
          <div key={s.label} style={{
            background:'#1e293b',borderRadius:'16px',padding:'20px 24px',
            border:`1px solid ${s.color}33`,position:'relative',overflow:'hidden'
          }}>
            <div style={{position:'absolute',top:0,left:0,width:'3px',height:'100%',background:s.color,borderRadius:'16px 0 0 16px'}}/>
            <p style={{margin:'0 0 8px',color:'#64748b',fontSize:'12px',letterSpacing:'1px',textTransform:'uppercase'}}>{s.label}</p>
            <p style={{margin:'0 0 4px',fontSize:'36px',fontWeight:'800',color:s.color}}>
              {loading ? '—' : s.value}
            </p>
            <p style={{margin:0,color:'#475569',fontSize:'12px'}}>{s.desc}</p>
          </div>
        ))}
      </div>

      {error && (
        <div style={{background:'rgba(239,68,68,0.1)',border:'1px solid #ef4444',borderRadius:'12px',padding:'16px',color:'#ef4444',marginBottom:'16px'}}>
          {error}
        </div>
      )}

      {/* Table */}
      <div style={{background:'#1e293b',borderRadius:'16px',border:'1px solid #334155',overflow:'hidden'}}>
        <div style={{padding:'20px 24px',borderBottom:'1px solid #334155',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <h3 style={{margin:0,color:'#f1f5f9',fontSize:'16px',fontWeight:'600'}}>Registro de alertas</h3>
          <span style={{background:'rgba(129,140,248,0.1)',border:'1px solid rgba(129,140,248,0.3)',borderRadius:'100px',padding:'4px 12px',color:'#818cf8',fontSize:'12px'}}>
            {alerts.length} alertas
          </span>
        </div>

        {/* Table header */}
        <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1.5fr 2fr 1.5fr',gap:'16px',padding:'12px 24px',background:'#0f172a',borderBottom:'1px solid #334155'}}>
          {['Correo','Rol','Tipo','Ruta denegada','Fecha'].map(h => (
            <span key={h} style={{color:'#64748b',fontSize:'11px',letterSpacing:'1px',textTransform:'uppercase',fontWeight:'600'}}>{h}</span>
          ))}
        </div>

        {loading && (
          <div style={{padding:'48px',textAlign:'center',color:'#475569'}}>Cargando alertas...</div>
        )}

        {!loading && alerts.length === 0 && (
          <div style={{padding:'48px',textAlign:'center'}}>
            <div style={{fontSize:'48px',marginBottom:'16px',opacity:0.3}}>🔒</div>
            <p style={{color:'#475569',margin:0,fontSize:'15px'}}>No hay alertas de acceso registradas.</p>
            <p style={{color:'#334155',margin:'8px 0 0',fontSize:'13px'}}>El sistema esta funcionando sin incidentes.</p>
          </div>
        )}

        {!loading && alerts.map((alert, i) => {
          const meta = TIPO_META[alert.tipo] || TIPO_META.acceso_denegado
          return (
            <div key={alert.id} style={{
              display:'grid',gridTemplateColumns:'2fr 1fr 1.5fr 2fr 1.5fr',gap:'16px',
              padding:'14px 24px',borderBottom:'1px solid #1e293b',
              background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
              transition:'background 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(129,140,248,0.05)'}
            onMouseLeave={e => e.currentTarget.style.background= i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'}
            >
              <span style={{color:'#e2e8f0',fontSize:'13px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                {alert.email || 'Sin correo'}
              </span>
              <span style={{color:'#94a3b8',fontSize:'13px'}}>{alert.rol || 'Sin rol'}</span>
              <span>
                <span style={{
                  background:meta.bg,border:`1px solid ${meta.border}`,
                  borderRadius:'100px',padding:'3px 10px',
                  color:meta.color,fontSize:'11px',fontWeight:'600',whiteSpace:'nowrap'
                }}>
                  {meta.label}
                </span>
              </span>
              <span style={{color:'#64748b',fontSize:'12px',fontFamily:'monospace',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                {alert.ruta_denegada || 'Sin ruta'}
              </span>
              <span style={{color:'#475569',fontSize:'12px'}}>{formatDate(alert.created_at)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
