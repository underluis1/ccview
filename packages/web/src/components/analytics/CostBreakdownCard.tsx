import type { CostBreakdown } from '../../api/hooks'

// Prezzi Sonnet 4.6 (modello prevalente) per stima
const PRICING = {
  inputPer1M: 3.0,
  cacheWritePer1M: 3.75,
  cacheReadPer1M: 0.30,
  outputPer1M: 15.0,
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function usd(n: number): string {
  return `$${n.toFixed(2)}`
}

interface Props {
  data: CostBreakdown | undefined
  isLoading: boolean
}

export default function CostBreakdownCard({ data, isLoading }: Props) {
  if (isLoading) {
    return <div className="bg-gray-800/70 rounded-2xl p-5 border border-gray-700/60 h-64 animate-pulse" />
  }

  if (!data) return null

  const costInput = (data.regularInputTokens / 1_000_000) * PRICING.inputPer1M
  const costWrite = (data.cacheWriteTokens / 1_000_000) * PRICING.cacheWritePer1M
  const costRead = (data.cacheReadTokens / 1_000_000) * PRICING.cacheReadPer1M
  const costOutput = (data.outputTokens / 1_000_000) * PRICING.outputPer1M
  const totalCost = costInput + costWrite + costRead + costOutput

  const totalTokensIn = data.regularInputTokens + data.cacheWriteTokens + data.cacheReadTokens
  const noCacheCost = (totalTokensIn / 1_000_000) * PRICING.inputPer1M + (data.outputTokens / 1_000_000) * PRICING.outputPer1M
  const savings = noCacheCost - totalCost
  const savingsPct = noCacheCost > 0 ? ((savings / noCacheCost) * 100) : 0

  const rows = [
    { label: 'Input (nuovi)', tokens: data.regularInputTokens, rate: PRICING.inputPer1M, cost: costInput, color: 'bg-blue-500' },
    { label: 'Cache write', tokens: data.cacheWriteTokens, rate: PRICING.cacheWritePer1M, cost: costWrite, color: 'bg-amber-500' },
    { label: 'Cache read', tokens: data.cacheReadTokens, rate: PRICING.cacheReadPer1M, cost: costRead, color: 'bg-emerald-500' },
    { label: 'Output', tokens: data.outputTokens, rate: PRICING.outputPer1M, cost: costOutput, color: 'bg-violet-500' },
  ]

  const maxCost = Math.max(...rows.map(r => r.cost), 1)

  return (
    <div className="bg-gray-800/70 rounded-2xl p-5 border border-gray-700/60 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Stima costo API</h3>
        <span className="text-xs text-gray-500">{data.totalSessions} sessioni</span>
      </div>

      {/* Totale */}
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-bold text-gray-100">{usd(totalCost)}</span>
        <span className="text-sm text-emerald-400">
          risparmiati {usd(savings)} ({savingsPct.toFixed(0)}%) con cache
        </span>
      </div>

      {/* Barra proporzionale */}
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
        {rows.map(r => {
          const pct = totalCost > 0 ? (r.cost / totalCost) * 100 : 0
          return pct > 0 ? (
            <div
              key={r.label}
              className={`${r.color} rounded-sm`}
              style={{ width: `${pct}%` }}
              title={`${r.label}: ${usd(r.cost)} (${pct.toFixed(0)}%)`}
            />
          ) : null
        })}
      </div>

      {/* Tabella dettaglio */}
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-500 border-b border-gray-700">
            <th className="text-left py-1.5 font-medium">Tipo</th>
            <th className="text-right py-1.5 font-medium">Token</th>
            <th className="text-right py-1.5 font-medium">$/M</th>
            <th className="text-right py-1.5 font-medium">Costo</th>
            <th className="text-right py-1.5 font-medium w-24"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.label} className="border-b border-gray-800 text-gray-300">
              <td className="py-2 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-sm ${r.color} shrink-0`} />
                {r.label}
              </td>
              <td className="text-right py-2 tabular-nums">{fmt(r.tokens)}</td>
              <td className="text-right py-2 tabular-nums text-gray-500">{usd(r.rate)}</td>
              <td className="text-right py-2 tabular-nums font-medium">{usd(r.cost)}</td>
              <td className="text-right py-2">
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden ml-auto w-20">
                  <div className={`h-full ${r.color} rounded-full`} style={{ width: `${(r.cost / maxCost) * 100}%` }} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="text-gray-100 font-semibold">
            <td className="pt-2">Totale</td>
            <td className="text-right pt-2 tabular-nums">{fmt(totalTokensIn + data.outputTokens)}</td>
            <td></td>
            <td className="text-right pt-2 tabular-nums">{usd(totalCost)}</td>
            <td></td>
          </tr>
          <tr className="text-gray-500 text-[10px]">
            <td colSpan={5} className="pt-1">
              Senza prompt cache: {usd(noCacheCost)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
