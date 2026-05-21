import { useEffect, useMemo, useRef, useState } from 'react'

export default function useChunkedList(items, options = {}) {
  const {
    pageSize = 50,
    enabled = true,
    root = null,
    rootMargin = '180px 0px',
  } = options

  const normalizedItems = Array.isArray(items) ? items : []
  const initialCount = enabled ? pageSize : normalizedItems.length
  const [visibleCount, setVisibleCount] = useState(initialCount)
  const sentinelRef = useRef(null)

  useEffect(() => {
    setVisibleCount(enabled ? pageSize : normalizedItems.length)
  }, [enabled, normalizedItems.length, pageSize])

  const hasMore = enabled && visibleCount < normalizedItems.length

  useEffect(() => {
    if (!enabled || !hasMore || typeof IntersectionObserver === 'undefined') return undefined

    const node = sentinelRef.current
    if (!node) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (!entry?.isIntersecting) return
        setVisibleCount((current) => Math.min(current + pageSize, normalizedItems.length))
      },
      { root, rootMargin, threshold: 0.1 },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [enabled, hasMore, normalizedItems.length, pageSize, root, rootMargin])

  const visibleItems = useMemo(
    () => (enabled ? normalizedItems.slice(0, visibleCount) : normalizedItems),
    [enabled, normalizedItems, visibleCount],
  )

  return {
    hasMore,
    sentinelRef,
    totalCount: normalizedItems.length,
    visibleCount: visibleItems.length,
    visibleItems,
  }
}
