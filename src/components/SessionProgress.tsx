interface Props {
  done: number
  total: number
  label: string
}

export function SessionProgress({ done, total, label }: Props) {
  return (
    <div className="session-progress">
      <div className="flex items-center justify-between gap-3">
        <span>{label}</span>
        <span className="tabular-nums">{done} из {total}</span>
      </div>
      <progress aria-label={label} value={done} max={Math.max(1, total)} />
    </div>
  )
}
