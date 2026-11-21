import { BookOpen, CalendarDays, Check, CircleHelp, Clock3, Layers, RotateCcw, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Grade } from 'ts-fsrs'
import type { DeckProgress, Flashcard, Review, StudyMode } from '../types'
import { splitAnswerList } from '../utils/content'
import { dailyProgress, deckQueue, gradeOptions, grades, intervalLabel, localDay } from '../utils/scheduling'
import { own } from '../utils/validation'
import { SessionProgress } from './SessionProgress'

const modes = [
  { id: 'scheduled', label: 'По расписанию', icon: CalendarDays },
  { id: 'all', label: 'Пройти все заново', icon: Layers },
  { id: 'struggled', label: 'Стоит повторить', icon: RotateCcw },
] as const

const dateFormat = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' })

interface Props {
  cards: Flashcard[]
  progress: DeckProgress | undefined
  limit: number
  active: boolean
  onReview: (review: Review) => boolean
}

export function Study({ cards, progress, limit, active, onReview }: Props) {
  const [mode, setMode] = useState<StudyMode>('scheduled')
  const [now, setNow] = useState(() => new Date())
  const [practice, setPractice] = useState({ cards: [] as Flashcard[], done: 0 })
  const [sessionDone, setSessionDone] = useState(0)
  const [struggled, setStruggled] = useState<Set<string>>(() => new Set())
  const [pinnedId, setPinnedId] = useState<string | undefined>()
  const [revealed, setRevealed] = useState(false)

  const scheduled = mode === 'scheduled'
  const queue = deckQueue(cards, progress, limit, now)
  const daily = dailyProgress(progress, now)
  const availability = scheduled ? queue.cards : practice.cards.slice(practice.done)
  const card = availability.find((item) => item.id === pinnedId) ?? availability[0]
  const showingAnswer = Boolean(revealed && card?.id === pinnedId)
  const state = card && progress ? own(progress.cards, card.id) : undefined
  const estimates = showingAnswer && scheduled ? gradeOptions(state, now) : undefined
  const answerList = showingAnswer && card ? splitAnswerList(card.a) : null
  const done = scheduled ? sessionDone : practice.done

  useEffect(() => {
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime()
    const wakeAt = Math.min(queue.nextDue ?? Infinity, midnight)
    const refreshClock = () => setNow(new Date())
    const timer = window.setTimeout(refreshClock, Math.max(25, wakeAt - Date.now() + 25))
    document.addEventListener('visibilitychange', refreshClock)
    window.addEventListener('focus', refreshClock)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', refreshClock)
      window.removeEventListener('focus', refreshClock)
    }
  }, [now, queue.nextDue])

  function changeMode(next: StudyMode) {
    setMode(next)
    setRevealed(false)
    setPinnedId(undefined)
    setNow(new Date())
    if (next === 'all') setPractice({ cards, done: 0 })
    if (next === 'struggled') setPractice({ cards: cards.filter((item) => struggled.has(item.id)), done: 0 })
  }

  function flip() {
    if (!card) return
    setPinnedId(card.id)
    setRevealed(!showingAnswer)
    setNow(new Date())
  }

  function rate(grade: Grade) {
    if (!card || !showingAnswer) return
    const time = new Date()
    setNow(time)

    if (scheduled) {
      if (!onReview({ cardId: card.id, grade, now: time })) return
      setSessionDone((current) => current + 1)
    } else {
      setPractice((current) => ({ ...current, done: current.done + 1 }))
    }

    if (grade === grades[0].value || grade === grades[1].value) {
      setStruggled((current) => new Set(current).add(card.id))
    }
    setPinnedId(undefined)
    setRevealed(false)
  }

  useEffect(() => {
    if (!active) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return
      const target = event.target
      if (target instanceof HTMLElement && (
        target.isContentEditable || target.closest('input, textarea, select, dialog, [role="textbox"]')
      )) return

      if (event.code === 'Space' && !(target instanceof HTMLElement && target.closest('button, a'))) {
        if (!card) return
        event.preventDefault()
        flip()
        return
      }

      const grade = /^[1-4]$/.test(event.key) ? grades[Number(event.key) - 1] : undefined
      if (grade && showingAnswer) {
        event.preventDefault()
        rate(grade.value)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const moreToday = queue.nextDue !== undefined && localDay(new Date(queue.nextDue)) === daily.date
  const title = !cards.length ? 'В колоде пока нет карточек'
    : scheduled ? (moreToday ? 'Сейчас очередь пуста' : 'На сегодня всё')
    : mode === 'struggled' && !practice.cards.length ? 'Трудных карточек пока нет'
    : 'Тренировка завершена'

  return (
    <div className="workspace-grid">
      <section className="study-main" aria-label="Занятие">
        <SessionProgress done={done} total={done + availability.length} label="Текущая сессия" />
        {card && !showingAnswer ? (
          <button type="button" className="flashcard question-card" onClick={flip}>
            <span className="card-caption"><CircleHelp size={19} aria-hidden="true" /> Вопрос</span>
            <span className="flashcard-question">{card.q}</span>
            <span className="flashcard-footer">
              <span className="primary-button">Показать ответ</span>
              <kbd className="keyboard-hint">Пробел</kbd>
            </span>
          </button>
        ) : card ? (
          <article className="flashcard answer-card" aria-label="Ответ" aria-live="polite">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="card-caption"><BookOpen size={19} aria-hidden="true" /> Ответ</span>
              <button type="button" className="quiet-button" onClick={flip}>Скрыть ответ</button>
            </div>
            <p className="answer-question">{card.q}</p>
            {answerList ? (
              <div className="answer-text">
                {answerList.intro && <p>{answerList.intro}</p>}
                <ol>{answerList.items.map((item, index) => <li key={index}>{item}</li>)}</ol>
              </div>
            ) : <p className="answer-text">{card.a}</p>}
          </article>
        ) : (
          <div className="flashcard empty-card">
            <span className="empty-icon"><Check size={26} aria-hidden="true" /></span>
            <h2>{title}</h2>
            {scheduled && queue.nextDue !== undefined && (
              <p>Следующий повтор · {dateFormat.format(new Date(queue.nextDue))}</p>
            )}
            {scheduled && queue.newWaiting > 0 && <p>Новые карточки доступны в пределах дневного лимита.</p>}
            {mode === 'struggled' && !practice.cards.length && (
              <p>Здесь появятся карточки с оценкой «Не помню» или «Трудно» за эту сессию.</p>
            )}
            {mode !== 'scheduled' && (
              <button type="button" className="secondary-button" onClick={() => changeMode('scheduled')}>К расписанию</button>
            )}
          </div>
        )}

        {showingAnswer && (
          <div className="ratings" aria-label="Оценить ответ">
            {grades.map((grade) => (
              <button type="button" key={grade.value} className={'rating ' + grade.style} onClick={() => rate(grade.value)}>
                <span className="rating-name">{grade.label}</span>
                <span className="rating-detail">{estimates && intervalLabel(estimates[grade.value].card.due, now)}</span>
                <kbd aria-hidden="true">{grade.value}</kbd>
              </button>
            ))}
          </div>
        )}
      </section>

      <aside className="study-sidebar">
        <section className="side-panel" aria-labelledby="mode-heading">
          <h2 id="mode-heading">Режим занятия</h2>
          <div className="mode-list">
            {modes.map(({ id, label, icon: Icon }) => (
              <button type="button" key={id} aria-pressed={mode === id} onClick={() => changeMode(id)}>
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
                {id === 'struggled' && <span className="mode-count">{struggled.size}</span>}
              </button>
            ))}
          </div>
        </section>

        <section className="side-panel" aria-labelledby="today-heading">
          <h2 id="today-heading">Сегодня</h2>
          <dl className="study-stats">
            <div><dt><Clock3 size={17} aria-hidden="true" /> К повторению</dt><dd>{queue.dueCount}</dd></div>
            <div><dt><Sparkles size={17} aria-hidden="true" /> Новых пройдено</dt><dd>{daily.newDone} <span className="stat-limit">/ {limit}</span></dd></div>
            <div><dt><Check size={17} aria-hidden="true" /> Всего оценок</dt><dd>{daily.reviews}</dd></div>
          </dl>
        </section>
      </aside>
    </div>
  )
}
