import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Package, Truck, AlertCircle, RefreshCw } from 'lucide-react'
import { getFulfillmentQueue, updateOrderStatus } from '../../api/orders'
import { useToast } from '../../contexts/ToastContext'
import { timeAgo, ORDER_STATUS_STYLES } from '../../lib/format'
import type { FulfillmentOrder, OrderItem } from '../../types'
import type { OrderStatusPayload } from '../../api/orders'

// ── Constants ─────────────────────────────────────────────────────────────────

const CARRIERS = ['TCS', 'Leopards', 'PostEx', 'DHL']

// ── Helpers ───────────────────────────────────────────────────────────────────

function itemsSummary(items: OrderItem[]): string {
  const parts = items.slice(0, 3).map((i) => `${i.quantity}× ${i.sku.color} ${i.sku.size}`)
  if (items.length > 3) parts.push(`+${items.length - 3} more`)
  return parts.join(', ')
}

// ── ShipModal ─────────────────────────────────────────────────────────────────

function ShipModal({
  onClose,
  onConfirm,
  loading,
}: {
  onClose: () => void
  onConfirm: (tracking: string, carrier: string) => void
  loading: boolean
}) {
  const [tracking, setTracking] = useState('')
  const [carrier, setCarrier] = useState(CARRIERS[0])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="text-base font-semibold text-slate-800 mb-5">Ship Order</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Carrier</label>
            <select
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              {CARRIERS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Tracking Number
            </label>
            <input
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder="e.g. TCS123456789"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(tracking, carrier)}
            disabled={!tracking.trim() || loading}
            className="flex-1 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? 'Shipping…' : 'Confirm Ship'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── OrderCard ─────────────────────────────────────────────────────────────────

function OrderCard({
  order,
  onAction,
  actionLoading,
}: {
  order: FulfillmentOrder
  onAction: (order: FulfillmentOrder) => void
  actionLoading: boolean
}) {
  const isPack = order.status === 'confirmed'

  return (
    <div
      className={`bg-white rounded-xl border p-4 space-y-3 transition-shadow hover:shadow-md ${
        order.is_priority ? 'border-red-200' : 'border-slate-200'
      }`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-800">#{order.id}</span>
            {order.is_priority && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-xs font-medium">
                <AlertCircle size={11} />
                Priority
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{timeAgo(order.created_at)}</p>
        </div>
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize shrink-0 ${ORDER_STATUS_STYLES[order.status] ?? ''}`}
        >
          {order.status}
        </span>
      </div>

      {/* Buyer */}
      {order.buyer && (
        <p className="text-sm text-slate-700 font-medium">{order.buyer.full_name}</p>
      )}

      {/* Items summary */}
      <p className="text-xs text-slate-500 leading-relaxed">{itemsSummary(order.items)}</p>

      {/* Action */}
      <button
        onClick={() => onAction(order)}
        disabled={actionLoading}
        className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${
          isPack
            ? 'bg-slate-800 text-white hover:bg-slate-700'
            : 'bg-amber-500 text-white hover:bg-amber-600'
        }`}
      >
        {isPack ? <Package size={14} /> : <Truck size={14} />}
        {isPack ? 'Mark as Packed' : 'Mark as Shipped'}
      </button>
    </div>
  )
}

// ── Column ────────────────────────────────────────────────────────────────────

function Column({
  title,
  count,
  orders,
  onAction,
  actionLoading,
  emptyMessage,
}: {
  title: string
  count: number
  orders: FulfillmentOrder[]
  onAction: (order: FulfillmentOrder) => void
  actionLoading: boolean
  emptyMessage: string
}) {
  return (
    <div className="flex-1 min-w-0">
      {/* Column header */}
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-slate-800 text-white text-xs font-semibold">
          {count}
        </span>
      </div>

      {/* Cards */}
      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-12 text-center">
          <Package size={28} className="text-slate-300 mb-2" />
          <p className="text-sm text-slate-400">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onAction={onAction}
              actionLoading={actionLoading}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Fulfillment() {
  const [shipTarget, setShipTarget] = useState<FulfillmentOrder | null>(null)

  const toast = useToast()
  const queryClient = useQueryClient()

  const { data: queue = [], isLoading, isError, dataUpdatedAt } = useQuery({
    queryKey: ['fulfillment-queue'],
    queryFn: getFulfillmentQueue,
    refetchInterval: 60_000,
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: OrderStatusPayload }) =>
      updateOrderStatus(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fulfillment-queue'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      if (variables.payload.status === 'packed') {
        toast.success(`Order #${variables.id} marked as packed`)
      } else if (variables.payload.status === 'shipped') {
        toast.success(`Order #${variables.id} shipped via ${variables.payload.carrier ?? 'courier'}`)
        setShipTarget(null)
      }
    },
    onError: () => toast.error('Failed to update order'),
  })

  function handleAction(order: FulfillmentOrder) {
    if (order.status === 'confirmed') {
      statusMutation.mutate({ id: order.id, payload: { status: 'packed' } })
    } else {
      setShipTarget(order)
    }
  }

  function handleShipConfirm(tracking: string, carrier: string) {
    if (!shipTarget) return
    statusMutation.mutate({
      id: shipTarget.id,
      payload: { status: 'shipped', tracking_number: tracking, carrier },
    })
  }

  const toPack = queue.filter((o) => o.status === 'confirmed')
  const toShip = queue.filter((o) => o.status === 'packed')

  const lastRefreshed = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Fulfillment Queue</h1>
          <p className="mt-1 text-sm text-slate-500">Pack and ship confirmed orders</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 shrink-0 mt-1">
          <RefreshCw size={12} />
          {lastRefreshed ? `Updated ${lastRefreshed} · auto-refreshes every 60s` : 'Auto-refreshes every 60s'}
        </div>
      </div>

      {/* Error */}
      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          Failed to load fulfillment queue. Please refresh the page.
        </div>
      )}

      {/* Two-column layout */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[0, 1].map((col) => (
            <div key={col}>
              <div className="h-6 w-32 bg-slate-100 rounded animate-pulse mb-4" />
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-36 bg-slate-100 rounded-xl animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Column
            title="To Pack"
            count={toPack.length}
            orders={toPack}
            onAction={handleAction}
            actionLoading={statusMutation.isPending}
            emptyMessage="No orders to pack"
          />
          <Column
            title="To Ship"
            count={toShip.length}
            orders={toShip}
            onAction={handleAction}
            actionLoading={statusMutation.isPending}
            emptyMessage="No orders to ship"
          />
        </div>
      )}

      {/* Ship modal */}
      {shipTarget && (
        <ShipModal
          loading={statusMutation.isPending}
          onClose={() => setShipTarget(null)}
          onConfirm={handleShipConfirm}
        />
      )}
    </div>
  )
}
