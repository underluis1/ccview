import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import type { DailyCost } from '../../api/hooks'

function formatDate(day: string): string {
  const d = new Date(day)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface CustomTooltipProps {
  active?: boolean
  payload?: { value: number; payload: DailyCost }[]
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length || !payload[0]) return null
  const entry = payload[0]
  return (
    <div className="bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm">
      <div className="text-gray-300 mb-1">{label}</div>
      <div className="text-blue-400">Cost: ${entry.value.toFixed(2)}</div>
      <div className="text-gray-400">Sessions: {entry.payload.sessions}</div>
    </div>
  )
}

interface CostChartProps {
  data: DailyCost[]
}

export default function CostChart({ data }: CostChartProps) {
  if (!data.length) {
    return (
      <div className="bg-gray-800 rounded-xl p-4 flex items-center justify-center h-[340px] text-gray-500">
        No cost data for this period
      </div>
    )
  }

  const chartData = data.map((d) => ({
    ...d,
    dayLabel: formatDate(d.day),
  }))

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <h3 className="text-sm font-medium text-gray-400 mb-3">Daily Cost</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="dayLabel" tick={{ fill: '#9ca3af', fontSize: 12 }} />
          <YAxis
            tickFormatter={(v: number) => `$${v.toFixed(2)}`}
            tick={{ fill: '#9ca3af', fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="totalCost"
            stroke="#3b82f6"
            fill="url(#costGradient)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
