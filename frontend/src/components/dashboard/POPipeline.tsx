import { useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { getPOPipeline } from '../../api/analytics'
import { formatPKR } from '../../lib/format'
import type { POPipelineItem } from '../../types'

const STAGES = ['draft', 'placed', 'confirmed', 'in_production', 'shipped', 'received'] as const

const STAGE_META: Record<
  string,
  { label: string; bg: string; text: string; ring: string; dot: string }
> = {
  draft:         { label: 'Draft',         bg: 'bg-slate-100',   text: 'text-slate-600',   ring: 'ring-slate-200',  dot: 'bg-slate-400'  },
  placed:        { label: 'Placed',        bg: 'bg-blue-50',     text: 'text-blue-700',    ring: 'ring-blue-200',   dot: 'bg-blue-500'   },
  confirmed:     { label: 'Confirmed',     bg: 'bg-violet-50',   text: 'text-violet-700',  ring: 'ring-violet-200', dot: 'bg-violet-500' },
  in_production: { label: 'In Production', bg: 'bg-amber-50',    text: 'text-amber-700',   ring: 'ring-amber-200',  dot: 'bg-amber-500'  },
  shipped:       { label: 'Shipped',       bg: 'bg-orange-50',   text: 'text-orange-700',  ring: 'ring-orange-200', dot: 'bg-orange-500' },
  received:      { label: 'Received',      bg: 'bg-green-50',    text: 'text-green-700',   ring: 'ring-green-200',  dot: 'bg-green-500'  },
  cancelled:     { label: 'Cancelled',     bg: 'bg-red-50',      text: 'text-red-600',     ring: 'ring-red-200',    dot: 'bg-red-400'    },
}

export default function POPipeline() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['po-pipeline'],
    queryFn: getPOPipeline,
  })

  const byStatus = Object.fromEntries((data ?? []).map((d) => [d.status, d])) as Record<
    string,
    POPipelineItem | undefined
  >

  const cancelled = byStatus['cancelled']

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-700">Purchase Order Pipeline</h2>
      </div>

      {isLoading && (
        <div className="animate-pulse space-y-3 p-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-slate-200" />
              <div className="h-8 flex-1 rounded-lg bg-slate-200" />
            </div>
          ))}
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
          <p className="text-sm text-red-500">Failed to load pipeline data</p>
          <button
            onClick={() => void refetch()}
            className="text-sm font-medium text-indigo-600 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !isError && (
        <div className="p-5">
          {/* Main pipeline flow */}
          <div className="space-y-2">
            {STAGES.map((stage, idx) => {
              const item = byStatus[stage]
              const meta = STAGE_META[stage]
              const count = item?.count ?? 0
              const value = item ? parseFloat(item.total_value) : 0

              return (
                <div key={stage} className="flex items-center gap-2">
                  {/* Arrow connector (skip first) */}
                  {idx > 0 && (
                    <ChevronRight size={14} className="shrink-0 text-slate-300" />
                  )}
                  {idx === 0 && <div className="w-[14px] shrink-0" />}

                  <div
                    className={`flex flex-1 items-center justify-between rounded-lg px-3 py-2.5 ring-1 ${meta.bg} ${meta.ring} ${
                      count === 0 ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                      <span className={`text-xs font-medium ${meta.text}`}>{meta.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-semibold ${meta.text}`}>
                        {count} PO{count !== 1 ? 's' : ''}
                      </span>
                      {value > 0 && (
                        <span className="text-xs text-slate-500">{formatPKR(value)}</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Cancelled — shown separately below */}
          {cancelled && cancelled.count > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2.5 ring-1 ring-red-200">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-red-400" />
                  <span className="text-xs font-medium text-red-600">Cancelled</span>
                </div>
                <span className="text-xs font-semibold text-red-600">
                  {cancelled.count} PO{cancelled.count !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          )}

          {!data || data.length === 0 ? (
            <p className="mt-4 text-center text-sm text-slate-400">No purchase orders yet</p>
          ) : null}
        </div>
      )}
    </div>
  )
}
