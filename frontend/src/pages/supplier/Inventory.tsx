import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Boxes, AlertTriangle, PackageX, X, AlertCircle, SlidersHorizontal } from 'lucide-react'
import { getInventory, getProducts, adjustInventory, type AdjustReason } from '../../api/products'
import { formatPKR } from '../../lib/format'
import type { InventoryItem } from '../../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

const CLIENT_PAGE_SIZE = 20

function stockStatus(item: InventoryItem): 'out' | 'low' | 'ok' {
  if (item.quantity_on_hand === 0) return 'out'
  if (item.quantity_on_hand <= item.low_stock_threshold) return 'low'
  if (item.quantity_on_hand <= Math.ceil(item.low_stock_threshold * 1.2)) return 'low'
  return 'ok'
}

const STATUS_ROW: Record<string, string> = {
  out: 'bg-red-50',
  low: 'bg-amber-50',
  ok: '',
}

const STATUS_BADGE: Record<string, string> = {
  out: 'bg-red-100 text-red-700',
  low: 'bg-amber-100 text-amber-700',
  ok: 'bg-green-100 text-green-700',
}

const STATUS_LABEL: Record<string, string> = {
  out: 'Out of stock',
  low: 'Low stock',
  ok: 'In stock',
}

// ── Adjust modal ──────────────────────────────────────────────────────────────

const REASONS: { value: AdjustReason; label: string }[] = [
  { value: 'recount', label: 'Stock recount' },
  { value: 'return', label: 'Customer return' },
  { value: 'damage', label: 'Damage / loss' },
  { value: 'other', label: 'Other' },
]

const inputCls =
  'h-9 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
const labelCls = 'mb-1 block text-xs font-medium text-slate-600'

