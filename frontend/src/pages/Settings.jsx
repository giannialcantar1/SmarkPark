import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost, apiPut, getCachedApiData } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

const roleLabels = {
  admin: 'Administrador',
  portero: 'Portero',
  usuario: 'Usuario',
}

const inputBase = {
  width: '100%',
  minWidth: 0,
  border: '1px solid rgba(148, 163, 184, 0.18)',
  background: 'rgba(2, 6, 23, 0.38)',
  color: '#e5eefb',
  borderRadius: 14,
  padding: '12px 14px',
  fontSize: 15,
  outline: 'none',
  boxSizing: 'border-box',
}

const styles = {
  page: {
    width: '100%',
    maxWidth: 1480,
    margin: '0 auto',
    padding: '14px 24px 34px',
    color: '#e5eefb',
    boxSizing: 'border-box',
  },
  topbar: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 18,
    marginBottom: 26,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 20,
    minWidth: 0,
  },
  iconButton: {
    width: 64,
    height: 64,
    flex: '0 0 64px',
    borderRadius: 20,
    border: '1px solid rgba(56, 189, 248, 0.22)',
    background: 'rgba(14, 165, 233, 0.09)',
    color: '#e5eefb',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  eyebrow: {
    margin: '0 0 8px',
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
  },
  title: {
    margin: 0,
    color: '#f8fafc',
    fontFamily: "'Syne', sans-serif",
    fontSize: 'clamp(2.1rem, 4vw, 3.2rem)',
    lineHeight: 1,
    letterSpacing: 0,
  },
  subtitle: {
    margin: '14px 0 0',
    maxWidth: 820,
    color: '#9fb4ce',
    fontSize: 17,
    lineHeight: 1.5,
  },
  notice: {
    borderRadius: 16,
    padding: '14px 16px',
    marginBottom: 16,
    fontWeight: 700,
    border: '1px solid rgba(148, 163, 184, 0.18)',
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(300px, 380px) minmax(0, 1fr)',
    gap: 24,
    alignItems: 'start',
  },
  profileCard: {
    minWidth: 0,
    borderRadius: 24,
    border: '1px solid rgba(56, 189, 248, 0.16)',
    background: 'linear-gradient(180deg, rgba(15, 35, 59, 0.96), rgba(6, 14, 30, 0.96))',
    boxShadow: '0 24px 70px rgba(2, 6, 23, 0.28)',
    padding: 28,
    position: 'sticky',
    top: 24,
    boxSizing: 'border-box',
  },
  avatarArea: {
    display: 'grid',
    justifyItems: 'center',
    gap: 14,
    marginBottom: 24,
  },
  avatarWrap: {
    width: 148,
    height: 148,
    borderRadius: '50%',
    border: '2px solid #38bdf8',
    background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.18), rgba(129, 140, 248, 0.12))',
    display: 'grid',
    placeItems: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: '50%',
  },
  avatarInitials: {
    fontFamily: "'Syne', sans-serif",
    color: '#f8fafc',
    fontSize: 44,
    fontWeight: 900,
  },
  avatarEdit: {
    position: 'absolute',
    right: 4,
    bottom: 8,
    width: 46,
    height: 46,
    borderRadius: 16,
    border: '1px solid rgba(56, 189, 248, 0.26)',
    background: '#123250',
    color: '#dbeafe',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  textButton: {
    border: 0,
    background: 'transparent',
    color: '#38bdf8',
    fontWeight: 800,
    fontSize: 15,
    cursor: 'pointer',
  },
  profileName: {
    margin: '0 0 8px',
    color: '#f8fafc',
    fontFamily: "'Syne', sans-serif",
    fontSize: 34,
    lineHeight: 1.05,
    textAlign: 'center',
    overflowWrap: 'anywhere',
  },
  profileRole: {
    margin: '0 0 24px',
    color: '#94a3b8',
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 1.4,
  },
  profileList: {
    display: 'grid',
    gap: 12,
    marginBottom: 22,
  },
  profileRow: {
    display: 'grid',
    gridTemplateColumns: '48px minmax(0, 1fr)',
    gap: 14,
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    background: 'rgba(15, 23, 42, 0.46)',
    border: '1px solid rgba(148, 163, 184, 0.12)',
  },
  rowIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    background: 'rgba(14, 165, 233, 0.16)',
    color: '#38bdf8',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    display: 'block',
    color: '#f8fafc',
    fontWeight: 800,
    lineHeight: 1.3,
    overflowWrap: 'anywhere',
  },
  rowMeta: {
    display: 'block',
    color: '#8fa4bf',
    fontSize: 13,
    lineHeight: 1.35,
    marginTop: 3,
  },
  logoutButton: {
    width: '100%',
    minHeight: 52,
    borderRadius: 16,
    border: '1px solid rgba(148, 163, 184, 0.22)',
    background: 'rgba(30, 58, 95, 0.66)',
    color: '#f8fafc',
    fontWeight: 900,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    cursor: 'pointer',
  },
  sections: {
    display: 'grid',
    gap: 18,
    minWidth: 0,
  },
  card: {
    minWidth: 0,
    borderRadius: 24,
    border: '1px solid rgba(56, 189, 248, 0.16)',
    background: 'rgba(15, 35, 59, 0.92)',
    boxShadow: '0 18px 50px rgba(2, 6, 23, 0.18)',
    padding: 28,
    boxSizing: 'border-box',
  },
  sectionHeader: {
    margin: '0 0 22px',
    color: '#f8fafc',
    fontSize: 14,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    fontWeight: 900,
  },
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: 16,
  },
  field: {
    minWidth: 0,
    display: 'grid',
    gridTemplateColumns: '56px minmax(0, 1fr)',
    gap: 14,
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    background: 'rgba(2, 6, 23, 0.2)',
    border: '1px solid rgba(148, 163, 184, 0.1)',
  },
  label: {
    display: 'block',
    marginBottom: 8,
    color: '#a8bee0',
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: '0.04em',
  },
  valueText: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 800,
    overflowWrap: 'anywhere',
  },
  helpText: {
    color: '#8fa4bf',
    fontSize: 13,
    lineHeight: 1.4,
    marginTop: 6,
  },
  codeValue: {
    display: 'block',
    padding: '12px 14px',
    borderRadius: 14,
    border: '1px solid rgba(56, 189, 248, 0.18)',
    background: 'rgba(2, 6, 23, 0.5)',
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: 800,
    overflowWrap: 'anywhere',
  },
  inlineActions: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    marginTop: 12,
  },
  secondaryButton: {
    border: '1px solid rgba(148, 163, 184, 0.2)',
    borderRadius: 14,
    minHeight: 44,
    padding: '0 16px',
    background: 'rgba(15, 23, 42, 0.6)',
    color: '#e5eefb',
    fontWeight: 800,
    cursor: 'pointer',
  },
  passwordBox: {
    display: 'grid',
    gap: 10,
  },
  primaryButton: {
    border: 0,
    borderRadius: 16,
    minHeight: 48,
    padding: '0 20px',
    background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
    color: '#06101f',
    fontWeight: 900,
    cursor: 'pointer',
  },
  dangerButton: {
    border: '1px solid rgba(248, 113, 113, 0.34)',
    borderRadius: 16,
    minHeight: 48,
    padding: '0 20px',
    background: 'rgba(127, 29, 29, 0.3)',
    color: '#fecaca',
    fontWeight: 900,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    cursor: 'pointer',
  },
  accountActions: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 12,
  },
  saveBar: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
}

