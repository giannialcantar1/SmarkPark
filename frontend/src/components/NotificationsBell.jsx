import { useEffect, useRef, useState } from 'react'

import useNotifications from '../hooks/useNotifications'

const formatNotificationDate = (value) => {
  if (!value) return 'Sin fecha'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'

  return new Intl.DateTimeFormat('es-DO', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default function NotificationsBell({ className = '' }) {
  const {
    notifications,
    unreadCount,
    markNotificationAsRead,
    markAllAsRead,
    refreshNotifications,
  } = useNotifications()
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const notificationsRef = useRef(null)

  useEffect(() => {
    if (!notificationsOpen) return undefined

    const handleClickOutside = (event) => {
      if (!notificationsRef.current?.contains(event.target)) {
        setNotificationsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [notificationsOpen])

  const toggleNotifications = async () => {
    const nextOpen = !notificationsOpen
    setNotificationsOpen(nextOpen)
    if (nextOpen) {
      await refreshNotifications({ forceFresh: true })
    }
  }

  const handleNotificationClick = async (notificationId) => {
    await markNotificationAsRead(notificationId)
  }

  const wrapperClassName = ['panel-notifications', className].filter(Boolean).join(' ')

  return (
    <div className={wrapperClassName} ref={notificationsRef}>
      <button
        type="button"
        className="module-icon-btn icon-with-badge panel-notifications__trigger"
        onClick={toggleNotifications}
        aria-label="Abrir notificaciones"
      >
        <span className="material-symbols-outlined">notifications</span>
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {notificationsOpen && (
        <div className="panel-notifications__dropdown">
          <div className="panel-notifications__header">
            <div>
              <strong>Notificaciones</strong>
              <small>{unreadCount} sin leer</small>
            </div>
            <button
              type="button"
              className="panel-notifications__mark-all"
              onClick={markAllAsRead}
            >
              Marcar todas
            </button>
          </div>

          <div className="panel-notifications__list">
            {notifications.length === 0 ? (
              <div className="panel-notifications__empty">No hay notificaciones registradas.</div>
            ) : (
              notifications.map((notification) => (
                <button
                  type="button"
                  key={notification.id}
                  className={`panel-notifications__item${notification.leida ? '' : ' is-unread'}`}
                  onClick={() => handleNotificationClick(notification.id)}
                >
                  <span
                    className={`panel-notifications__dot panel-notifications__dot--${notification.tipo || 'info'}`}
                  />
                  <div>
                    <strong>{notification.titulo}</strong>
                    {notification.mensaje && <p>{notification.mensaje}</p>}
                    <small>{formatNotificationDate(notification.created_at)}</small>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

