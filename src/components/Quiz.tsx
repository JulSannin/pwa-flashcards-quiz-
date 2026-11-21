import { Check, CircleMinus, ClipboardList, RotateCcw, Trophy, X } from 'lucide-react'
import { useState } from 'react'
import type { QuizQuestion, QuizScore } from '../types'
import { SessionProgress } from './SessionProgress'

interface Props {
  questions: QuizQuestion[]
  best: QuizScore | undefined
  onComplete: (score: QuizScore) => void
}

interface Answer {
  question: QuizQuestion
  selected: number[]
  success: boolean
}

function percent(score: QuizScore): number {
  return score.total ? Math.round(score.correct / score.total * 100) : 0
}

export function Quiz({ questions, best, onComplete }: Props) {
  const [session, setSession] = useState({ questions, retry: false })
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number[]>([])
  const [answers, setAnswers] = useState<Answer[]>([])
  const question = session.questions[index]
  const confirmed = answers[index]
  const finished = !question && session.questions.length > 0
  const score = { correct: answers.filter((answer) => answer.success).length, total: session.questions.length }
  const errors = answers.filter((answer) => !answer.success)

  function start(next: QuizQuestion[], retry: boolean) {
    setIndex(0)
    setSelected([])
    setAnswers([])
    setSession({ questions: next, retry })
  }

  function confirmAnswer() {
    if (!question || !selected.length || confirmed) return
    const success = selected.length === question.correct.length &&
      selected.every((answer) => question.correct.includes(answer))
    setAnswers((current) => [...current, { question, selected, success }])
  }

  function nextQuestion() {
    if (!confirmed) return
    const nextIndex = index + 1
    setSelected([])
    setIndex(nextIndex)
    if (nextIndex === session.questions.length && !session.retry) onComplete(score)
  }

  return (
    <div className="workspace-grid">
      <section className="study-main" aria-label="Прохождение квиза">
        {question ? (
          <>
            <SessionProgress done={answers.length} total={session.questions.length} label={session.retry ? 'Повтор ошибок' : 'Прогресс квиза'} />
            <div className="quiz-card" key={index}>
              <div className="card-caption"><ClipboardList size={19} aria-hidden="true" /> Вопрос {index + 1} из {session.questions.length}</div>
              <h2 className="quiz-question">{question.q}</h2>
              <fieldset disabled={Boolean(confirmed)} className="quiz-options">
                <legend>{question.correct.length === 1 ? 'Выбери один вариант' : 'Выбери несколько вариантов'}</legend>
                {question.options.map((option, optionIndex) => {
                  const checked = selected.includes(optionIndex)
                  const correct = question.correct.includes(optionIndex)
                  const verdict = !confirmed ? '' : correct ? (checked ? 'correct' : 'missed') : checked ? 'wrong' : ''
                  const mark = verdict === 'correct' ? 'Верно' : verdict === 'wrong' ? 'Ошибка' : 'Пропущен верный вариант'
                  return (
                    <label key={optionIndex} className={'quiz-option ' + verdict + (checked ? ' selected' : '')}>
                      <input
                        type={question.correct.length === 1 ? 'radio' : 'checkbox'}
                        name="quiz-option"
                        checked={checked}
                        onChange={() => setSelected((current) => question.correct.length === 1
                          ? [optionIndex]
                          : current.includes(optionIndex) ? current.filter((item) => item !== optionIndex) : [...current, optionIndex])}
                      />
                      <span className="quiz-option-text">{option}</span>
                      {verdict && (
                        <span className="option-verdict" title={mark}>
                          {verdict === 'correct' && <Check size={19} aria-hidden="true" />}
                          {verdict === 'wrong' && <X size={19} aria-hidden="true" />}
                          {verdict === 'missed' && <CircleMinus size={19} aria-hidden="true" />}
                          <span className="sr-only">{mark}</span>
                        </span>
                      )}
                    </label>
                  )
                })}
              </fieldset>
              <div className="quiz-actions">
                <span aria-live="polite" className={confirmed?.success ? 'text-success' : 'text-error'}>
                  {confirmed ? confirmed.success ? 'Верно' : 'Ответ не совпал' : ''}
                </span>
                {confirmed ? (
                  <button type="button" className="primary-button" onClick={nextQuestion}>{index + 1 === score.total ? 'Результаты' : 'Дальше'}</button>
                ) : (
                  <button type="button" className="primary-button" onClick={confirmAnswer} disabled={!selected.length}>Проверить</button>
                )}
              </div>
            </div>
          </>
        ) : finished ? (
          <div className="quiz-card quiz-results">
            <span className="card-caption"><Trophy size={19} aria-hidden="true" /> {session.retry ? 'Повтор ошибок завершён' : 'Квиз завершён'}</span>
            <h2>{percent(score)}%</h2>
            <p>Правильных ответов · {score.correct} из {score.total}</p>
            <div className="result-actions">
              <button type="button" className="primary-button" onClick={() => start(questions, false)}><RotateCcw size={17} aria-hidden="true" /> Пройти заново</button>
              {errors.length > 0 && (
                <button type="button" className="secondary-button" onClick={() => start(errors.map((answer) => answer.question), true)}>Повторить ошибки</button>
              )}
            </div>
            {errors.length > 0 && (
              <section className="quiz-errors" aria-labelledby="errors-heading">
                <h3 id="errors-heading">Ошибки · {errors.length}</h3>
                <ol>
                  {errors.map(({ question: item, selected: picked }, itemIndex) => (
                    <li key={itemIndex}>
                      <h4>{item.q}</h4>
                      <p>Твой ответ · {picked.map((option) => item.options[option]).join(' · ')}</p>
                      <p className="text-success">Правильно · {item.correct.map((option) => item.options[option]).join(' · ')}</p>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>
        ) : <div className="flashcard empty-card"><h2>В квизе пока нет вопросов</h2></div>}
      </section>

      <aside className="study-sidebar">
        <section className="side-panel quiz-record" aria-label="Рекорд квиза">
          <span className="empty-icon"><Trophy size={23} aria-hidden="true" /></span>
          <div><h2>Лучший результат</h2>
            <p className="record-number">{best ? percent(best) + '%' : '—'}</p>
            {best && <p className="record-detail">{best.correct} из {best.total}</p>}
          </div>
        </section>
      </aside>
    </div>
  )
}
