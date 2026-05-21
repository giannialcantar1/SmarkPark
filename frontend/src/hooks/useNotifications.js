import { useCallback, useEffect, useMemo, useState } from 'react'

import { apiGet, apiPost, getCachedApiData } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

export default function useNotifications() {
  const { user } = useAuth()
  const currentGarageId = String(user?.garage_id || user?.garageId || user?.user_metadata?.garage_id || '').trim()
  const cachedPayload = getCachedApiData('/api/notificaciones')
  const [notifications, setNotifications] = useState(
    Array.isArray(cachedPayload?.data) ? cachedPayload.data : [],
  )
  const [loading, setLoading] = useState(!cachedPayload)

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification?.leida).length,
    [notifications],
  )

  const refreshNotifications = useCallback(
    async ({ showLoader = false, forceFresh = false } = {}) => {
      if (!user || !currentGarageId) {
        setNotifications([])
        setLoading(false)
        return []
      }

      if (showLoader) {
        setLoading(true)
      }

      try {
        const payload = await apiGet('/api/notificaciones', { forceFresh })
        const items = Array.isArray(payload?.data) ? payload.data : []
        setNotifications(items)
        return items
      } catch (error) {
        console.error('No se pudieron cargar las notificaciones.', error)
        return []
      } finally {
        setLoading(false)
      }
    },
    [currentGarageId, user],
  )

  const markNotificationAsRead = useCallback(async (id) => {
    if (!id) return

    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id ? { ...notification, leida: true } : notification,
      ),
    )

    try {
      await apiPost(`/api/notificaciones/${id}/leer`)
    } catch (error) {
      console.error('No se pudo marcar la notificación como leída.', error)
      refreshNotifications({ forceFresh: true })
    }
  }, [refreshNotifications])

  const markAllAsRead = useCallback(async () => {
    const unreadIds = notifications
      .filter((notification) => !notification?.leida)
      .map((notification) => notification?.id)
      .filter(Boolean)

    if (!unreadIds.length) return

    setNotifications((current) => current.map((notification) => ({ ...notification, leida: true })))

    try {
      await Promise.all(unreadIds.map((id) => apiPost(`/api/notificaciones/${id}/leer`)))
    } catch (error) {
      console.error('No se pudieron marcar todas las notificaciones como leídas.', error)
      refreshNotifications({ forceFresh: true })
    }
  }, [notifications, refreshNotifications])

  useEffect(() => {
    if (!currentGarageId) {
      setNotifications([])
      setLoading(false)
      return
    }
    refreshNotifications({ showLoader: !cachedPayload })
  }, [cachedPayload, currentGarageId, refreshNotifications])

  return {
    loading,
    notifications,
    unreadCount,
    refreshNotifications,
    markNotificationAsRead,
    markAllAsRead,
  }
}
