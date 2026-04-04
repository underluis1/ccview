import type { OverviewStats } from '../../api/hooks'

function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return String(value)
}

function formatDuration(seconds: number): string {
  if (seconds >= 3600) return `${(seconds / 3600).toFixed(1)}h`
  if (seconds >= 60) return `${Math.round(seconds / 60)}m`
  return `${Math.round(seconds)}s`
}

interface KPICardsProps {
  stats: OverviewStats
}

export default function KPICards({ stats }: KPICardsProps) {
  const totalTokens = stats.totalTokensIn + stats.totalTokensOut
  const errorPct = stats.errorRate != null ? (stats.errorRate * 100).toFixed(0) : '—'

  const cards = [
    {
      label: 'Sessioni',
      value: String(stats.totalSessions),
      detail: `durata media ${formatDuration(stats.avgSessionDuration)}`,
      color: 'text-gray-100',
    },
    {
      label: 'Token utilizzati',
      value: formatTokens(totalTokens),
      detail: `${formatTokens(stats.totalTokensIn)} in · ${formatTokens(stats.totalTokensOut)} out`,
      color: 'text-blue-400',
    },
    {
      label: 'File toccati',
      value: String(stats.uniqueFilesTouched),
      detail: `in ${stats.totalSessions} session${stats.totalSessions !== 1 ? 'i' : 'e'}`,
      color: 'text-violet-400',
    },
    {
      label: 'Progetto top',
      value: stats.topProject || '—',
      detail: `error rate ${errorPct}%`,
      color: 'text-emerald-400',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
          <div className="text-sm text-gray-400 mt-1">{card.label}</div>
          {card.detail && (
            <div className="text-xs text-gray-500 mt-1">{card.detail}</div>
          )}
        </div>
      ))}
    </div>
  )
}
