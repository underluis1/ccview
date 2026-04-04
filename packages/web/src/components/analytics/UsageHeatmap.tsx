import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../../api/client'

interface DayData {
  day: string
  sessions: number
  totalTokens: number
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

// Usa sempre ora locale — toISOString() usa UTC e sfasa la data in Italia
function localISO(d: Date): string {
  return (
    d.getFullYear() +
    '-' + String(d.getMonth() + 1).padStart(2, '0') +
    '-' + String(d.getDate()).padStart(2, '0')
  )
}

const MONTHS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
const DAYS_LABELS = ['Lun', '', 'Mer', '', 'Ven', '', 'Dom']

function getColor(sessions: number, max: number): string {
  if (sessions === 0) return '#1f2937'
  const i = sessions / Math.max(max, 1)
  if (i < 0.15) return '#1e3a5f'
  if (i < 0.35) return '#1d4ed8'
  if (i < 0.60) return '#3b82f6'
  if (i < 0.85) return '#60a5fa'
  return '#93c5fd'
}

export default function UsageHeatmap() {
  const [tooltip, setTooltip] = useState<{
    day: string; sessions: number; tokens: number; x: number; y: number
  } | null>(null)

  const todayISO = localISO(new Date())

  const yearAgo = new Date()
  yearAgo.setFullYear(yearAgo.getFullYear() - 1)
  const fromISO = localISO(yearAgo)

  const { data, isLoading } = useQuery<DayData[]>({
    queryKey: ['heatmap', fromISO, todayISO],
    queryFn: () => apiFetch<DayData[]>(`/analytics/costs?from=${fromISO}&to=${todayISO}&groupBy=day`),
    staleTime: 60_000,
  })

  const dayMap = new Map<string, { sessions: number; tokens: number }>()
  for (const d of data ?? []) {
    // Normalizza la chiave: prendi solo YYYY-MM-DD
    dayMap.set(d.day.slice(0, 10), { sessions: d.sessions, tokens: d.totalTokens })
  }

  const maxSessions = Math.max(...(data ?? []).map((d) => d.sessions), 1)

  // Costruisce griglia 53 colonne × 7 righe
  // Parte dal lunedì più vicino a (oggi - 52 settimane)
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 52 * 7)
  const dow = startDate.getDay() // 0=dom
  startDate.setDate(startDate.getDate() + (dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow))

  const weeks: { iso: string }[][] = []
  const cur = new Date(startDate)

  for (let col = 0; col < 53; col++) {
    const week: { iso: string }[] = []
    for (let row = 0; row < 7; row++) {
      week.push({ iso: localISO(cur) })
      cur.setDate(cur.getDate() + 1)
    }
    weeks.push(week)
  }

  // Label mesi — basato sulla prima cella di ogni settimana
  const monthLabels: { label: string; col: number }[] = []
  let lastMonth = -1
  weeks.forEach((week, col) => {
    const [y, m, d] = week[0]!.iso.split('-').map(Number)
    const month = new Date(y!, m! - 1, d!).getMonth()
    if (month !== lastMonth) {
      monthLabels.push({ label: MONTHS[month]!, col })
      lastMonth = month
    }
  })

  const totalSessions = (data ?? []).reduce((s, d) => s + d.sessions, 0)
  const totalTokens   = (data ?? []).reduce((s, d) => s + d.totalTokens, 0)
  const activeDays    = (data ?? []).filter((d) => d.sessions > 0).length

  const currentStreak = (() => {
    let streak = 0
    const d = new Date()
    while (true) {
      const iso = localISO(d)
      if ((dayMap.get(iso)?.sessions ?? 0) > 0) { streak++; d.setDate(d.getDate() - 1) }
      else break
    }
    return streak
  })()

  const CELL = 13, GAP = 3, STEP = CELL + GAP

  return (
    <div className="bg-gray-800/70 rounded-2xl p-5 border border-gray-700/60">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-200">Attività — ultimi 12 mesi</h3>
          <p className="text-xs text-gray-500 mt-0.5">Ogni cella = 1 giorno · intensità = sessioni</p>
        </div>
        <div className="flex gap-5">
          {[
            { value: totalSessions, label: 'sessioni', color: 'text-blue-400' },
            { value: formatTokens(totalTokens), label: 'token', color: 'text-violet-400' },
            { value: activeDays, label: 'giorni attivi', color: 'text-gray-200' },
            { value: currentStreak, label: 'streak', color: 'text-emerald-400' },
          ].map(({ value, label, color }) => (
            <div key={label} className="text-right">
              <p className={`text-lg font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="h-28 bg-gray-700/40 rounded animate-pulse" />
      ) : (
        <div className="overflow-x-auto" onMouseLeave={() => setTooltip(null)}>
          <svg width={weeks.length * STEP + 26} height={7 * STEP + 28} className="select-none">
            {/* Month labels */}
            {monthLabels.map(({ label, col }) => (
              <text key={`${label}-${col}`} x={col * STEP + 26} y={11}
                fontSize={10} fill="#6b7280" fontFamily="ui-monospace,monospace">
                {label}
              </text>
            ))}
            {/* Day labels */}
            {DAYS_LABELS.map((label, row) =>
              label ? (
                <text key={row} x={0} y={row * STEP + 16 + CELL / 2 + 4}
                  fontSize={9} fill="#6b7280" fontFamily="ui-monospace,monospace">
                  {label}
                </text>
              ) : null
            )}
            {/* Cells */}
            {weeks.map((week, col) =>
              week.map(({ iso }, row) => {
                const isFuture = iso > todayISO
                const entry = dayMap.get(iso)
                const sessions = entry?.sessions ?? 0
                const tokens = entry?.tokens ?? 0
                return (
                  <rect
                    key={iso}
                    x={col * STEP + 26} y={row * STEP + 16}
                    width={CELL} height={CELL} rx={2}
                    fill={isFuture ? 'transparent' : getColor(sessions, maxSessions)}
                    className={isFuture ? '' : 'cursor-pointer hover:opacity-75'}
                    onMouseEnter={(e) => {
                      if (isFuture) return
                      const r = e.currentTarget.getBoundingClientRect()
                      setTooltip({ day: iso, sessions, tokens, x: r.left, y: r.top })
                    }}
                  />
                )
              })
            )}
          </svg>
          <div className="flex items-center gap-1.5 mt-1 justify-end">
            <span className="text-xs text-gray-600">Meno</span>
            {[0, 0.1, 0.3, 0.6, 0.9].map((v) => (
              <div key={v} className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: getColor(v * maxSessions, maxSessions) }} />
            ))}
            <span className="text-xs text-gray-600">Di più</span>
          </div>
        </div>
      )}

      {tooltip && (
        <div className="fixed z-50 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-xs
                        pointer-events-none shadow-xl"
          style={{ left: tooltip.x + 16, top: tooltip.y - 64 }}>
          <p className="font-semibold text-gray-100 mb-1">{tooltip.day}</p>
          {tooltip.sessions > 0 ? (
            <>
              <p className="text-blue-400">{tooltip.sessions} session{tooltip.sessions !== 1 ? 'i' : 'e'}</p>
              <p className="text-violet-400">{formatTokens(tooltip.tokens)} token</p>
            </>
          ) : (
            <p className="text-gray-500">Nessuna attività</p>
          )}
        </div>
      )}
    </div>
  )
}
