import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../api/client'
import UsageHeatmap from '../components/analytics/UsageHeatmap'
import type { OverviewStats, DailyCost, Session } from '../api/hooks'
import { useProjects } from '../api/hooks'

// ─── helpers ────────────────────────────────────────────────
function localISO(d: Date): string {
  return (
    d.getFullYear() +
    '-' + String(d.getMonth() + 1).padStart(2, '0') +
    '-' + String(d.getDate()).padStart(2, '0')
  )
}
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return localISO(d) }
function todayStr() { return localISO(new Date()) }

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}
function formatDuration(s: number): string {
  if (s >= 3600) return `${(s / 3600).toFixed(1)}h`
  if (s >= 60) return `${Math.round(s / 60)}m`
  return `${s}s`
}
function fmtDay(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y!, m! - 1, d!).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
}

const PERIODS = [
  { label: '7g', days: 7 },
  { label: '30g', days: 30 },
  { label: '90g', days: 90 },
]

// ─── KPI Card ───────────────────────────────────────────────
function KPI({ label, value, sub, color = 'text-gray-100' }: {
  label: string; value: string; sub?: string; color?: string
}) {
  return (
    <div className="bg-gray-800/70 rounded-2xl p-5 border border-gray-700/60">
      <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

// ─── Tooltip grafico ────────────────────────────────────────
function TokenTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const tokIn  = payload.find((p: any) => p.dataKey === 'tokensIn')?.value  ?? 0
  const tokOut = payload.find((p: any) => p.dataKey === 'tokensOut')?.value ?? 0
  return (
    <div className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-gray-200 mb-1">{label}</p>
      <p className="text-blue-400">In: {formatTokens(tokIn)}</p>
      <p className="text-violet-400">Out: {formatTokens(tokOut)}</p>
      <p className="text-gray-400 mt-1 border-t border-gray-700 pt-1">Tot: {formatTokens(tokIn + tokOut)}</p>
    </div>
  )
}

// ─── Token Chart ────────────────────────────────────────────
function TokenTrendChart({ from, to, onDayClick }: {
  from: string; to: string; onDayClick: (iso: string) => void
}) {
  const { data: tokenData, isLoading } = useQuery<{ day: string; tokensIn: number; tokensOut: number }[]>({
    queryKey: ['dashboard-tokens', from, to],
    queryFn: () => apiFetch<{ day: string; tokensIn: number; tokensOut: number }[]>(
      `/analytics/tokens?from=${from}&to=${to}&groupBy=day`
    ),
  })
  const { data: costData } = useQuery<DailyCost[]>({
    queryKey: ['dashboard-costs', from, to],
    queryFn: () => apiFetch<DailyCost[]>(`/analytics/costs?from=${from}&to=${to}&groupBy=day`),
  })

  const chartData = useMemo(() => {
    const source = tokenData ?? costData ?? []
    return source.map((d: any) => ({
      iso: d.day.slice(0, 10),          // data originale YYYY-MM-DD per la navigazione
      day: fmtDay(d.day),               // label formattata sull'asse X
      tokensIn: d.tokensIn ?? 0,
      tokensOut: d.tokensOut ?? 0,
    }))
  }, [tokenData, costData])

  if (isLoading) return <div className="h-48 bg-gray-700/40 rounded-xl animate-pulse" />
  if (!chartData.length) return (
    <div className="h-48 flex items-center justify-center text-gray-500 text-sm">Nessun dato nel periodo</div>
  )

  const barSize = chartData.length > 45 ? 3 : chartData.length > 20 ? 6 : 10
  const tickInterval = Math.max(Math.floor(chartData.length / 7) - 1, 0)

  return (
    <div className="relative">
      <p className="absolute -top-6 right-0 text-xs text-gray-600 pointer-events-none">
        clicca su un giorno per vedere le sessioni
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart
          data={chartData}
          barSize={barSize}
          margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
          onClick={(e) => {
            const iso = e?.activePayload?.[0]?.payload?.iso as string | undefined
            if (iso) onDayClick(iso)
          }}
          className="cursor-pointer"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
          <XAxis dataKey="day" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false}
            axisLine={false} interval={tickInterval} />
          <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false}
            tickFormatter={formatTokens} width={40} />
          <Tooltip content={<TokenTooltip />} cursor={{ fill: 'rgba(255,255,255,0.08)' }} />
          <Bar dataKey="tokensIn" stackId="a" fill="#3b82f6" />
          <Bar dataKey="tokensOut" stackId="a" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Top Projects ───────────────────────────────────────────
function TopProjects({ from, to }: { from: string; to: string }) {
  const { data: sessions } = useQuery<Session[]>({
    queryKey: ['top-proj-sessions', from, to],
    queryFn: () => apiFetch<Session[]>(`/sessions?from=${from}&to=${to}&limit=200`),
  })

  const top3 = useMemo(() => {
    if (!sessions?.length) return []
    const map = new Map<string, { name: string; sessions: number; tokens: number }>()
    for (const s of sessions) {
      if (!s.projectName) continue
      const cur = map.get(s.projectName) ?? { name: s.projectName, sessions: 0, tokens: 0 }
      cur.sessions++
      cur.tokens += s.totalTokensIn + s.totalTokensOut
      map.set(s.projectName, cur)
    }
    return [...map.values()].sort((a, b) => b.tokens - a.tokens).slice(0, 3)
  }, [sessions])

  const maxTokens = Math.max(...top3.map((p) => p.tokens), 1)
  const medals = ['🥇', '🥈', '🥉']
  const colors = ['#3b82f6', '#8b5cf6', '#10b981']

  if (!top3.length) {
    return (
      <div className="bg-gray-800/70 rounded-2xl p-5 border border-gray-700/60 flex items-center justify-center min-h-[160px]">
        <p className="text-sm text-gray-500">Nessun progetto nel periodo</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-800/70 rounded-2xl p-5 border border-gray-700/60 space-y-5">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Top progetti</h3>
      {top3.map((p, i) => (
        <div key={p.name}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <span>{medals[i]}</span>
              <span className="text-sm font-medium text-gray-200 truncate">{p.name}</span>
            </div>
            <div className="text-right shrink-0 ml-2">
              <span className="text-xs font-semibold text-blue-400">{formatTokens(p.tokens)}</span>
              <span className="text-xs text-gray-500 ml-1.5">{p.sessions}s</span>
            </div>
          </div>
          <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${(p.tokens / maxTokens) * 100}%`, backgroundColor: colors[i] }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main ───────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()

  const [activePeriod, setActivePeriod] = useState<number | null>(30)
  const [from, setFrom] = useState(daysAgo(30))
  const [to, setTo]   = useState(todayStr())

  const handlePeriod = useCallback((days: number) => {
    setActivePeriod(days)
    setFrom(daysAgo(days))
    setTo(todayStr())
  }, [])
  const handleFrom = useCallback((v: string) => { setFrom(v); setActivePeriod(null) }, [])
  const handleTo   = useCallback((v: string) => { setTo(v);   setActivePeriod(null) }, [])

  const { data: stats, isLoading: statsLoading } = useQuery<OverviewStats>({
    queryKey: ['overview', from, to],
    queryFn: () => apiFetch<OverviewStats>(`/stats/overview?from=${from}&to=${to}`),
  })

  const totalTokens = (stats?.totalTokensIn ?? 0) + (stats?.totalTokensOut ?? 0)

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* ── Filtri periodo ── */}
      <div className="flex flex-wrap items-center gap-3">
        {PERIODS.map((p) => (
          <button key={p.days} onClick={() => handlePeriod(p.days)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              activePeriod === p.days
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700'
            }`}>
            {p.label}
          </button>
        ))}
        <div className="flex items-center gap-2 ml-2">
          <label className="text-xs text-gray-500">Dal</label>
          <input type="date" value={from} onChange={(e) => handleFrom(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200
                       focus:outline-none focus:border-blue-500 cursor-pointer" />
          <label className="text-xs text-gray-500">al</label>
          <input type="date" value={to} onChange={(e) => handleTo(e.target.value)}
            max={todayStr()}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200
                       focus:outline-none focus:border-blue-500 cursor-pointer" />
        </div>
      </div>

      {/* ── KPI ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          [...Array(4)].map((_, i) => <div key={i} className="h-28 bg-gray-800 rounded-2xl animate-pulse" />)
        ) : (
          <>
            <KPI label="Sessioni" value={String(stats?.totalSessions ?? 0)}
              sub={`durata media ${formatDuration(stats?.avgSessionDuration ?? 0)}`} />
            <KPI label="Token usati" value={formatTokens(totalTokens)}
              sub={`${formatTokens(stats?.totalTokensIn ?? 0)} in · ${formatTokens(stats?.totalTokensOut ?? 0)} out`}
              color="text-blue-400" />
            <KPI label="File toccati" value={String(stats?.uniqueFilesTouched ?? 0)}
              sub="file unici" color="text-violet-400" />
            <KPI label="Progetto top" value={stats?.topProject ?? '—'}
              sub={`error rate ${((stats?.errorRate ?? 0) * 100).toFixed(0)}%`}
              color="text-emerald-400" />
          </>
        )}
      </div>

      {/* ── Chart + Top Projects ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-gray-800/70 rounded-2xl p-5 border border-gray-700/60">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Token per giorno</h3>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-blue-500" />Input
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-violet-500" />Output
              </span>
            </div>
          </div>
          <TokenTrendChart from={from} to={to} onDayClick={(iso) => navigate(`/sessions?from=${iso}&to=${iso}`)} />
        </div>
        <TopProjects from={from} to={to} />
      </div>

      {/* ── Heatmap ── */}
      <UsageHeatmap />

    </div>
  )
}
