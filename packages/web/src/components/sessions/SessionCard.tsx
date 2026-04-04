import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import Badge from '../shared/Badge'
import type { Session } from '../../api/hooks'

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m < 60) return `${m}m ${s}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

interface SessionCardProps {
  session: Session
}

export default function SessionCard({ session }: SessionCardProps) {
  const navigate = useNavigate()

  const title = session.summary
    ? session.summary.length > 80
      ? session.summary.slice(0, 80) + '...'
      : session.summary
    : 'Untitled session'

  return (
    <div
      onClick={() => navigate(`/sessions/${session.id}`)}
      className="bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-gray-500 hover:shadow-lg cursor-pointer transition-all"
    >
      <h3 className="text-sm font-semibold text-gray-100 truncate">{title}</h3>

      <div className="mt-2 flex items-center gap-2 flex-wrap">
        {session.projectName && (
          <Badge variant="gray">{session.projectName}</Badge>
        )}
        <span className="text-xs text-gray-400">
          {format(new Date(session.startedAt), 'dd MMM yyyy HH:mm')}
        </span>
        {session.durationSeconds != null && (
          <span className="text-xs text-gray-500">
            {formatDuration(session.durationSeconds)}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <Badge variant="blue">{formatTokens(session.totalTokensIn + session.totalTokensOut)} tok</Badge>
        <Badge variant="green">{session.toolCallCount} tools</Badge>
        {session.errorCount > 0 && (
          <Badge variant="red">{session.errorCount} err</Badge>
        )}
      </div>

      {session.totalSteps > 0 && (
        <div className="mt-3 h-1.5 rounded-full bg-gray-700 overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full"
            style={{ width: '100%' }}
          />
        </div>
      )}
    </div>
  )
}
