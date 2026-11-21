import { useEffect, useState } from 'react'
import type { Progress } from '../types'
import { emptyProgress, readProgress, storageKey } from '../utils/progress'

function loadInitial() {
  try {
    return { value: readProgress(), error: '' }
  } catch {
    return { value: emptyProgress(), error: 'Не удалось прочитать сохранённый прогресс. Можно восстановить его из копии.' }
  }
}

export function useProgress() {
  const [{ value, error }, setState] = useState(loadInitial)

  useEffect(() => {
    function sync(event: StorageEvent) {
      if (event.storageArea === localStorage && (event.key === storageKey || event.key === null)) {
        setState(loadInitial())
      }
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  function update(change: (current: Progress) => Progress, replace = false): boolean {
    let current = value
    let next: Progress
    try {
      if (!replace) current = readProgress()
      next = change(current)
    } catch (error) {
      setState({ value: current, error: error instanceof Error ? error.message : 'Не удалось обновить прогресс.' })
      return false
    }

    try {
      if (next !== current || replace) localStorage.setItem(storageKey, JSON.stringify(next))
      setState({ value: next, error: '' })
      return true
    } catch {
      setState({ value: current, error: 'Браузер не смог сохранить прогресс.' })
      return false
    }
  }

  return { progress: value, progressError: error, update }
}
