import { useCallback, useEffect, useMemo, useState } from 'react'

import { ApiError } from '../services/api'

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms))

function shouldRetry(error) {
  if (!(error instanceof ApiError)) return true
  return [408, 409, 425, 429, 502, 503, 504].includes(error.status)
}

export default function useApi(
  requestFn,
  {
    immediate = false,
    initialData = null,
    retries = 2,
    retryDelay = 500,
    immediateArgs = [],
  } = {},
) {
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(immediate)
  const [error, setError] = useState('')

  const execute = useCallback(
    async (...args) => {
      setLoading(true)
      setError('')

      let attempt = 0
      try {
        while (attempt <= retries) {
          try {
            const result = await requestFn(...args)
            setData(result)
            return result
          } catch (requestError) {
            if (attempt >= retries || !shouldRetry(requestError)) {
              setError(requestError.message || 'No se pudo completar la solicitud.')
              throw requestError
            }
            attempt += 1
            await wait(retryDelay * attempt)
          }
        }

        return null
      } finally {
        setLoading(false)
      }
    },
    [requestFn, retries, retryDelay],
  )

  const reset = useCallback(() => {
    setData(initialData)
    setLoading(false)
    setError('')
  }, [initialData])

  useEffect(() => {
    if (!immediate) return undefined

    let active = true
    execute(...immediateArgs).catch(() => {
      if (!active) return
    })

    return () => {
      active = false
    }
  }, [execute, immediate])

  return useMemo(
    () => ({
      data,
      loading,
      error,
      execute,
      setData,
      reset,
    }),
    [data, loading, error, execute, reset],
  )
}

