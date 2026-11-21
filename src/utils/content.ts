import type { CatalogEntry, Flashcard, QuizQuestion } from '../types'
import { isCount, isRecord, isText } from './validation'

export type CatalogKind = 'decks' | 'quizzes'

export async function fetchJson(file: string, signal: AbortSignal, refresh: boolean): Promise<unknown> {
  const root = new URL(import.meta.env.BASE_URL, document.baseURI)
  const url = new URL(file, root)
  const response = await fetch(url, { signal, cache: refresh ? 'no-store' : 'no-cache' })

  if (!response.ok) throw new Error('Файл ' + file + ' недоступен (HTTP ' + response.status + ').')

  try {
    return await response.json()
  } catch (error) {
    if (signal.aborted) throw error
    throw new Error('В файле ' + file + ' некорректный JSON.')
  }
}

export function parseCatalog(value: unknown, kind: CatalogKind): CatalogEntry[] {
  const entries = isRecord(value) ? value[kind] : undefined
  if (!Array.isArray(entries)) throw new Error('Некорректный список материалов.')

  const ids = new Set<string>()
  return entries.map((row: unknown, index) => {
    if (
      !isRecord(row) || !isText(row.id) || !isText(row.name) || typeof row.file !== 'string' ||
      !/^[a-z0-9][a-z0-9_-]*$/i.test(row.id) ||
      !new RegExp('^' + kind + '/[a-z0-9_-]+\\.json$', 'i').test(row.file) ||
      ids.has(row.id)
    ) {
      throw new Error('Некорректная запись в манифесте, строка ' + (index + 1) + '.')
    }

    ids.add(row.id)
    return { id: row.id, name: row.name, file: row.file }
  })
}

function legacyCardId(question: string): string {
  let hash = 2166136261
  for (let index = 0; index < question.length; index += 1) {
    hash = Math.imul(hash ^ question.charCodeAt(index), 16777619)
  }
  return 'legacy-' + (hash >>> 0).toString(36)
}

export function parseDeck(value: unknown): Flashcard[] {
  if (!Array.isArray(value)) throw new Error('Файл колоды должен содержать массив карточек.')
  const ids = new Set<string>()

  return value.map((row: unknown, index) => {
    const q = isRecord(row) ? row.q ?? row.question ?? row.front : undefined
    const a = isRecord(row) ? row.a ?? row.answer ?? row.back : undefined
    if (!isRecord(row) || !isText(q) || !isText(a) || (row.id !== undefined && !isText(row.id))) {
      throw new Error('Некорректная карточка №' + (index + 1) + '.')
    }

    const id = row.id ?? legacyCardId(q)
    if (ids.has(id)) throw new Error('Карточки должны иметь уникальные id. Проверь карточку №' + (index + 1) + '.')
    ids.add(id)
    return { id, q, a }
  })
}

export function parseQuiz(value: unknown): QuizQuestion[] {
  if (!Array.isArray(value)) throw new Error('Файл квиза должен содержать массив вопросов.')

  return value.map((row: unknown, index) => {
    if (!isRecord(row)) throw new Error('Некорректный вопрос №' + (index + 1) + '.')
    const { q, options, correct } = row
    if (
      !isText(q) || !Array.isArray(options) || options.length < 3 || options.length > 5 ||
      !options.every(isText) || !Array.isArray(correct) || correct.length < 1 || correct.length > 3 ||
      !correct.every((answer: unknown) => isCount(answer) && answer < options.length) ||
      new Set(correct).size !== correct.length
    ) {
      throw new Error('Некорректный вопрос №' + (index + 1) + '. Ожидаются 3–5 вариантов и 1–3 индекса ответа.')
    }
    return { q, options, correct }
  })
}

export function splitAnswerList(answer: string): { intro: string; items: string[] } | null {
  const markers = [...answer.matchAll(/(?:^|\s)(\d+)[.)][ \t]+(?=\S)/g)]
  if (markers.length < 2 || markers.some((marker, index) => Number(marker[1]) !== index + 1)) return null

  const intro = answer.slice(0, markers[0].index).trim()
  const items = markers.map((marker, index) =>
    answer.slice(marker.index + marker[0].length, markers[index + 1]?.index).trim(),
  )
  return { intro, items }
}
