import { createEmptyCard, fsrs, Rating, State } from 'ts-fsrs'
import type { Card } from 'ts-fsrs'
import type { DeckProgress, Flashcard } from '../types'
import { own } from './validation'

export const scheduler = fsrs({
  enable_fuzz: false,
  enable_short_term: true,
  learning_steps: ['1m', '10m'],
  relearning_steps: ['10m'],
})

export const grades = [
  { value: Rating.Again, label: 'Не помню', style: 'again' },
  { value: Rating.Hard, label: 'Трудно', style: 'hard' },
  { value: Rating.Good, label: 'Хорошо', style: 'good' },
  { value: Rating.Easy, label: 'Легко', style: 'easy' },
] as const

export const defaultNewLimit = 20

export function localDay(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

export function dailyProgress(progress: DeckProgress | undefined, now: Date): DeckProgress['daily'] {
  const date = localDay(now)
  return progress?.daily.date === date ? progress.daily : { date, newDone: 0, reviews: 0 }
}

export function deckQueue(cards: Flashcard[], progress: DeckProgress | undefined, limit: number, now: Date) {
  const due: { card: Flashcard; state: Card }[] = []
  const newCards: Flashcard[] = []
  let nextDue: number | undefined

  for (const card of cards) {
    const state = progress ? own(progress.cards, card.id) : undefined
    if (!state) newCards.push(card)
    else if (state.due <= now) due.push({ card, state })
    else nextDue = Math.min(nextDue ?? Infinity, state.due.getTime())
  }

  const priority = (state: Card) => state.state === State.Review ? 1 : 0
  due.sort((a, b) => priority(a.state) - priority(b.state) || a.state.due.getTime() - b.state.due.getTime())
  const remainingNew = Math.max(0, limit - dailyProgress(progress, now).newDone)
  const availableNew = newCards.slice(0, remainingNew)

  return {
    cards: [...due.map(({ card }) => card), ...availableNew],
    dueCount: due.length,
    newCount: availableNew.length,
    newWaiting: newCards.length - availableNew.length,
    nextDue,
  }
}

export function gradeOptions(card: Card | undefined, now: Date) {
  return scheduler.repeat(card ?? createEmptyCard(now), now)
}

export function intervalLabel(due: Date, now: Date): string {
  const minutes = Math.max(1, Math.round((due.getTime() - now.getTime()) / 60_000))
  if (minutes < 60) return minutes + ' мин'
  const hours = Math.round(minutes / 60)
  if (hours < 24) return hours + ' ч'
  return Math.round(hours / 24) + ' дн.'
}
