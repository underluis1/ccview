import { useState, useMemo } from 'react'
import { useOverviewStats, useDailyCosts, useTokenAnalytics } from '../api/hooks'
import KPICards from '../components/analytics/KPICards'
import TokenChart from '../components/analytics/TokenChart'
import UsageHeatmap from '../components/analytics/UsageHeatmap'
import WasteReport from '../components/analytics/WasteReport'

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

const PRESETS = [
  { label: '7 giorni', days: 7 },
  { label: '30 giorni', days: 30 },
  { label: '90 giorni', days: 90 },
]

export default function Analytics() {
  const [from, setFrom] = useState(daysAgo(30))
  const [to, setTo] = useState(daysAgo(0))

  const filters = useMemo(() => ({ from, to, groupBy: 'day' as const }), [from, to])

  const statsQuery = useOverviewStats(filters)
  const tokensQuery = useTokenAnalytics(filters)
  useDailyCosts(filters) // prefetch

  const isLoading = statsQuery.isLoading || tokensQuery.isLoading

  return (
    <div className="p-6 space-y-6">
      {/* Heatmap — sempre visibile, anno intero */}
      <UsageHeatmap />

      {/* Filtro periodo per le statistiche di dettaglio */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-gray-400">Periodo:</span>
        {PRESETS.map((p) => (
          <button
            key={p.days}
            onClick={() => { setFrom(daysAgo(p.days)); setTo(daysAgo(0)) }}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              from === daysAgo(p.days) && to === daysAgo(0)
                ? 'bg-blue-500 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {p.label}
          </button>
        ))}
        <label className="text-sm text-gray-400 flex items-center gap-2">
          Dal
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100"
          />
        </label>
        <label className="text-sm text-gray-400 flex items-center gap-2">
          al
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100"
          />
        </label>
      </div>

      {isLoading && (
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {statsQuery.data && <KPICards stats={statsQuery.data} />}

      {/* Token chart — solo token, niente costi */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <h3 className="text-sm font-semibold text-gray-200 mb-4">Token per giorno</h3>
        <TokenChart data={tokensQuery.data ?? []} />
      </div>

      <WasteReport />
    </div>
  )
}
