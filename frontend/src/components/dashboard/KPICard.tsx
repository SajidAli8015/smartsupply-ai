import type { LucideIcon } from 'lucide-react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface Props {
  title: string
  value: string
  subtitle?: string
  icon: LucideIcon
  trend?: 'positive' | 'negative' | 'neutral'
  trendValue?: string
}

export default function KPICard({ title, value, subtitle, icon: Icon, trend = 'neutral', trendValue }: Props) {
  const trendEl = trendValue ? (
    <span
      className={`flex items-center gap-0.5 text-xs font-medium ${
        trend === 'positive'
          ? 'text-green-600'
          : trend === 'negative'
          ? 'text-red-500'
          : 'text-slate-400'
      }`}
    >
      {trend === 'positive' ? (
        <TrendingUp size={13} />
      ) : trend === 'negative' ? (
        <TrendingDown size={13} />
      ) : (
        <Minus size={13} />
      )}
      {trendValue}
    </span>
  ) : null

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
          <p className="mt-1.5 truncate text-2xl font-bold text-slate-800">{value}</p>
          {(trendEl || subtitle) && (
            <div className="mt-1.5 flex items-center gap-2">
              {trendEl}
              {subtitle && <span className="text-xs text-slate-400">{subtitle}</span>}
            </div>
          )}
        </div>
        <div className="ml-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
          <Icon size={20} className="text-indigo-600" />
        </div>
      </div>
    </div>
  )
}

export function KPICardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm animate-pulse">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="h-3 w-24 rounded bg-slate-200" />
          <div className="mt-3 h-7 w-32 rounded bg-slate-200" />
          <div className="mt-2 h-3 w-16 rounded bg-slate-200" />
        </div>
        <div className="ml-3 h-10 w-10 rounded-lg bg-slate-200" />
      </div>
    </div>
  )
}
