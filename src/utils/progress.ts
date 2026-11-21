import { createEmptyCard, State } from 'ts-fsrs'
import type { Card } from 'ts-fsrs'
import type { DeckProgress, Progress, QuizScore, Review } from '../types'
import { dailyProgress, defaultNewLimit, scheduler } from './scheduling'
import { isCount, isRecord, own } from './validation'

export const storageKey = 'povtor.progress.v1'

export function emptyProgress(): Progress {
  return { schemaVersion: 1, newLimits: {}, decks: {}, quizScores: {} }
}

function invalid(): never {
  throw new Error('Файл прогресса повреждён или не соответствует формату резервной копии.')
}

function requireRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : invalid()
}

function requireCount(value: unknown): number {
  return isCount(value) ? value : invalid()
}

function requirePositiveNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : invalid()
}

function requireDate(value: unknown): Date {
  if (typeof value !== 'string') return invalid()
  const date = new Date(value)
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) return invalid()
  return date
}

function parseStoredCard(value: unknown): Card {
  const raw = requireRecord(value)
  const due = requireDate(raw.due)
  const lastReview = requireDate(raw.last_review)
  const state = raw.state
  if (state !== State.Learning && state !== State.Review && state !== State.Relearning) return invalid()
  if (due < lastReview) return invalid()

  return {
    due,
    last_review: lastReview,
    stability: requirePositiveNumber(raw.stability),
    difficulty: requirePositiveNumber(raw.difficulty),
    elapsed_days: requireCount(raw.elapsed_days),
    scheduled_days: requireCount(raw.scheduled_days),
    reps: requireCount(raw.reps),
    lapses: requireCount(raw.lapses),
    learning_steps: requireCount(raw.learning_steps),
    state,
  }
}

function mapRecord<T>(value: unknown, parse: (value: unknown) => T): Record<string, T> {
  return Object.fromEntries(Object.entries(requireRecord(value)).map(([key, item]) => [key, parse(item)]))
}

export function parseProgress(value: unknown): Progress {
  const raw = requireRecord(value)
  if (raw.schemaVersion !== 1) throw new Error('Эта версия резервной копии не поддерживается.')

  const decks = mapRecord(raw.decks, (value): DeckProgress => {
    const deck = requireRecord(value)
    const daily = requireRecord(deck.daily)
    if (typeof daily.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(daily.date)) return invalid()
    const newDone = requireCount(daily.newDone)
    const reviews = requireCount(daily.reviews)
    if (newDone > reviews) return invalid()

    return { cards: mapRecord(deck.cards, parseStoredCard), daily: { date: daily.date, newDone, reviews } }
  })

  const quizScores = mapRecord(raw.quizScores, (value): QuizScore => {
    const score = requireRecord(value)
    const correct = requireCount(score.correct)
    const total = requireCount(score.total)
    if (!total || correct > total) return invalid()
    return { correct, total }
  })

  return { schemaVersion: 1, newLimits: mapRecord(raw.newLimits, requireCount), decks, quizScores }
}

export function parseBackup(text: string): Progress {
  let data: unknown
  try {
    data = JSON.parse(text.replace(/^\uFEFF/, ''))
  } catch {
    throw new Error('Выбранный файл не удалось прочитать как JSON.')
  }
  return parseProgress(data)
}

export function readProgress(): Progress {
  const raw = localStorage.getItem(storageKey)
  return raw === null ? emptyProgress() : parseBackup(raw)
}

export function newLimit(progress: Progress, deckId: string): number {
  return own(progress.newLimits, deckId) ?? defaultNewLimit
}

export function recordReview(progress: Progress, deckId: string, review: Review): Progress {
  const { cardId, grade, now } = review
  const deck = own(progress.decks, deckId)
  const previous = deck ? own(deck.cards, cardId) : undefined
  const daily = dailyProgress(deck, now)

  if (previous && previous.due > now) throw new Error('Карточка уже оценена. Очередь обновлена.')
  if (!previous && daily.newDone >= newLimit(progress, deckId)) {
    throw new Error('Дневной лимит новых карточек уже достигнут.')
  }

  const { card } = scheduler.next(previous ?? createEmptyCard(now), now, grade)
  return {
    ...progress,
    decks: {
      ...progress.decks,
      [deckId]: {
        cards: { ...deck?.cards, [cardId]: card },
        daily: { date: daily.date, newDone: daily.newDone + Number(!previous), reviews: daily.reviews + 1 },
      },
    },
  }
}

export function recordQuizScore(progress: Progress, quizId: string, score: QuizScore): Progress {
  const best = own(progress.quizScores, quizId)
  if (best && best.correct * score.total >= score.correct * best.total) return progress
  return { ...progress, quizScores: { ...progress.quizScores, [quizId]: score } }
}
