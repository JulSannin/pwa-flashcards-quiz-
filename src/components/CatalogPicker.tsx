import { ChevronDown, RefreshCw } from 'lucide-react'
import type { CatalogEntry } from '../types'

interface Props {
  kind: 'deck' | 'quiz'
  entries: CatalogEntry[]
  selected?: CatalogEntry
  loading: boolean
  onSelect: (id: string) => void
  onRefresh: () => void
}

export function CatalogPicker({ kind, entries, selected, loading, onSelect, onRefresh }: Props) {
  const label = kind === 'deck' ? 'Колода' : 'Квиз'
  const refreshLabel = kind === 'deck' ? 'Обновить колоды' : 'Обновить квизы'

  return (
    <div className="catalog-picker">
      <label className="sr-only" htmlFor={kind + '-picker'}>{label}</label>
      <div className="select-wrap">
        <select
          id={kind + '-picker'}
          value={selected?.id ?? ''}
          disabled={loading || !entries.length}
          onChange={(event) => onSelect(event.target.value)}
        >
          {!selected && <option value="" disabled>{loading ? 'Загрузка…' : 'Выбрать набор'}</option>}
          {entries.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
        </select>
        <ChevronDown size={17} aria-hidden="true" />
      </div>
      <button type="button" className="icon-button" disabled={loading} onClick={onRefresh} aria-label={refreshLabel} title={refreshLabel}>
        <RefreshCw size={17} aria-hidden="true" />
      </button>
    </div>
  )
}
