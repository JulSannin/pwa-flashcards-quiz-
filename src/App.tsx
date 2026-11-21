import { AlertCircle, ClipboardList, Layers, Settings2 } from 'lucide-react'
import { useState } from 'react'
import { CatalogPicker } from './components/CatalogPicker'
import { Quiz } from './components/Quiz'
import { Settings } from './components/Settings'
import { Study } from './components/Study'
import { useCatalog } from './hooks/useCatalog'
import { useProgress } from './hooks/useProgress'
import type { Progress } from './types'
import { parseDeck, parseQuiz } from './utils/content'
import { newLimit, recordQuizScore, recordReview } from './utils/progress'
import { own } from './utils/validation'

export function App() {
  const [view, setView] = useState<'decks' | 'quizzes'>('decks')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [studyEpoch, setStudyEpoch] = useState(0)
  const [quizEpoch, setQuizEpoch] = useState(0)
  const decks = useCatalog('decks', parseDeck)
  const quizzes = useCatalog('quizzes', parseQuiz)
  const { progress, progressError, update } = useProgress()
  const showDecks = view === 'decks'
  const catalog = showDecks ? decks : quizzes
  const deck = decks.selected
  const quiz = quizzes.selected

  function importProgress(data: Progress): boolean {
    if (!update(() => data, true)) return false
    setStudyEpoch((value) => value + 1)
    setQuizEpoch((value) => value + 1)
    return true
  }

  function resetProgress(scope: 'deck' | 'all'): boolean {
    if (scope === 'deck' && !deck) return false
    const saved = update((current) => ({
      ...current,
      decks: scope === 'all' ? {} : Object.fromEntries(Object.entries(current.decks).filter(([id]) => id !== deck?.id)),
      quizScores: scope === 'all' ? {} : current.quizScores,
    }))
    if (!saved) return false
    setStudyEpoch((value) => value + 1)
    if (scope === 'all') setQuizEpoch((value) => value + 1)
    return true
  }

  return (
    <>
      <header className="app-header">
        <div className="header-inner">
          <div className="brand"><span className="brand-mark"><Layers size={22} aria-hidden="true" /></span>Повтор</div>
          <nav className="view-switch" aria-label="Раздел приложения">
            <button type="button" aria-pressed={showDecks} onClick={() => setView('decks')}><Layers size={17} aria-hidden="true" /> Флешкарточки</button>
            <button type="button" aria-pressed={!showDecks} onClick={() => setView('quizzes')}><ClipboardList size={17} aria-hidden="true" /> Квизы</button>
          </nav>
          <button type="button" className="icon-button settings-toggle" aria-label="Настройки" title="Настройки" onClick={() => setSettingsOpen(true)}>
            <Settings2 size={20} aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="page-shell">
        <div className="page-heading">
          <div>
            <h1>{showDecks ? 'Флешкарточки' : 'Квизы'}</h1>
            {catalog.selected && <p>{showDecks ? 'Карточек в колоде' : 'Вопросов в квизе'} <span className="heading-count">{catalog.items.length}</span></p>}
          </div>
          <CatalogPicker
            kind={showDecks ? 'deck' : 'quiz'}
            entries={catalog.entries} selected={catalog.selected} loading={catalog.loading}
            onSelect={catalog.select} onRefresh={catalog.refresh}
          />
        </div>

        {progressError && <div role="alert" className="notice notice-error"><AlertCircle size={18} aria-hidden="true" />{progressError}</div>}
        {catalog.error && <div role="alert" className="notice notice-error"><AlertCircle size={18} aria-hidden="true" />{catalog.error}</div>}
        {catalog.message && <p className="sr-only" role="status">{catalog.message}</p>}

        {deck && (
          <div hidden={!showDecks}>
            <Study
              key={decks.revision + ':' + studyEpoch}
              cards={decks.items}
              progress={own(progress.decks, deck.id)}
              limit={newLimit(progress, deck.id)}
              active={showDecks && !settingsOpen}
              onReview={(review) => update((current) => recordReview(current, deck.id, review))}
            />
          </div>
        )}
        {quiz && (
          <div hidden={showDecks}>
            <Quiz
              key={quizzes.revision + ':' + quizEpoch}
              questions={quizzes.items}
              best={own(progress.quizScores, quiz.id)}
              onComplete={(score) => update((current) => recordQuizScore(current, quiz.id, score))}
            />
          </div>
        )}
        {!catalog.selected && (
          <div className="flashcard empty-card" role="status">
            <h2>{catalog.loading ? 'Загрузка материалов…' : catalog.error ? 'Материалы недоступны' : 'Список пуст'}</h2>
            {!catalog.loading && catalog.error && <button type="button" className="secondary-button" onClick={catalog.refresh}>Повторить загрузку</button>}
          </div>
        )}
      </main>

      {settingsOpen && (
        <Settings
          key={deck?.id}
          deck={deck} progress={progress} onClose={() => setSettingsOpen(false)}
          onLimit={(limit) => Boolean(deck && update((current) => ({
            ...current, newLimits: { ...current.newLimits, [deck.id]: limit },
          })))}
          onImport={importProgress} onReset={resetProgress}
        />
      )}
    </>
  )
}
