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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun']

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

const CELL = 13, GAP = 3, STEP = CELL + GAP

  return (
    <div className="bg-card rounded-2xl p-5 border border-border">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground/80">Activity — last 12 months</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Each cell = 1 day · intensity = sessions</p>
        </div>
        <div className="flex gap-5">
          {[
            { value: totalSessions, label: 'sessions', color: 'text-blue-400' },
            { value: formatTokens(totalTokens), label: 'tokens', color: 'text-violet-400' },
            { value: activeDays, label: 'active days', color: 'text-foreground/80' },
          ].map(({ value, label, color }) => (
            <div key={label} className="text-right">
              <p className={`text-lg font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="h-28 bg-muted rounded animate-pulse" />
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
            <span className="text-xs text-muted-foreground/60">Less</span>
            {[0, 0.1, 0.3, 0.6, 0.9].map((v) => (
              <div key={v} className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: getColor(v * maxSessions, maxSessions) }} />
            ))}
            <span className="text-xs text-muted-foreground/60">More</span>
          </div>
        </div>
      )}

      {tooltip && (
        <div className="fixed z-50 bg-background border border-border rounded-lg px-3 py-2 text-xs
                        pointer-events-none shadow-xl"
          style={{ left: tooltip.x + 16, top: tooltip.y - 64 }}>
          <p className="font-semibold text-foreground mb-1">{tooltip.day}</p>
          {tooltip.sessions > 0 ? (
            <>
              <p className="text-blue-400">{tooltip.sessions} session{tooltip.sessions !== 1 ? 's' : ''}</p>
              <p className="text-violet-400">{formatTokens(tooltip.tokens)} tokens</p>
            </>
          ) : (
            <p className="text-muted-foreground">No activity</p>
          )}
        </div>
      )}
    </div>
  )
}
