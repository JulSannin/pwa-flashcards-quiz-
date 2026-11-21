import type { Card, Grade } from 'ts-fsrs'

export interface CatalogEntry {
  id: string
  name: string
  file: string
}

export interface Flashcard {
  id: string
  q: string
  a: string
}

export interface QuizQuestion {
  q: string
  options: string[]
  correct: number[]
}

export interface DeckProgress {
  cards: Record<string, Card>
  daily: {
    date: string
    newDone: number
    reviews: number
  }
}

export interface QuizScore {
  correct: number
  total: number
}

export interface Progress {
  schemaVersion: 1
  newLimits: Record<string, number>
  decks: Record<string, DeckProgress>
  quizScores: Record<string, QuizScore>
}

export type StudyMode = 'scheduled' | 'all' | 'struggled'

export interface Review {
  cardId: string
  grade: Grade
  now: Date
}
