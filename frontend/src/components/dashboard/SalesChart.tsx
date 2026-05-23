import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { getSalesOverTime, type SalesPeriod, type Granularity } from '../../api/analytics'
import { formatDate, formatPKR, formatYAxis } from '../../lib/format'

const PERIODS: { label: string; value: SalesPeriod }[] = [
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'Quarter', value: 'quarter' },
]

function granularityFor(period: SalesPeriod): Granularity {
  return period === 'week' ? 'day' : 'week'
}

interface TooltipEntry {
  value: number
  name: string
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const revenue = payload.find((p) => p.name === 'revenue')
  const orders = payload.find((p) => p.name === 'order_count')
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      {revenue && (
        <p className="mt-1 text-sm font-semibold text-slate-800">{formatPKR(revenue.value)}</p>
      )}
      {orders && (
        <p className="text-xs text-slate-400">{orders.value} order{orders.value !== 1 ? 's' : ''}</p>
      )}
    </div>
  )
}

export default function SalesChart() {
  const [period, setPeriod] = useState<SalesPeriod>('month')
  const granularity = granularityFor(period)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['sales-over-time', period, granularity],
    queryFn: () => getSalesOverTime(period, granularity),
  })

  const chartData =
    data?.map((d) => ({
      date: formatDate(d.date),
      revenue: parseFloat(d.revenue),
      order_count: d.order_count,
    })) ?? []

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Revenue Over Time</h2>
        <div className="flex rounded-lg border border-slate-200 p-0.5">
          {PERIODS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setPeriod(value)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                period === value
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="animate-pulse">
          <div className="flex h-64 items-end gap-2 px-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-slate-200"
                style={{ height: `${20 + Math.random() * 70}%` }}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between px-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-3 w-10 rounded bg-slate-200" />
            ))}
          </div>
        </div>
      )}

      {isError && (
        <div className="flex h-64 flex-col items-center justify-center gap-2">
          <p className="text-sm text-red-500">Failed to load sales data</p>
          <button
            onClick={() => void refetch()}
            className="text-sm font-medium text-indigo-600 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !isError && chartData.length === 0 && (
        <div className="flex h-64 items-center justify-center">
          <p className="text-sm text-slate-400">No sales data for this period</p>
        </div>
      )}

      {!isLoading && !isError && chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatYAxis}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip content={<ChartTooltip />} />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#6366f1"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#6366f1' }}
            />
            <Line
              type="monotone"
              dataKey="order_count"
              stroke="#e2e8f0"
              strokeWidth={1.5}
              dot={false}
              hide
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