const Icon = ({ name, size = 24 }) => (
  <span className="material-symbols-outlined" style={{ fontSize: size, lineHeight: 1 }} aria-hidden="true">
    {name}
  </span>
)

const InfoField = ({ icon, label, children }) => (
  <div style={styles.field}>
    <span style={styles.rowIcon}><Icon name={icon} /></span>
    <div style={{ minWidth: 0 }}>
      <span style={styles.label}>{label}</span>
      {children}
    </div>
  </div>
)

export default function Configuracion() {
  const navigate = useNavigate()
  const { user: usuario, logout } = useAuth()
  const avatarInputRef = useRef(null)
  const copyTimeoutRef = useRef(null)
  const cachedConfig = getCachedApiData('/api/configuracion')
  const [form, setForm] = useState(() => ({
    nombre: cachedConfig?.data?.nombre || '',
    telefono: cachedConfig?.data?.telefono || '',
    empresa: cachedConfig?.data?.empresa || '',
    direccion: cachedConfig?.data?.direccion || '',
    telefonoEmpresa: cachedConfig?.data?.telefonoEmpresa || '',
    tarifaHora: cachedConfig?.data?.tarifaHora || '50',
    email: cachedConfig?.data?.email || usuario?.email || '',
    rol: cachedConfig?.data?.rol || usuario?.rol || 'admin',
    avatarUrl: cachedConfig?.data?.avatarUrl || '',
    garageId: cachedConfig?.data?.garage_id || '',
    staffInvitationCode:
      cachedConfig?.data?.staffInvitationCode ||
      cachedConfig?.data?.staff_invitation_code ||
      cachedConfig?.data?.invitation_code ||
      cachedConfig?.data?.garage_id ||
      '',
  }))
  const [passwordForm, setPasswordForm] = useState({ nueva: '', confirmar: '' })
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(Boolean(cachedConfig?.data?.twoFactorEnabled))
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(cachedConfig?.data?.avatarUrl || '')
  const [loading, setLoading] = useState(!cachedConfig)
  const [saving, setSaving] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [copiedInvitationCode, setCopiedInvitationCode] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const profile = useMemo(() => {
    const emailUser = form.email?.split('@')[0] || usuario?.email?.split('@')[0] || ''
    const displayName = form.nombre?.trim() || emailUser || 'Mi Perfil'
    const initials = displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'SP'

    return {
      displayName,
      roleLabel: roleLabels[form.rol] || form.rol || 'Administrador',
      initials,
      avatar: avatarPreview || form.avatarUrl,
    }
  }, [avatarPreview, form.avatarUrl, form.email, form.nombre, form.rol, usuario?.email])

  const hydrateForm = (payload = {}) => {
    setForm((prev) => ({
      ...prev,
      nombre: payload.nombre ?? payload.nombreCompleto ?? prev.nombre,
      telefono: payload.telefono ?? prev.telefono,
      empresa: payload.empresa ?? payload.nombreEmpresa ?? prev.empresa,
      direccion: payload.direccion ?? prev.direccion,
      telefonoEmpresa: payload.telefonoEmpresa ?? payload.telefono_empresa ?? prev.telefonoEmpresa,
      tarifaHora: payload.tarifaHora ?? payload.tarifa_hora ?? prev.tarifaHora,
      email: payload.email ?? prev.email,
      rol: payload.rol ?? prev.rol,
      avatarUrl: payload.avatarUrl ?? payload.avatar_url ?? prev.avatarUrl,
      garageId: payload.garage_id ?? payload.garageId ?? prev.garageId,
      staffInvitationCode:
        payload.staffInvitationCode ??
        payload.staff_invitation_code ??
        payload.invitation_code ??
        payload.garage_id ??
        payload.garageId ??
        prev.staffInvitationCode,
    }))
    setTwoFactorEnabled(Boolean(payload.twoFactorEnabled ?? payload.two_factor_enabled ?? twoFactorEnabled))
    if (payload.avatarUrl || payload.avatar_url) {
      setAvatarPreview(payload.avatarUrl || payload.avatar_url)
    }
  }

  const cargarConfiguracion = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiGet('/api/configuracion', { forceFresh: true })
      hydrateForm(response?.data || response || {})
    } catch (err) {
      setError(err.message || 'No se pudo cargar la configuracion.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!cachedConfig) cargarConfiguracion()
  }, [])

  useEffect(() => (
    () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current)
      }
    }
  ), [])

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handlePasswordChange = (field) => (event) => {
    setPasswordForm((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleAvatarSelected = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const body = new FormData()
      body.append('nombre', form.nombre)
      body.append('telefono', form.telefono)
      body.append('empresa', form.empresa)
      body.append('direccion', form.direccion)
      body.append('telefonoEmpresa', form.telefonoEmpresa)
      body.append('tarifaHora', form.tarifaHora)
      if (avatarFile) body.append('avatar', avatarFile)
      const response = await apiPut('/api/configuracion', body)
      hydrateForm(response?.data || response || {})
      setSuccess(response?.mensaje || 'Configuracion guardada correctamente.')
      setAvatarFile(null)
    } catch (err) {
      console.error('Error guardando configuracion', err)
      setError(err.message || 'No se pudo guardar la configuracion.')
    } finally {
      setSaving(false)
    }
  }

  const handlePassword = async () => {
    if (!passwordForm.nueva || passwordForm.nueva !== passwordForm.confirmar) {
      setError('Las contrasenas no coinciden.')
      return
    }
    setChangingPassword(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await apiPost('/api/configuracion/password', { password: passwordForm.nueva })
      setSuccess(response?.mensaje || 'Contrasena actualizada correctamente.')
      setPasswordForm({ nueva: '', confirmar: '' })
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la contrasena.')
    } finally {
      setChangingPassword(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleDelete = async () => {
    if (!window.confirm('Seguro que quieres eliminar tu cuenta? Esta accion no se puede deshacer.')) return
    setDeleting(true)
    setError(null)
    try {
      await apiPost('/api/configuracion/eliminar-cuenta')
      logout()
      navigate('/login')
    } catch (err) {
      setError(err.message || 'No se pudo eliminar la cuenta.')
    } finally {
      setDeleting(false)
    }
  }

  const handleCopyInvitationCode = async () => {
    const invitationCode = String(form.staffInvitationCode || form.garageId || '').trim()
    if (!invitationCode) {
      setError('No se encontro el codigo de invitacion de este garaje.')
      return
    }

    try {
      await navigator.clipboard.writeText(invitationCode)
      setCopiedInvitationCode(true)
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current)
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopiedInvitationCode(false)
      }, 1800)
    } catch (err) {
      setError('No se pudo copiar el codigo de invitacion.')
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.topbar}>
        <div style={styles.headerLeft}>
          <button type="button" style={styles.iconButton} onClick={() => navigate(-1)} aria-label="Volver">
            <Icon name="arrow_back" size={30} />
          </button>
          <div style={{ minWidth: 0 }}>
            <p style={styles.eyebrow}>Configuracion</p>
            <h1 style={styles.title}>Mi Perfil</h1>
            <p style={styles.subtitle}>Gestiona tu informacion personal, seguridad y cuenta desde un panel claro y ordenado.</p>
          </div>
        </div>
        <button type="button" style={styles.iconButton} onClick={cargarConfiguracion} disabled={loading} aria-label="Actualizar configuracion">
          <Icon name="refresh" size={28} />
        </button>
      </header>

      {error && (
        <div style={{ ...styles.notice, background: 'rgba(127, 29, 29, 0.28)', color: '#fecaca', borderColor: 'rgba(248, 113, 113, 0.32)' }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ ...styles.notice, background: 'rgba(6, 78, 59, 0.28)', color: '#bbf7d0', borderColor: 'rgba(74, 222, 128, 0.28)' }}>
          {success}
        </div>
      )}

      <div style={styles.layout}>
        <aside style={styles.profileCard}>
          <div style={styles.avatarArea}>
            <div style={styles.avatarWrap}>
              {profile.avatar ? (
                <img src={profile.avatar} alt="Foto de perfil" style={styles.avatarImage} />
              ) : (
                <span style={styles.avatarInitials}>{profile.initials}</span>
              )}
              <button type="button" style={styles.avatarEdit} onClick={() => avatarInputRef.current?.click()} aria-label="Cambiar foto de perfil">
                <Icon name="edit" />
              </button>
            </div>
            <button type="button" style={styles.textButton} onClick={() => avatarInputRef.current?.click()}>
              Cambiar foto de perfil
            </button>
            <input ref={avatarInputRef} type="file" accept="image/*" hidden onChange={handleAvatarSelected} />
          </div>

          <h2 style={styles.profileName}>{profile.displayName}</h2>
          <p style={styles.profileRole}>{profile.roleLabel} - SmartPark</p>

          <div style={styles.profileList}>
            <div style={styles.profileRow}>
              <span style={styles.rowIcon}><Icon name="mail" /></span>
              <div style={{ minWidth: 0 }}>
                <strong style={styles.rowTitle}>{form.email || 'Sin correo'}</strong>
                <span style={styles.rowMeta}>Cuenta principal</span>
              </div>
            </div>
            <div style={styles.profileRow}>
              <span style={styles.rowIcon}><Icon name="verified_user" /></span>
              <div style={{ minWidth: 0 }}>
                <strong style={styles.rowTitle}>{profile.roleLabel}</strong>
                <span style={styles.rowMeta}>{twoFactorEnabled ? 'Verificacion reforzada activa' : 'Seguridad estandar activa'}</span>
              </div>
            </div>
          </div>

          <button type="button" style={styles.logoutButton} onClick={handleLogout}>
            <Icon name="logout" />
            Cerrar sesion
          </button>
        </aside>

        <main style={styles.sections}>
          <section style={styles.card}>
            <h2 style={styles.sectionHeader}>Informacion personal</h2>
            <div style={styles.fieldGrid}>
              <InfoField icon="person" label="Nombre completo">
                <input style={inputBase} value={form.nombre} onChange={handleChange('nombre')} placeholder="Escribe tu nombre completo" />
              </InfoField>
              <InfoField icon="mail" label="Correo electronico">
                <span style={styles.valueText}>{form.email || 'Sin correo'}</span>
              </InfoField>
              <InfoField icon="call" label="Telefono">
                <input style={inputBase} value={form.telefono} onChange={handleChange('telefono')} placeholder="Agrega tu telefono" />
              </InfoField>
            </div>
          </section>

          <section style={styles.card}>
            <h2 style={styles.sectionHeader}>Empresa</h2>
            <div style={styles.fieldGrid}>
              <InfoField icon="apartment" label="Nombre de empresa">
                <input style={inputBase} value={form.empresa} onChange={handleChange('empresa')} placeholder="Nombre de la empresa" />
              </InfoField>
              <InfoField icon="location_on" label="Direccion">
                <input style={inputBase} value={form.direccion} onChange={handleChange('direccion')} placeholder="Direccion del negocio" />
              </InfoField>
              <InfoField icon="business_center" label="Telefono de empresa">
                <input style={inputBase} value={form.telefonoEmpresa} onChange={handleChange('telefonoEmpresa')} placeholder="Telefono de la empresa" />
              </InfoField>
              <InfoField icon="payments" label="Tarifa por hora (RD$)">
                <input style={inputBase} value={form.tarifaHora} onChange={handleChange('tarifaHora')} inputMode="decimal" placeholder="50" />
              </InfoField>
              <InfoField icon="verified_user" label="Rol">
                <span style={styles.valueText}>{profile.roleLabel}</span>
                <div style={styles.helpText}>Activo</div>
              </InfoField>
            </div>
          </section>

          <section style={styles.card}>
            <h2 style={styles.sectionHeader}>Acceso de personal</h2>
            <div style={styles.fieldGrid}>
              <InfoField icon="key" label="Codigo de invitacion para personal">
                <code style={styles.codeValue}>{form.staffInvitationCode || form.garageId || 'No disponible'}</code>
                <div style={styles.helpText}>
                  Este es el `garage_id` que el personal debe pegar en `/staff-register`.
                </div>
                <div style={styles.inlineActions}>
                  <button type="button" style={styles.secondaryButton} onClick={handleCopyInvitationCode}>
                    {copiedInvitationCode ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </InfoField>
            </div>
          </section>

          <section style={styles.card}>
            <h2 style={styles.sectionHeader}>Seguridad</h2>
            <div style={styles.fieldGrid}>
              <InfoField icon="key" label="Cambiar contrasena">
                <div style={styles.passwordBox}>
                  <input style={inputBase} type="password" value={passwordForm.nueva} onChange={handlePasswordChange('nueva')} placeholder="Nueva contrasena" />
                  <input style={inputBase} type="password" value={passwordForm.confirmar} onChange={handlePasswordChange('confirmar')} placeholder="Confirmar nueva contrasena" />
                  <button type="button" style={styles.primaryButton} onClick={handlePassword} disabled={changingPassword}>
                    {changingPassword ? 'Actualizando...' : 'Actualizar contrasena'}
                  </button>
                </div>
              </InfoField>
              <InfoField icon="lock" label="Verificacion en dos pasos">
                <span style={styles.valueText}>{twoFactorEnabled ? 'Activo' : 'Inactivo'}</span>
                <div style={styles.helpText}>Estado real de tu autenticacion adicional.</div>
              </InfoField>
            </div>
          </section>

          <section style={styles.card}>
            <h2 style={styles.sectionHeader}>Cuenta</h2>
            <div style={styles.accountActions}>
              <button type="button" style={styles.logoutButton} onClick={handleLogout}>
                <Icon name="logout" />
                Cerrar sesion
              </button>
              <button type="button" style={styles.dangerButton} onClick={handleDelete} disabled={deleting}>
                <Icon name="delete" />
                {deleting ? 'Eliminando cuenta...' : 'Eliminar cuenta'}
              </button>
            </div>
          </section>

          <div style={styles.saveBar}>
            <button type="button" style={{ ...styles.primaryButton, minWidth: 190 }} onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando cambios...' : 'Guardar cambios'}
            </button>
          </div>
        </main>
      </div>
    </div>
  )
}
