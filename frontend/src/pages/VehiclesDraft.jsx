import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { apiGet, apiPost } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

const PAGE_SIZE = 4

const FILTROS = [
  { key: 'todos', label: 'Todos' },
  { key: 'dentro', label: 'Estacionados' },
  { key: 'fuera', label: 'Ausentes' },
]

const MOCK_LINKS = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/vehiculos', label: 'Vehículos', icon: 'directions_car', active: true },
  { to: '/Reports', label: 'Usuarios', icon: 'group' },
  { to: '/Reports', label: 'Reports', icon: 'bar_chart' },
  { to: '/configuracion', label: 'Configuración', icon: 'settings' },
]

function normalizarEstado(valor) {
  const estado = String(valor || '').trim().toLowerCase()
  if (estado === 'fuera') return { key: 'fuera', label: 'Ausente' }
  return { key: 'dentro', label: 'Estacionado' }
}

function formatearFecha(valor) {
  if (!valor) return '-'
  const date = new Date(valor)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('es-DO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default function VehiculosBoceto() {
  const { user } = useAuth()
  const [vehiculos, setVehiculos] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [search, setSearch] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    placa: '',
    propietario: '',
    modelo: '',
    espacio: '',
  })

  const loadVehiculos = async () => {
    setLoading(true)
    setError(null)
    try {
      const payload = await apiGet('/api/vehiculos')
      setVehiculos(Array.isArray(payload?.data) ? payload.data : [])
    } catch (err) {
      setError(err.message || 'No fue posible cargar los vehículos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadVehiculos()
  }, [])

  const filtrados = useMemo(() => {
    const query = search.trim().toLowerCase()
    return vehiculos.filter((vehiculo) => {
      const estado = normalizarEstado(vehiculo.estado).key
      const coincideFiltro = filtro === 'todos' || estado === filtro
      const coincideBusqueda =
        !query ||
        [vehiculo.placa, vehiculo.modelo, vehiculo.propietario]
          .map((item) => String(item || '').toLowerCase())
          .some((item) => item.includes(query))

      return coincideFiltro && coincideBusqueda
    })
  }, [filtro, search, vehiculos])

  const totalPages = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE))

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages))
  }, [totalPages])

  const pageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtrados.slice(start, start + PAGE_SIZE)
  }, [filtrados, page])

  const visibleStart = filtrados.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const visibleEnd = Math.min(page * PAGE_SIZE, filtrados.length)

  const resetForm = () => {
    setForm({
      placa: '',
      propietario: '',
      modelo: '',
      espacio: '',
    })
  }

  const closeModal = () => {
    setShowModal(false)
    resetForm()
  }

  const handleRegistrar = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      await apiPost('/api/vehiculos/entrada', {
        placa: form.placa,
        propietario: form.propietario,
        modelo: form.modelo,
        espacio_id: form.espacio,
      })
      setSuccess('Vehículo agregado correctamente.')
      closeModal()
      await loadVehiculos()
    } catch (err) {
      setError(err.message || 'No se pudo registrar el vehículo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="vehiculos-boceto">
      <aside className="vehiculos-boceto__sidebar">
        <div className="vehiculos-boceto__brand">
          <div className="vehiculos-boceto__brand-icon">P</div>
          <div>
            <strong>SMARKPARK</strong>
            <span>SISTEMA DE GESTIÓN</span>
          </div>
        </div>

        <nav className="vehiculos-boceto__nav">
          {MOCK_LINKS.map((link) => (
            <Link key={`${link.label}-${link.to}`} to={link.to} className={link.active ? 'active' : ''}>
              <span className="material-symbols-outlined">{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          ))}
        </nav>

        <div className="vehiculos-boceto__admin">
          <div className="vehiculos-boceto__admin-avatar">{(user?.name?.[0] || user?.email?.[0] || 'A').toUpperCase()}</div>
          <div>
            <strong>Admin User</strong>
            <span>{user?.email || 'admin@smarkpark.com'}</span>
          </div>
        </div>
      </aside>

      <main className="vehiculos-boceto__content">
        <header className="vehiculos-boceto__header">
          <div>
            <h1>Gestión de Vehículos</h1>
            <p>Administre y monitoree el inventario de vehículos, entradas y salidas en tiempo real dentro del sistema.</p>
          </div>

          <button type="button" className="vehiculos-boceto__add" onClick={() => setShowModal(true)}>
            <span className="material-symbols-outlined">add_circle</span>
            Agregar Vehículo
          </button>
        </header>

        {error && <div className="vehiculos-boceto__alert">{error}</div>}
        {success && <div className="vehiculos-boceto__success">{success}</div>}

        <section className="vehiculos-boceto__card">
          <div className="vehiculos-boceto__toolbar">
            <label className="vehiculos-boceto__search">
              <span className="material-symbols-outlined">search</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por placa, modelo o propietario..."
              />
            </label>

            <div className="vehiculos-boceto__filters">
              {FILTROS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={filtro === item.key ? 'active' : ''}
                  onClick={() => setFiltro(item.key)}
                >
                  {item.label}
                  <span className="material-symbols-outlined">expand_more</span>
                </button>
              ))}
            </div>
          </div>

          <div className="vehiculos-boceto__table">
            <div className="vehiculos-boceto__head">
              <span>Placa</span>
              <span>Modelo</span>
              <span>Propietario</span>
              <span>Estado</span>
              <span>Última entrada</span>
              <span className="text-right">Acciones</span>
            </div>

            {loading && (
              <div className="vehiculos-boceto__loading">
                <div className="skeleton skeleton-row" />
                <div className="skeleton skeleton-row" />
                <div className="skeleton skeleton-row" />
              </div>
            )}

            {!loading && pageItems.length === 0 && <div className="vehiculos-boceto__empty">No hay vehículos registrados.</div>}

            {!loading &&
              pageItems.map((vehiculo) => {
                const estado = normalizarEstado(vehiculo.estado)
                return (
                  <div key={vehiculo.id} className="vehiculos-boceto__row">
                    <div className="vehiculos-boceto__plate">{vehiculo.placa || '---'}</div>
                    <div className="vehiculos-boceto__model">{vehiculo.modelo || 'Sin modelo'}</div>
                    <div>{vehiculo.propietario || 'Sin propietario'}</div>
                    <div>
                      <span className={`vehiculos-boceto__status ${estado.key}`}>{estado.label}</span>
                    </div>
                    <div>{formatearFecha(vehiculo.hora_entrada)}</div>
                    <button type="button" className="vehiculos-boceto__edit">
                      Editar
                    </button>
                  </div>
                )
              })}
          </div>

          <footer className="vehiculos-boceto__footer">
            <p>
              Mostrando {visibleStart} a {visibleEnd} de {filtrados.length} vehículos
            </p>

            <div className="vehiculos-boceto__pages">
              <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))}>
                ‹
              </button>
              {Array.from({ length: totalPages }).map((_, index) => {
                const current = index + 1
                return (
                  <button key={current} type="button" className={page === current ? 'active' : ''} onClick={() => setPage(current)}>
                    {current}
                  </button>
                )
              })}
              <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                ›
              </button>
            </div>
          </footer>
        </section>
      </main>

      {showModal && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="vehiculos-boceto__modal" onClick={(event) => event.stopPropagation()}>
            <h2>Agregar Vehículo</h2>

            <form onSubmit={handleRegistrar}>
              <label htmlFor="vehiculo-boceto-placa">Placa</label>
              <input
                id="vehiculo-boceto-placa"
                value={form.placa}
                onChange={(event) => setForm((current) => ({ ...current, placa: event.target.value }))}
                required
              />

              <label htmlFor="vehiculo-boceto-propietario">Propietario</label>
              <input
                id="vehiculo-boceto-propietario"
                value={form.propietario}
                onChange={(event) => setForm((current) => ({ ...current, propietario: event.target.value }))}
                required
              />

              <label htmlFor="vehiculo-boceto-modelo">Modelo</label>
              <input
                id="vehiculo-boceto-modelo"
                value={form.modelo}
                onChange={(event) => setForm((current) => ({ ...current, modelo: event.target.value }))}
              />

              <label htmlFor="vehiculo-boceto-espacio">Espacio</label>
              <input
                id="vehiculo-boceto-espacio"
                value={form.espacio}
                onChange={(event) => setForm((current) => ({ ...current, espacio: event.target.value }))}
              />

              <div className="vehiculos-boceto__modal-actions">
                <button type="button" className="ghost" onClick={closeModal}>
                  Cancelar
                </button>
                <button type="submit" className="primary" disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

