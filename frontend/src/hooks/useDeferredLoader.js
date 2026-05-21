import { useEffect } from 'react'

export default function useDeferredLoader(task, deps = [], { enabled = true, timeout = 250 } = {}) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined

    let cancelled = false
    const runTask = () => {
      if (cancelled) return
      Promise.resolve(task()).catch(() => null)
    }

    const idleId =
      typeof window.requestIdleCallback === 'function'
        ? window.requestIdleCallback(runTask, { timeout })
        : null
    const timeoutId = idleId === null ? window.setTimeout(runTask, timeout) : null

    return () => {
      cancelled = true
      if (idleId !== null && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId)
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, timeout, ...deps])
}
