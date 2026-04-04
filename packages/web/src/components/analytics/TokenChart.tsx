import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import type { TokenAnalytics } from '../../api/hooks'

function formatToken(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`
  return String(value)
}

function formatDate(day: string): string {
  const d = new Date(day)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface CustomTooltipProps {
  active?: boolean
  payload?: { value: number; name: string; color: string }[]
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm">
      <div className="text-gray-300 mb-1">{label}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="text-gray-100" style={{ color: entry.color }}>
          {entry.name}: {formatToken(entry.value)}
        </div>
      ))}
    </div>
  )
}

interface TokenChartProps {
  data: TokenAnalytics[]
}

export default function TokenChart({ data }: TokenChartProps) {
  if (!data.length) {
    return (
      <div className="bg-gray-800 rounded-xl p-4 flex items-center justify-center h-[340px] text-gray-500">
        No token data for this period
      </div>
    )
  }

  const chartData = data.map((d) => ({
    ...d,
    dayLabel: formatDate(d.day),
  }))

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <h3 className="text-sm font-medium text-gray-400 mb-3">Tokens Usage</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="dayLabel" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis tickFormatter={formatToken} tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="totalTokens" name="Tokens" fill="#3b82f6" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
