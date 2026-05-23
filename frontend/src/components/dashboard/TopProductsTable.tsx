import { useQuery } from '@tanstack/react-query'
import { getTopProducts } from '../../api/analytics'
import { formatPKR } from '../../lib/format'

function marginClass(margin: number): string {
  if (margin >= 30) return 'text-green-600 bg-green-50'
  if (margin >= 15) return 'text-amber-600 bg-amber-50'
  return 'text-red-500 bg-red-50'
}

export default function TopProductsTable() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['top-products'],
    queryFn: () => getTopProducts(10),
  })

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-700">Top Products</h2>
      </div>

      {isLoading && (
        <div className="animate-pulse p-5 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-3 flex-1 rounded bg-slate-200" />
              <div className="h-3 w-16 rounded bg-slate-200" />
              <div className="h-3 w-20 rounded bg-slate-200" />
              <div className="h-5 w-12 rounded-full bg-slate-200" />
            </div>
          ))}
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
          <p className="text-sm text-red-500">Failed to load top products</p>
          <button
            onClick={() => void refetch()}
            className="text-sm font-medium text-indigo-600 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !isError && (!data || data.length === 0) && (
        <div className="flex items-center justify-center p-10">
          <p className="text-sm text-slate-400">No sales data yet</p>
        </div>
      )}

      {!isLoading && !isError && data && data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                  Product
                </th>
                <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-400">
                  Units
                </th>
                <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-400">
                  Revenue
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-400">
                  Margin
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.map((product) => (
                <tr key={product.product_id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-700">{product.name}</td>
                  <td className="px-3 py-3 text-right text-slate-500">
                    {product.units_sold.toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right text-slate-700">
                    {formatPKR(product.revenue)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${marginClass(product.gross_margin)}`}
                    >
                      {product.gross_margin.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
