import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, PackageX, Plus } from 'lucide-react'
import { getLowStock } from '../../api/analytics'

export default function LowStockAlert() {
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['low-stock'],
    queryFn: getLowStock,
    refetchInterval: 60_000,
  })

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-700">Low Stock Alerts</h2>
        {data && data.length > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-600">
            {data.length}
          </span>
        )}
      </div>

      {isLoading && (
        <div className="animate-pulse space-y-3 p-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-slate-200" />
              <div className="flex-1">
                <div className="h-3 w-24 rounded bg-slate-200" />
                <div className="mt-1.5 h-3 w-16 rounded bg-slate-200" />
              </div>
              <div className="h-7 w-20 rounded-lg bg-slate-200" />
            </div>
          ))}
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
          <p className="text-sm text-red-500">Failed to load stock data</p>
          <button
            onClick={() => void refetch()}
            className="text-sm font-medium text-indigo-600 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !isError && (!data || data.length === 0) && (
        <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50">
            <PackageX size={20} className="text-green-500" />
          </div>
          <p className="text-sm font-medium text-slate-700">All stock levels healthy</p>
          <p className="text-xs text-slate-400">No SKUs below their threshold</p>
        </div>
      )}

      {!isLoading && !isError && data && data.length > 0 && (
        <ul className="divide-y divide-slate-50 overflow-y-auto" style={{ maxHeight: 340 }}>
          {data.map((item) => {
            const outOfStock = item.quantity_on_hand === 0
            return (
              <li key={item.id} className="flex items-center gap-3 px-5 py-3">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    outOfStock ? 'bg-red-50' : 'bg-amber-50'
                  }`}
                >
                  <AlertTriangle
                    size={16}
                    className={outOfStock ? 'text-red-500' : 'text-amber-500'}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700">{item.sku_code}</p>
                  <p className="text-xs text-slate-400">
                    {item.color} / {item.size}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span
                      className={`text-xs font-semibold ${
                        outOfStock ? 'text-red-600' : 'text-amber-600'
                      }`}
                    >
                      {outOfStock ? 'Out of stock' : `${item.quantity_on_hand} left`}
                    </span>
                    {!outOfStock && (
                      <span className="text-xs text-slate-400">
                        / threshold {item.low_stock_threshold}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => navigate('/purchase-orders/new')}
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-100 transition-colors"
                >
                  <Plus size={12} />
                  Create PO
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
