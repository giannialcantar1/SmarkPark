import { useEffect, useState } from 'react'

import useChunkedList from '../hooks/useChunkedList'
import useDeferredLoader from '../hooks/useDeferredLoader'
import { apiGet, apiPut, getCachedApiData } from '../lib/api'
import { ROLES } from '../lib/roles'

const ROLE_OPTIONS = [
  { value: ROLES.ADMIN,   label: 'Administrador' },
  { value: ROLES.PORTERO, label: 'Portero' },
  { value: ROLES.USUARIO, label: 'Usuario' },
]

const ROLE_STYLE = {
  [ROLES.ADMIN]:   { bg: 'rgba(248,81,73,0.12)',  color: '#f85149', border: 'rgba(248,81,73,0.3)',  icon: 'shield_person' },
  [ROLES.PORTERO]: { bg: 'rgba(129,140,248,0.12)',  color: 'var(--accent2)', border: 'rgba(129,140,248,0.3)',  icon: 'security'      },
  [ROLES.USUARIO]: { bg: 'rgba(90,202,249,0.12)', color: 'var(--accent2)', border: 'rgba(90,202,249,0.3)', icon: 'person'        },
}

const formatDate = (value) => {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-DO', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(date)
}

const getInitial = (name, email) =>
  ((name || email || 'U').trim().charAt(0)).toUpperCase()

const PAGE_SIZE = 50

/* --- Palette --- */
const C = {
  bg:        'var(--bg)',
  card:      'var(--surface)',
  cardDeep:  'var(--surface2)',
  primary:   'var(--accent)',
  accent:    'var(--accent2)',
  textSoft:  'var(--text-dim)',
  border:    'var(--border)',
  borderMid: 'rgba(90,202,249,0.20)',
  success:   '#3fb950',
  danger:    '#f85149',
  warning:   'var(--accent2)',
}

