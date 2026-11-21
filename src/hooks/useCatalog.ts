import { useCallback, useEffect, useRef, useState } from 'react'
import type { CatalogEntry } from '../types'
import type { CatalogKind } from '../utils/content'
import { fetchJson, parseCatalog } from '../utils/content'

interface Catalog<T> {
  entries: CatalogEntry[]
  selected: CatalogEntry | undefined
  items: T[]
  revision: number
  loading: boolean
  message: string
  error: string
}

export function useCatalog<T>(kind: CatalogKind, parse: (value: unknown) => T[]) {
  const [state, setState] = useState<Catalog<T>>({
    entries: [], selected: undefined, items: [], revision: 0, loading: true, message: '', error: '',
  })
  const currentRequest = useRef<AbortController | null>(null)

  const load = useCallback(async (selectedId?: string, entries?: CatalogEntry[], refresh = false) => {
    currentRequest.current?.abort()
    const controller = new AbortController()
    currentRequest.current = controller
    const { signal } = controller
    let catalog = entries ?? []

    setState((previous) => ({ ...previous, loading: true, error: '', message: '' }))

    try {
      if (!entries) catalog = parseCatalog(await fetchJson(kind + '.json', signal, refresh), kind)
      const selected = catalog.find((entry) => entry.id === selectedId) ?? catalog[0]
      const items = selected ? parse(await fetchJson(selected.file, signal, refresh)) : []
      if (signal.aborted) return

      setState((previous) => {
        const changed = previous.selected?.id !== selected?.id || JSON.stringify(previous.items) !== JSON.stringify(items)
        return {
          entries: catalog,
          selected,
          items,
          revision: previous.revision + Number(changed),
          loading: false,
          message: refresh ? 'Данные обновлены.' : '',
          error: '',
        }
      })
    } catch (error) {
      if (signal.aborted) return
      setState((previous) => ({
        ...previous,
        entries: previous.selected ? previous.entries : catalog,
        loading: false,
        error: error instanceof Error ? error.message : 'Не удалось загрузить материалы.',
      }))
    }
  }, [kind, parse])

  useEffect(() => {
    void load()
    return () => currentRequest.current?.abort()
  }, [load])

  return {
    ...state,
    select: (id: string) => void load(id, state.entries),
    refresh: () => void load(state.selected?.id, undefined, true),
  }
}
