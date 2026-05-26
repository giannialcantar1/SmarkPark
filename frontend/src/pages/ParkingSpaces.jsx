import { useEffect, useMemo, useState } from 'react'
import { apiDelete, apiGet, apiPost, apiPut } from '../lib/api'

const PAGE_SIZE = 6
const NIVELES = ['Todos', 'A', 'B', 'C', 'D', 'E']

export default function Parqueos() {
  const [parqueos, setParqueos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [nivelActivo, setNivelActivo] = useState('Todos')
  const [menuOpen, setMenuOpen] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [editingSpace, setEditingSpace] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ nombre: '', nivel: 'A', estado: 'disponible' })

  const loadSpaces = async () => {
    setLoading(true)
    setError(null)
    try {
      const payload = await apiGet('/api/parking-spaces')
      setParqueos(Array.isArray(payload?.data) ? payload.data : [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadSpaces() }, [])

  const filtrados = useMemo(() =>
    nivelActivo === 'Todos'
      ? parqueos
      : parqueos.filter(p => (p.nivel || p.nivel_mostrar || p.tipo) === nivelActivo),
    [parqueos, nivelActivo]
  )

  const totalPages = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE))
  const paginated = useMemo(
    () => filtrados.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtrados, page]
  )

  const handleNivel = (nivel) => {
    setNivelActivo(nivel)
    setPage(1)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const body = {
        codigo: form.nombre,
        estado: form.estado,
        tipo: form.nivel,
        nivel: form.nivel,
        piso: form.nivel,
      }
      const response = editingSpace
        ? await apiPut(`/api/parking-spaces/${editingSpace.id}`, body)
        : await apiPost('/api/parking-spaces', body)
      const nextParqueo = response?.data
      setShowModal(false)
      setEditingSpace(null)
      setForm({ nombre: '', nivel: 'A', estado: 'disponible' })
      setParqueos((current) => {
        const fallback = {
          id: editingSpace?.id || `${form.nivel}-${form.nombre}`,
          nombre: form.nombre,
          codigo: form.nombre,
          numero_mostrar: form.nombre,
          nivel_mostrar: form.nivel,
          nivel: form.nivel,
          tipo: form.nivel,
          estado: form.estado,
        }
        const item = nextParqueo || fallback
        if (editingSpace) {
          return current.map((space) => (space.id === editingSpace.id ? item : space))
        }
        return [item, ...current]
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const openCreate = () => {
    setEditingSpace(null)
    setForm({ nombre: '', nivel: 'A', estado: 'disponible' })
    setShowModal(true)
  }

  const openEdit = (parqueo) => {
    setEditingSpace(parqueo)
    setForm({
      nombre: parqueo.codigo || parqueo.numero_mostrar || parqueo.numero || parqueo.nombre || '',
      nivel: parqueo.nivel || parqueo.nivel_mostrar || parqueo.piso || parqueo.tipo || 'A',
      estado: parqueo.estado === 'ocupado' || parqueo.status === 'occupied' ? 'ocupado' : 'disponible',
    })
    setMenuOpen(null)
    setShowModal(true)
  }

  const handleToggleStatus = async (parqueo) => {
    const nextEstado = parqueo.estado === 'ocupado' || parqueo.status === 'occupied' ? 'disponible' : 'ocupado'
    setSaving(true)
    setError(null)
    try {
      const response = await apiPut(`/api/parking-spaces/${parqueo.id}`, {
        codigo: parqueo.codigo || parqueo.numero_mostrar || parqueo.numero || parqueo.nombre,
        nivel: parqueo.nivel || parqueo.nivel_mostrar || parqueo.piso || parqueo.tipo,
        estado: nextEstado,
      })
      const updated = response?.data || { ...parqueo, estado: nextEstado }
      setParqueos((current) => current.map((space) => (space.id === parqueo.id ? updated : space)))
      setMenuOpen(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (parqueo) => {
    const label = parqueo.codigo || parqueo.numero_mostrar || parqueo.numero || parqueo.nombre || 'este espacio'
    if (!window.confirm(`Eliminar ${label}?`)) return
    setSaving(true)
    setError(null)
    try {
      await apiDelete(`/api/parking-spaces/${parqueo.id}`)
      setParqueos((current) => current.filter((space) => space.id !== parqueo.id))
      setMenuOpen(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const disponibles = filtrados.filter(p => p.estado !== 'ocupado').length
  const ocupados = filtrados.filter(p => p.estado === 'ocupado').length

  return (
    <div className="parqueos-page">
      <header className="parqueos-header">
        <div>
          <p className="parqueos-kicker">Espacios Registrados</p>
          <h1>Parqueos</h1>
        </div>
        <button type="button" className="dashboard-cta" onClick={openCreate}>
          Nuevo Espacio
        </button>
      </header>

      {/* Tabs de niveles */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {NIVELES.map(nivel => (
          <button
            key={nivel}
            type="button"
            onClick={() => handleNivel(nivel)}
            style={{
              padding: '6px 18px',
              borderRadius: '20px',
              border: '1px solid',
              borderColor: nivelActivo === nivel ? '#378ADD' : 'var(--color-border-tertiary)',
              background: nivelActivo === nivel ? '#378ADD' : 'transparent',
              color: nivelActivo === nivel ? '#fff' : 'var(--color-text-secondary)',
              fontWeight: nivelActivo === nivel ? '500' : '400',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            {nivel === 'Todos' ? 'Todos los pisos' : `Piso ${nivel}`}
          </button>
        ))}
      </div>

      {/* Resumen del nivel */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '1rem' }}>
        <div style={{ background: 'var(--color-background-secondary)', borderRadius: '8px', padding: '10px 16px', fontSize: '13px' }}>
          <span style={{ color: 'var(--color-text-secondary)' }}>Disponibles: </span>
          <strong style={{ color: '#3B6D11' }}>{disponibles}</strong>
        </div>
        <div style={{ background: 'var(--color-background-secondary)', borderRadius: '8px', padding: '10px 16px', fontSize: '13px' }}>
          <span style={{ color: 'var(--color-text-secondary)' }}>Ocupados: </span>
          <strong style={{ color: '#A32D2D' }}>{ocupados}</strong>
        </div>
        <div style={{ background: 'var(--color-background-secondary)', borderRadius: '8px', padding: '10px 16px', fontSize: '13px' }}>
          <span style={{ color: 'var(--color-text-secondary)' }}>Total: </span>
          <strong>{filtrados.length}</strong>
        </div>
      </div>

      {error && <p className="auth-alert error">{error}</p>}

      <section className="parqueos-table">
        <div className="table-head">
          <span>#</span>
          <span>Ubicacion</span>
          <span>Piso</span>
          <span>Estado</span>
          <span className="text-right">Acciones</span>
        </div>

        {loading && (
          <div className="table-row empty">
            <div className="skeleton skeleton-row" />
          </div>
        )}

        {!loading && paginated.length === 0 && (
          <div className="table-row empty">No hay parqueos en este piso.</div>
        )}

        {!loading && paginated.map((parqueo) => (
          <div key={parqueo.id} className="table-row">
            <span>{parqueo.numero_mostrar || parqueo.id}</span>
            <span>{parqueo.nombre || parqueo.descripcion || 'Sin etiqueta'}</span>
            <span>
              <span style={{
                display: 'inline-block', padding: '2px 10px', borderRadius: '12px',
                background: '#E6F1FB', color: '#185FA5', fontSize: '12px', fontWeight: '500'
              }}>
                Piso {parqueo.nivel || parqueo.nivel_mostrar || parqueo.tipo || '-'}
              </span>
            </span>
            <span>
              <span className={`status-chip ${parqueo.estado === 'ocupado' ? 'awaiting' : 'ready'}`}>
                {parqueo.estado === 'ocupado' ? 'Ocupado' : 'Disponible'}
              </span>
            </span>
            <span className="text-right">
              <button
                type="button"
                className="icon-button small"
                onClick={() => setMenuOpen(menuOpen === parqueo.id ? null : parqueo.id)}
              >
                <span className="material-symbols-outlined">more_vert</span>
              </button>
              {menuOpen === parqueo.id && (
                <div className="action-menu">
                  <button type="button" onClick={() => openEdit(parqueo)}>Editar</button>
                  <button type="button" onClick={() => handleToggleStatus(parqueo)}>Cambiar estado</button>
                  <button type="button" onClick={() => handleDelete(parqueo)}>Eliminar</button>
                </div>
              )}
            </span>
          </div>
        ))}
      </section>

      <div className="pagination">
        <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))}>Anterior</button>
        <span>{page} / {totalPages}</span>
        <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Siguiente</button>
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => { setShowModal(false); setEditingSpace(null) }}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h2>{editingSpace ? 'Editar Espacio' : 'Nuevo Espacio'}</h2>
            <form onSubmit={handleSubmit}>
              <label htmlFor="parqueo-nombre">Numero / Nombre</label>
              <input
                id="parqueo-nombre"
                type="text"
                value={form.nombre}
                onChange={e => setForm({ ...form, nombre: e.target.value })}
                required
              />

              <label htmlFor="parqueo-nivel">Piso</label>
              <select
                id="parqueo-nivel"
                value={form.nivel}
                onChange={e => setForm({ ...form, nivel: e.target.value })}
              >
                {['A', 'B', 'C', 'D', 'E'].map(n => (
                  <option key={n} value={n}>Piso {n}</option>
                ))}
              </select>

              <label htmlFor="parqueo-estado">Estado</label>
              <select
                id="parqueo-estado"
                value={form.estado}
                onChange={e => setForm({ ...form, estado: e.target.value })}
              >
                <option value="disponible">Disponible</option>
                <option value="ocupado">Ocupado</option>
              </select>

              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => { setShowModal(false); setEditingSpace(null) }}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : editingSpace ? 'Guardar cambios' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