const s = {
  page: {
    width: '100%', maxWidth: 1440,
    margin: '0 auto',
    fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
  },

  breadcrumb: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 12, fontWeight: 500, color: C.textSoft, marginBottom: 4,
  },
  breadcrumbAccent: { color: C.accent },
  pageTitle: {
    margin: 0,
    fontSize: 'var(--font-size-h1)',
    fontWeight: 600, fontFamily: "'Syne', sans-serif", background: 'linear-gradient(135deg, #e2e8f0 30%, var(--accent) 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
    lineHeight: 1.2, letterSpacing: '-0.5px',
  },
  pageSub: { margin: '6px 0 20px', color: C.textSoft, fontSize: 14, lineHeight: 1.55 },

  /* stats */
  statsBar: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12, marginBottom: 20,
  },
  statCard: (accent) => ({
    background: C.card,
    border: `1px solid ${C.border}`,
    borderLeft: `3px solid ${accent}`,
    borderRadius: 14,
    padding: '16px 20px',
    display: 'flex', alignItems: 'center', gap: 14,
  }),
  statIco: (accent) => ({
    width: 38, height: 38, borderRadius: 10,
    background: `${accent}18`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: accent, fontSize: 19, flexShrink: 0,
  }),
  statLabel: {
    fontSize: 12, fontWeight: 500, letterSpacing: '0.08em',
    color: C.textSoft, textTransform: 'uppercase', marginBottom: 4,
  },
  statValue: { fontSize: 30, fontWeight: 600, fontFamily: "'Syne', sans-serif", background: 'linear-gradient(135deg, #e2e8f0 30%, var(--accent) 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', lineHeight: 1.1 },

  /* feedback */
  feedbackError: {
    borderRadius: 12, padding: '12px 16px', marginBottom: 16,
    background: 'rgba(110,16,16,0.28)', border: '1px solid rgba(248,81,73,0.45)',
    color: '#ffb4b1', fontWeight: 500, fontSize: 14, lineHeight: 1.55,
    display: 'flex', alignItems: 'center', gap: 8,
  },
  feedbackSuccess: {
    borderRadius: 12, padding: '12px 16px', marginBottom: 16,
    background: 'rgba(26,127,55,0.22)', border: '1px solid rgba(63,185,80,0.38)',
    color: '#9be9a8', fontWeight: 500, fontSize: 14, lineHeight: 1.55,
    display: 'flex', alignItems: 'center', gap: 8,
  },

  /* table card */
  tableCard: {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 16, overflow: 'hidden',
  },
  tableHead: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 24px',
    borderBottom: `1px solid ${C.border}`,
  },
  tableTitle: { fontSize: 'var(--font-size-h2)', fontWeight: 600, color: '#fff', lineHeight: 1.2, margin: 0 },
  tableSub: { fontSize: 14, color: C.textSoft, lineHeight: 1.55, marginTop: 2 },
  tableCount: {
    fontSize: 12, color: C.textSoft,
    background: C.cardDeep, border: `1px solid ${C.border}`,
    borderRadius: 20, padding: '4px 12px', fontWeight: 500,
  },

  /* search */
  searchBar: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '12px 24px', borderBottom: `1px solid ${C.border}`,
  },
  searchWrap: { position: 'relative', flex: 1 },
  searchInput: {
    width: '100%',
    background: C.cardDeep, border: `1px solid ${C.borderMid}`,
    borderRadius: 8, color: '#fff',
    padding: '8px 14px 8px 36px',
    fontSize: 14, outline: 'none', fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  searchIcon: {
    position: 'absolute', left: 12, top: '50%',
    transform: 'translateY(-50%)',
    color: C.textSoft, fontSize: 16, pointerEvents: 'none',
  },

  /* col headers */
  colHeader: {
    display: 'grid',
    gridTemplateColumns: '2fr 2fr 1.4fr 1.4fr',
    padding: '10px 24px',
    background: 'rgba(5,32,62,0.6)',
    borderBottom: `1px solid ${C.border}`,
  },
  colTh: {
    fontSize: 12, fontWeight: 500, letterSpacing: '0.08em',
    color: C.textSoft, textTransform: 'uppercase',
  },

  /* row */
  tableRow: (hover) => ({
    display: 'grid',
    gridTemplateColumns: '2fr 2fr 1.4fr 1.4fr',
    padding: '14px 24px',
    borderBottom: `1px solid rgba(90,202,249,0.05)`,
    alignItems: 'center',
    background: hover ? 'rgba(9,131,200,0.04)' : 'transparent',
    transition: 'background 0.15s',
  }),

  /* user block */
  userBlock: { display: 'flex', alignItems: 'center', gap: 12 },
  avatar: (letter) => ({
    width: 38, height: 38, borderRadius: 10,
    background: 'rgba(9,131,200,0.2)',
    border: `1px solid rgba(9,131,200,0.3)`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: C.accent, fontWeight: 600, fontSize: 14,
    flexShrink: 0,
  }),
  userName: { fontSize: 14, fontWeight: 600, color: '#fff', lineHeight: 1.35 },
  userId: { fontSize: 12, color: C.textSoft, lineHeight: 1.35, marginTop: 1 },

  /* email */
  emailBlock: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontSize: 14, color: C.textSoft, lineHeight: 1.55,
  },

  /* role select */
  roleWrap: { position: 'relative', display: 'inline-flex', alignItems: 'center' },
  roleSelect: (roleVal) => {
    const t = ROLE_STYLE[roleVal] || ROLE_STYLE[ROLES.USUARIO]
    return {
      appearance: 'none',
      background: t.bg,
      color: t.color,
      border: `1px solid ${t.border}`,
      borderRadius: 20,
      padding: '5px 30px 5px 12px',
      fontSize: 12, fontWeight: 500,
      cursor: 'pointer',
      fontFamily: 'inherit',
      outline: 'none',
    }
  },
  roleArrow: {
    position: 'absolute', right: 9,
    fontSize: 14, pointerEvents: 'none',
  },
  savingSpinner: {
    width: 16, height: 16, borderRadius: '50%',
    border: '2px solid rgba(90,202,249,0.2)',
    borderTopColor: C.accent,
    animation: 'spin 0.7s linear infinite',
    flexShrink: 0,
  },

  /* date */
  tdDate: { fontSize: 12, color: C.textSoft, lineHeight: 1.35 },

  /* empty */
  empty: { padding: '52px 24px', textAlign: 'center', color: C.textSoft },
  emptyIco: {
    width: 48, height: 48, borderRadius: 12,
    background: 'rgba(9,131,200,0.1)', border: `1px solid rgba(9,131,200,0.2)`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 12px', color: C.accent, fontSize: 24,
  },

  skeleton: {
    borderRadius: 10,
    background: 'linear-gradient(90deg,#041f3a 0%,#0a3460 50%,#041f3a 100%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.25s linear infinite',
  },
}

const Icon = ({ name, size = 16 }) => (
  <span className="material-symbols-outlined"
    style={{ fontSize: size, verticalAlign: 'middle', lineHeight: 1, flexShrink: 0 }}>
    {name}
  </span>
)

