import { Download, Settings2, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { CatalogEntry, Progress } from '../types'
import { newLimit, parseBackup } from '../utils/progress'

interface Props {
  deck?: CatalogEntry
  progress: Progress
  onClose: () => void
  onLimit: (limit: number) => boolean
  onImport: (progress: Progress) => boolean
  onReset: (scope: 'deck' | 'all') => boolean
}

type Pending = { scope: 'import'; data: Progress } | { scope: 'deck' | 'all' }

export function Settings({ deck, progress, onClose, onLimit, onImport, onReset }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const filePicker = useRef<HTMLInputElement>(null)
  const [limit, setLimit] = useState(() => deck ? String(newLimit(progress, deck.id)) : '')
  const [pending, setPending] = useState<Pending>()
  const [status, setStatus] = useState({ text: '', error: false })
  const [reading, setReading] = useState(false)

  useEffect(() => {
    const element = dialog.current
    if (element && !element.open) element.showModal()
  }, [])

  function saveLimit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = Number(limit)
    if (!deck || limit.trim() === '' || !Number.isSafeInteger(value) || value < 0) {
      setStatus({ text: 'Введи целое число от 0.', error: true })
    } else if (onLimit(value)) {
      setStatus({ text: 'Лимит сохранён.', error: false })
    } else {
      setStatus({ text: 'Не удалось сохранить лимит.', error: true })
    }
  }

  function exportBackup() {
    const file = new Blob([JSON.stringify(progress, null, 2) + '\n'], { type: 'application/json' })
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = 'povtor-progress-' + new Date().toISOString().slice(0, 10) + '.json'
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
    setStatus({ text: 'Резервная копия подготовлена.', error: false })
  }

  async function readFile(file?: File) {
    if (!file) return
    setPending(undefined)
    setReading(true)
    try {
      setPending({ scope: 'import', data: parseBackup(await file.text()) })
      setStatus({ text: '', error: false })
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : 'Не удалось прочитать файл.', error: true })
    } finally {
      setReading(false)
    }
  }

  function confirm() {
    if (!pending) return
    const imported = pending.scope === 'import'
    const success = imported ? onImport(pending.data) : onReset(pending.scope)
    if (success && imported && deck) setLimit(String(newLimit(pending.data, deck.id)))
    setPending(undefined)
    setStatus({
      text: success ? (imported ? 'Прогресс восстановлен.' : 'Прогресс сброшен.') : 'Не удалось сохранить изменения.',
      error: !success,
    })
  }

  const prompt = pending?.scope === 'import' ? 'Заменить прогресс и настройки данными из файла?'
    : pending?.scope === 'deck' ? 'Сбросить расписание и статистику колоды «' + deck?.name + '»?'
    : 'Сбросить расписание всех колод, статистику занятий и рекорды квизов?'

  return (
    <dialog ref={dialog} className="settings-dialog" aria-labelledby="settings-title" onClose={onClose}>
      <div className="settings-inner">
        <header className="settings-header">
          <div className="flex items-center gap-3">
            <span className="empty-icon"><Settings2 size={21} aria-hidden="true" /></span>
            <h2 id="settings-title">Настройки</h2>
          </div>
          <button type="button" className="icon-button" onClick={() => dialog.current?.close()} aria-label="Закрыть настройки"><X size={20} aria-hidden="true" /></button>
        </header>

        {deck && (
          <section className="settings-section" aria-labelledby="limit-title">
            <h3 id="limit-title">Новые карточки в день</h3>
            <p>{deck.name}</p>
            <form className="settings-actions" onSubmit={saveLimit}>
              <input
                type="number" min="0" step="1" required inputMode="numeric" aria-labelledby="limit-title"
                value={limit} onChange={(event) => setLimit(event.target.value)}
              />
              <button type="submit" className="secondary-button">Сохранить</button>
            </form>
          </section>
        )}

        <section className="settings-section" aria-labelledby="backup-title">
          <h3 id="backup-title">Резервная копия</h3>
          <p>Расписание, статистика, лимиты и рекорды квизов в одном JSON-файле.</p>
          <div className="settings-actions">
            <button type="button" className="secondary-button" onClick={exportBackup}><Download size={17} aria-hidden="true" /> Экспорт</button>
            <button type="button" className="secondary-button" onClick={() => filePicker.current?.click()} disabled={reading}><Upload size={17} aria-hidden="true" /> Импорт</button>
            <input type="file" accept=".json,application/json" ref={filePicker} hidden onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              event.currentTarget.value = ''
              void readFile(file)
            }} />
          </div>
        </section>

        <section className="settings-section" aria-labelledby="reset-title">
          <h3 id="reset-title">Сброс прогресса</h3>
          <div className="settings-actions">
            <button type="button" className="danger-button" disabled={!deck || reading} onClick={() => setPending({ scope: 'deck' })}>
              <Trash2 size={17} aria-hidden="true" /> Текущая колода
            </button>
            <button type="button" className="danger-button" disabled={reading} onClick={() => setPending({ scope: 'all' })}>
              Весь прогресс
            </button>
          </div>
        </section>

        {pending && (
          <div className="confirm-panel">
            <p role="status">{prompt}</p>
            <div className="settings-actions">
              <button type="button" className="secondary-button" onClick={() => setPending(undefined)}>Отмена</button>
              <button type="button" className={pending.scope === 'import' ? 'primary-button' : 'danger-button filled'} onClick={confirm}>
                {pending.scope === 'import' ? 'Восстановить' : 'Сбросить'}
              </button>
            </div>
          </div>
        )}
        {status.text && <p role={status.error ? 'alert' : 'status'} className={status.error ? 'text-error' : 'text-success'}>{status.text}</p>}
      </div>
    </dialog>
  )
}
