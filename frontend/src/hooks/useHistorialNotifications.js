import { useCallback, useEffect, useMemo, useState } from 'react'

import { apiGet } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

const WINDOW_MS = 24 * 60 * 60 * 1000

function toDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export default function useHistorialNotifications() {
  const { user } = useAuth()
  const [count, setCount] = useState(0)

  const storageKey = useMemo(() => {
    const identity = user?.email || 'guest'
    return `smartpark:historial-notifications:${identity}`
  }, [user?.email])

  const markAsRead = useCallback(() => {
    const now = Date.now()
    localStorage.setItem(storageKey, String(now))
    setCount(0)
  }, [storageKey])

  const refresh = useCallback(async () => {
    try {
      const payload = await apiGet('/api/vehiculos')
      const vehiculos = Array.isArray(payload?.data) ? payload.data : []
      const now = Date.now()
      const lastSeen = Number(localStorage.getItem(storageKey) || 0)
      const threshold = Math.max(now - WINDOW_MS, lastSeen)

      const unread = vehiculos.filter((vehiculo) => {
        const salida = toDate(vehiculo?.hora_salida)
        if (!salida) return false
        const timestamp = salida.getTime()
        return timestamp >= threshold && timestamp <= now
      }).length

      setCount(unread)
    } catch (error) {
      console.error('No se pudieron cargar las notificaciones del historial.', error)
    }
  }, [storageKey])

  useEffect(() => {
    refresh()
  }, [refresh])

  return {
    notificationCount: count,
    markNotificationsAsRead: markAsRead,
    refreshNotifications: refresh,
  }
}