function AdjustModal({
  item,
  productName,
  onClose,
}: {
  item: InventoryItem
  productName: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState<AdjustReason>('recount')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const mut = useMutation({
    mutationFn: () =>
      adjustInventory(item.sku_id, { quantity: parseInt(quantity, 10), reason, notes: notes || undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventory'] })
      void qc.invalidateQueries({ queryKey: ['low-stock'] })
      onClose()
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      setError(e.response?.data?.detail ?? 'Adjustment failed'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const qty = parseInt(quantity, 10)
    if (isNaN(qty) || qty === 0) {
      setError('Enter a non-zero quantity')
      return
    }
    if (qty < 0 && Math.abs(qty) > item.quantity_on_hand) {
      setError(`Cannot remove more than current stock (${item.quantity_on_hand})`)
      return
    }
    mut.mutate()
  }

  const qty = parseInt(quantity, 10)
  const preview = !isNaN(qty) && qty !== 0
    ? `${item.quantity_on_hand} → ${item.quantity_on_hand + qty}`
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Adjust Stock</h2>
            <p className="text-xs text-slate-400">
              {item.sku_code} · {item.color} / {item.size}
              {productName && ` · ${productName}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Current stock summary */}
          <div className="grid grid-cols-3 gap-3 rounded-lg bg-slate-50 p-3 text-center text-xs">
            <div>
              <p className="font-semibold text-slate-700">{item.quantity_on_hand}</p>
              <p className="text-slate-400">On hand</p>
            </div>
            <div>
              <p className="font-semibold text-slate-700">{item.quantity_reserved}</p>
              <p className="text-slate-400">Reserved</p>
            </div>
            <div>
              <p className="font-semibold text-slate-700">{item.available}</p>
              <p className="text-slate-400">Available</p>
            </div>
          </div>

          <div>
            <label className={labelCls}>
              Quantity change *
              <span className="ml-1 font-normal text-slate-400">(positive to add, negative to remove)</span>
            </label>
            <div className="relative">
              <input
                className={inputCls}
                type="number"
                placeholder="e.g. 50 or -10"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
              {preview && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-indigo-600">
                  {preview}
                </span>
              )}
            </div>
          </div>

          <div>
            <label className={labelCls}>Reason *</label>
            <select
              className={inputCls}
              value={reason}
              onChange={(e) => setReason(e.target.value as AdjustReason)}
            >
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              rows={2}
              placeholder="Optional note about this adjustment"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
              <AlertCircle size={14} className="shrink-0" />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mut.isPending}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {mut.isPending ? 'Saving…' : 'Apply Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1.5 text-2xl font-bold ${color ?? 'text-slate-800'}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Inventory() {
  const [search, setSearch] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null)

  // Fetch all inventory (large page size for client-side filter + summary)
  const { data: invData, isLoading, isError, refetch } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => getInventory(1, 500),
  })

  // Fetch products to build sku_id → product name lookup
  const { data: productsData } = useQuery({
    queryKey: ['products-all'],
    queryFn: () => getProducts({ page_size: 500 }),
    staleTime: 5 * 60 * 1000,
  })

  const skuProductMap = useMemo(() => {
    const map: Record<number, string> = {}
    productsData?.items.forEach((p) => p.skus.forEach((s) => { map[s.id] = p.name }))
    return map
  }, [productsData])

  const allItems = invData?.items ?? []

  // Summary stats
  const totalSkus = allItems.length
  const totalUnits = allItems.reduce((s, i) => s + i.quantity_on_hand, 0)
  const lowCount = allItems.filter((i) => stockStatus(i) === 'low').length
  const outCount = allItems.filter((i) => stockStatus(i) === 'out').length

  // Filter
  const filtered = useMemo(() => {
    let items = allItems
    if (search) {
      const q = search.toLowerCase()
      items = items.filter(
        (i) =>
          i.sku_code.toLowerCase().includes(q) ||
          (skuProductMap[i.sku_id] ?? '').toLowerCase().includes(q),
      )
    }
    if (lowStockOnly) {
      items = items.filter((i) => stockStatus(i) !== 'ok')
    }
    return items
  }, [allItems, search, lowStockOnly, skuProductMap])

  // Client-side pagination
  const totalFiltered = filtered.length
  const totalPages = Math.ceil(totalFiltered / CLIENT_PAGE_SIZE)
  const paged = filtered.slice((page - 1) * CLIENT_PAGE_SIZE, page * CLIENT_PAGE_SIZE)

  function handleSearchChange(v: string) {
    setSearch(v)
    setPage(1)
  }

  function handleLowStockToggle() {
    setLowStockOnly((v) => !v)
    setPage(1)
  }

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">Inventory</h1>
        {!isLoading && (
          <p className="mt-0.5 text-sm text-slate-400">
            {totalSkus.toLocaleString()} SKU{totalSkus !== 1 ? 's' : ''} tracked
          </p>
        )}
      </div>

      {/* ── Summary cards ───────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-4">
              <div className="h-3 w-20 rounded bg-slate-200" />
              <div className="mt-3 h-7 w-12 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <SummaryCard label="Total SKUs" value={totalSkus.toLocaleString()} />
          <SummaryCard
            label="Total Units"
            value={totalUnits.toLocaleString()}
            sub="on hand across all SKUs"
          />
          <SummaryCard
            label="Low Stock"
            value={lowCount}
            sub="within 20% of threshold"
            color={lowCount > 0 ? 'text-amber-600' : 'text-slate-800'}
          />
          <SummaryCard
            label="Out of Stock"
            value={outCount}
            sub="zero units remaining"
            color={outCount > 0 ? 'text-red-600' : 'text-slate-800'}
          />
        </div>
      )}

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="h-9 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            placeholder="Search by SKU code or product…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
        <button
          onClick={handleLowStockToggle}
          className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
            lowStockOnly
              ? 'border-amber-300 bg-amber-50 text-amber-700'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
          }`}
        >
          <SlidersHorizontal size={14} />
          Low stock only
          {lowStockOnly && outCount + lowCount > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
              {outCount + lowCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {isLoading && (
          <div className="animate-pulse divide-y divide-slate-100">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="h-3 w-24 rounded bg-slate-200" />
                <div className="h-3 flex-1 rounded bg-slate-200" />
                <div className="h-3 w-16 rounded bg-slate-200" />
                <div className="h-3 w-10 rounded bg-slate-200" />
                <div className="h-3 w-10 rounded bg-slate-200" />
                <div className="h-3 w-10 rounded bg-slate-200" />
                <div className="h-5 w-16 rounded-full bg-slate-200" />
                <div className="h-7 w-20 rounded-lg bg-slate-200" />
              </div>
            ))}
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <AlertCircle size={24} className="text-red-400" />
            <p className="text-sm text-slate-600">Failed to load inventory</p>
            <button
              onClick={() => void refetch()}
              className="text-sm font-medium text-indigo-600 hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && !isError && paged.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              {lowStockOnly ? (
                <AlertTriangle size={22} className="text-green-500" />
              ) : (
                <Boxes size={22} className="text-slate-400" />
              )}
            </div>
            <p className="text-sm font-medium text-slate-700">
              {lowStockOnly ? 'No low stock items' : search ? 'No results found' : 'No inventory yet'}
            </p>
            <p className="text-xs text-slate-400">
              {lowStockOnly
                ? 'All stock levels are healthy'
                : search
                ? 'Try a different search term'
                : 'Add products and SKUs to track inventory'}
            </p>
          </div>
        )}

        {!isLoading && !isError && paged.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                      SKU Code
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                      Product
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                      Variant
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-400">
                      On Hand
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-400">
                      Reserved
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-400">
                      Available
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                      Location
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wide text-slate-400">
                      Status
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-400">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paged.map((item) => {
                    const status = stockStatus(item)
                    const productName = skuProductMap[item.sku_id] ?? '—'
                    return (
                      <tr key={item.id} className={`${STATUS_ROW[status]} hover:brightness-95`}>
                        <td className="px-5 py-3 font-mono text-xs font-semibold text-slate-700">
                          {item.sku_code}
                        </td>
                        <td className="px-3 py-3 text-slate-700">{productName}</td>
                        <td className="px-3 py-3 text-slate-500">
                          {item.color} / {item.size}
                        </td>
                        <td className="px-3 py-3 text-right font-medium text-slate-700">
                          {item.quantity_on_hand.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-right text-slate-500">
                          {item.quantity_reserved.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-right font-semibold text-slate-800">
                          {item.available.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-slate-500">
                          {item.warehouse_location ?? <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[status]}`}
                          >
                            {status === 'out' && <PackageX size={10} />}
                            {status === 'low' && <AlertTriangle size={10} />}
                            {STATUS_LABEL[status]}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => setAdjustItem(item)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:border-slate-300"
                          >
                            Adjust
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
                <p className="text-xs text-slate-400">
                  {(page - 1) * CLIENT_PAGE_SIZE + 1}–
                  {Math.min(page * CLIENT_PAGE_SIZE, totalFiltered)} of{' '}
                  {totalFiltered.toLocaleString()} item{totalFiltered !== 1 ? 's' : ''}
                  {lowStockOnly || search ? ` (filtered from ${totalSkus})` : ''}
                </p>
                <div className="flex gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Value summary footer ─────────────────────────────────────────── */}
      {!isLoading && !isError && allItems.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-slate-500">
          <span>
            Total inventory value:{' '}
            <strong className="text-slate-700">
              {formatPKR(
                allItems.reduce((sum, i) => {
                  const sku = productsData?.items
                    .flatMap((p) => p.skus)
                    .find((s) => s.id === i.sku_id)
                  return sum + (parseFloat(sku?.cost_price ?? '0') * i.quantity_on_hand)
                }, 0),
              )}
            </strong>
          </span>
          <span>Threshold alerts at ≤ stock level</span>
        </div>
      )}

      {/* ── Adjust modal ─────────────────────────────────────────────────── */}
      {adjustItem && (
        <AdjustModal
          item={adjustItem}
          productName={skuProductMap[adjustItem.sku_id] ?? ''}
          onClose={() => setAdjustItem(null)}
        />
      )}
    </div>
  )
}