export default function UserManagement() {
  const cachedUsers = getCachedApiData('/api/usuarios/')
  const cachedOverdue = getCachedApiData('/api/morosidad/usuarios')
  const [users, setUsers] = useState(Array.isArray(cachedUsers?.data) ? cachedUsers.data : [])
  const [loading, setLoading] = useState(!cachedUsers)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [savingId, setSavingId] = useState(null)
  const [search, setSearch] = useState('')
  const [hoveredRow, setHoveredRow] = useState(null)
  const [overdueUserIds, setOverdueUserIds] = useState(
    () => new Set((Array.isArray(cachedOverdue?.data) ? cachedOverdue.data : []).map((row) => String(row.user_id || ''))),
  )
  const [loadingOverdue, setLoadingOverdue] = useState(false)

  const loadUsers = async ({ showLoader = true } = {}) => {
    if (showLoader) setLoading(true)
    setError(null)
    try {
      const payload = await apiGet('/api/usuarios/', { forceFresh: true })
      setUsers(Array.isArray(payload?.data) ? payload.data : [])
    } catch (err) {
      setError(err.message || 'No fue posible cargar los usuarios.')
    } finally {
      setLoading(false)
    }
  }

  const loadOverdueUsers = async () => {
    setLoadingOverdue(true)
    try {
      const overduePayload = await apiGet('/api/morosidad/usuarios', { forceFresh: true }).catch(() => ({ data: [] }))
      const overdueRows = Array.isArray(overduePayload?.data) ? overduePayload.data : []
      setOverdueUserIds(new Set(overdueRows.map((row) => String(row.user_id || ''))))
    } finally {
      setLoadingOverdue(false)
    }
  }

  useEffect(() => {
    loadUsers({ showLoader: !cachedUsers })
  }, [])

  useDeferredLoader(
    () => loadOverdueUsers(),
    [],
    { enabled: true, timeout: 180 },
  )

  const handleRoleChange = async (userId, role) => {
    setSavingId(userId)
    setError(null); setSuccess(null)
    try {
      const payload = await apiPut(`/api/usuarios/${userId}/rol`, { role })
      const updated = payload?.data
      setUsers((cur) => cur.map((u) => (u.id === userId ? { ...u, ...updated } : u)))
      setSuccess('Rol actualizado correctamente.')
    } catch (err) {
      setError(err.message || 'No fue posible actualizar el rol.')
    } finally {
      setSavingId(null)
    }
  }

  const filteredUsers = search.trim()
    ? users.filter((u) =>
        (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(search.toLowerCase()),
      )
    : users

  const {
    hasMore,
    sentinelRef,
    visibleCount,
    visibleItems: visibleUsers,
  } = useChunkedList(filteredUsers, {
    enabled: !loading,
    pageSize: PAGE_SIZE,
  })

  const roleCounts = users.reduce((acc, u) => {
    const r = u.role || ROLES.USUARIO
    acc[r] = (acc[r] || 0) + 1
    return acc
  }, {})

  return (
    <div style={s.page}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      `}</style>

      {/* -- Header -- */}
      <div style={s.breadcrumb}>
        SmartPark
        <span style={s.breadcrumbAccent}>/</span>
        <span style={s.breadcrumbAccent}>Gestion de Usuarios</span>
      </div>
      <h1>Gestion de Usuarios</h1>
      <p style={s.pageSub}>Administra los roles del sistema y controla el acceso de cada usuario.</p>

      {/* -- Stats -- */}
      {!loading && (
        <div style={s.statsBar}>
          {[
            { label: 'Total usuarios',    value: users.length,                      icon: 'group',         accent: C.accent   },
            { label: 'Administradores',   value: roleCounts[ROLES.ADMIN]   || 0,    icon: 'shield_person', accent: C.danger   },
            { label: 'Porteros',          value: roleCounts[ROLES.PORTERO] || 0,    icon: 'security',      accent: C.warning  },
          ].map(({ label, value, icon, accent }) => (
            <div key={label} style={s.statCard(accent)}>
              <div style={s.statIco(accent)}><Icon name={icon} size={19} /></div>
              <div>
                <div style={s.statLabel}>{label}</div>
                <div style={{ ...s.statValue, color: accent === C.accent ? '#fff' : accent }}>{value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* -- Feedback -- */}
      {error && (
        <div style={s.feedbackError}><Icon name="error" size={15} />{error}</div>
      )}
      {success && (
        <div style={s.feedbackSuccess}><Icon name="check_circle" size={15} />{success}</div>
      )}

      {/* -- Table card -- */}
      <div style={s.tableCard}>

        {/* header */}
        <div style={s.tableHead}>
          <div>
            <h2 style={s.tableTitle}>Usuarios registrados</h2>
            <p style={s.tableSub}>Cambia el rol directamente desde el selector</p>
          </div>
          <span style={s.tableCount}>{filteredUsers.length} usuarios</span>
        </div>

        {/* search */}
        <div style={s.searchBar}>
          <div style={s.searchWrap}>
            <span style={s.searchIcon} className="material-symbols-outlined">search</span>
            <input
              type="text"
              placeholder="Buscar por nombre o correo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={s.searchInput}
            />
          </div>
          {loadingOverdue && (
            <span style={{ fontSize: 12, color: C.textSoft, whiteSpace: 'nowrap' }}>
              Sincronizando morosidad...
            </span>
          )}
        </div>

        {/* col headers */}
        <div style={s.colHeader}>
          {['Usuario', 'Correo', 'Rol', 'Registrado'].map((h) => (
            <span key={h} style={s.colTh}>{h}</span>
          ))}
        </div>

        {/* skeleton */}
        {loading && (
          <div style={{ padding: '16px 24px', display: 'grid', gap: 10 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ ...s.skeleton, height: 56 }} />
            ))}
          </div>
        )}

        {/* empty */}
        {!loading && filteredUsers.length === 0 && (
          <div style={s.empty}>
            <div style={s.emptyIco}><Icon name="group" size={22} /></div>
            <div style={{ fontWeight: 600, color: '#fff', marginBottom: 4 }}>
              {search ? 'No se encontraron usuarios' : 'No hay usuarios registrados'}
            </div>
            <div style={{ fontSize: 12 }}>
              {search ? 'Intenta con otro nombre o correo.' : 'Los usuarios apareceran aqui al registrarse.'}
            </div>
          </div>
        )}

        {/* rows */}
        {!loading && visibleUsers.map((user) => {
          const roleVal = user.role || ROLES.USUARIO
          const roleTheme = ROLE_STYLE[roleVal] || ROLE_STYLE[ROLES.USUARIO]
          const initial = getInitial(user.name, user.email)
          const isSaving = savingId === user.id

          return (
            <div
              key={user.id}
              style={s.tableRow(hoveredRow === user.id)}
              onMouseEnter={() => setHoveredRow(user.id)}
              onMouseLeave={() => setHoveredRow(null)}
            >
              {/* Usuario */}
              <div style={s.userBlock}>
                <div style={s.avatar()}>
                  {initial}
                </div>
                <div>
                  <div style={{ ...s.userName, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span>{user.name || user.full_name || 'Sin nombre'}</span>
                    {overdueUserIds.has(String(user.id)) && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '4px 8px',
                        borderRadius: 999,
                        background: 'rgba(127,29,29,0.28)',
                        border: '1px solid rgba(248,113,113,0.28)',
                        color: '#fecaca',
                        fontSize: 12,
                        fontWeight: 600,
                      }}>
                        Moroso
                      </span>
                    )}
                  </div>
                  <div style={s.userId}>ID: {String(user.id).slice(0, 8)}…</div>
                </div>
              </div>

              {/* Correo */}
              <span style={s.emailBlock}>
                <Icon name="mail" size={13} />
                {user.email || 'Sin correo'}
              </span>

              {/* Rol */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={s.roleWrap}>
                  <select
                    value={roleVal}
                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    disabled={isSaving}
                    style={{
                      ...s.roleSelect(roleVal),
                      opacity: isSaving ? 0.6 : 1,
                      cursor: isSaving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  {!isSaving && (
                    <span style={{ ...s.roleArrow, color: roleTheme.color }}
                      className="material-symbols-outlined">
                      expand_more
                    </span>
                  )}
                </div>
                {isSaving && <div style={s.savingSpinner} />}
              </div>

              {/* Registrado */}
              <span style={s.tdDate}>
                {formatDate(user.created_at)}
              </span>
            </div>
          )
        })}

        {!loading && filteredUsers.length > 0 && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            padding: '14px 24px',
            color: C.textSoft,
            fontSize: 12,
          }}>
            <span>Mostrando {visibleCount} de {filteredUsers.length} usuarios</span>
            {hasMore ? <span ref={sentinelRef}>Cargando mas...</span> : <span>Fin del listado</span>}
          </div>
        )}
      </div>
    </div>
  )
}




