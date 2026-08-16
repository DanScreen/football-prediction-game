import { useCallback, useEffect, useState } from "react"
import { ApiError } from "@/lib/api"

/** Load remote data with loading / error / refresh helpers. */
export function useAsyncData<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const reload = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      setError(null)
      try {
        const next = await loader()
        setData(next)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Something went wrong.")
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller owns deps
    deps,
  )

  useEffect(() => {
    void reload(false)
  }, [reload])

  return { data, setData, error, loading, refreshing, reload }
}
