import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { deadlineText, type DeadlineUrgency } from '@/lib/utils'
import type { Jogo } from '@/types'

function urgencyColor(urgency: DeadlineUrgency): string {
  if (urgency === 'urgent') return 'var(--danger)'
  if (urgency === 'soon') return 'var(--highlight)'
  return 'var(--text-muted)'
}

interface DeadlineCountdownProps {
  jogo: Jogo
  todosJogos: Jogo[]
}

export function DeadlineCountdown({ jogo, todosJogos }: DeadlineCountdownProps) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 60_000)
    return () => window.clearInterval(id)
  }, [])

  void tick
  const deadline = deadlineText(jogo, todosJogos)
  if (!deadline) return null

  const pulse = deadline.urgency === 'urgent'

  return (
    <p
      className={`text-xs mt-0.5 flex items-center gap-1 ${pulse ? 'animate-pulse' : ''}`}
      style={{ color: urgencyColor(deadline.urgency) }}
    >
      <Clock size={11} />
      {deadline.text}
    </p>
  )
}
