import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, Package, Loader2, Truck } from 'lucide-react'
import { getMyOrders, cancelOrder } from '../../api/buyer'
import { useToast } from '../../contexts/ToastContext'
import { formatPKR, timeAgo, ORDER_STATUS_STYLES } from '../../lib/format'
import type { Order } from '../../types'

function OrderCard({ order }: { order: Order }) {
  const [expanded, setExpanded] = useState(false)
  const toast = useToast()
  const queryClient = useQueryClient()

  const cancelMutation = useMutation({
    mutationFn: () => cancelOrder(order.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-orders'] })
      toast.success('Order cancelled')
    },
    onError: () => toast.error('Failed to cancel order'),
  })

  const canCancel = order.status === 'pending' || order.status === 'confirmed'
  const shipment = order.shipments?.[0]
  const addr = order.shipping_address as Record<string, string> | null

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div>
            <p className="text-sm font-bold text-slate-800">#{order.id}</p>
            <p className="text-xs text-slate-400 mt-0.5">{timeAgo(order.created_at)}</p>
          </div>
          <div className="hidden sm:block text-xs text-slate-400">
            {order.items.length} item{order.items.length !== 1 ? 's' : ''}
          </div>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${ORDER_STATUS_STYLES[order.status] ?? ''}`}
          >
            {order.status}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <span className="text-sm font-bold text-slate-800">{formatPKR(order.total_amount)}</span>
          {expanded ? (
            <ChevronUp size={16} className="text-slate-400" />
          ) : (
            <ChevronDown size={16} className="text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-100">
          {/* Items */}
          <div className="px-5 py-4 space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Items</p>
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center shrink-0">
                  <Package size={16} className="text-indigo-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{item.sku.sku_code}</p>
                  <p className="text-xs text-slate-400 capitalize">
                    {item.sku.color} · {item.sku.size} · ×{item.quantity}
                  </p>
                </div>
                <p className="text-sm font-semibold text-slate-700 shrink-0">
                  {formatPKR(parseFloat(item.unit_price) * item.quantity)}
                </p>
              </div>
            ))}
          </div>

          {/* Shipping address */}
          {addr && Object.keys(addr).length > 0 && (
            <div className="border-t border-slate-50 px-5 py-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                Shipping Address
              </p>
              <div className="text-sm text-slate-600 space-y-0.5">
                {addr.full_name && <p className="font-medium">{addr.full_name}</p>}
                {addr.street && <p>{addr.street}</p>}
                {addr.city && (
                  <p>
                    {addr.city}
                    {addr.postal_code ? ` – ${addr.postal_code}` : ''}
                  </p>
                )}
                {addr.phone && <p className="text-slate-400">{addr.phone}</p>}
              </div>
            </div>
          )}

          {/* Tracking */}
          {shipment?.tracking_number && (
            <div className="border-t border-slate-50 px-5 py-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                Tracking
              </p>
              <div className="flex items-center gap-2 text-sm">
                <Truck size={14} className="text-amber-500 shrink-0" />
                <span className="font-medium text-slate-700">{shipment.carrier}</span>
                <span className="text-slate-500">·</span>
                <span className="text-slate-600 font-mono">{shipment.tracking_number}</span>
              </div>
            </div>
          )}

          {/* Cancel */}
          {canCancel && (
            <div className="border-t border-slate-100 px-5 py-4">
              <button
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                className="flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                {cancelMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : null}
                Cancel Order
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function MyOrders() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['my-orders'],
    queryFn: () => getMyOrders(),
    staleTime: 0,
  })

  const orders = data?.items ?? []

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">My Orders</h1>
        {!isLoading && (
          <p className="mt-1 text-sm text-slate-500">
            {orders.length} order{orders.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {isError ? (
        <div className="rounded-2xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-600">
          Failed to load your orders. Please refresh the page.
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 h-16 animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <Package size={28} className="text-slate-300" />
          </div>
          <p className="text-sm font-medium text-slate-600">No orders yet</p>
          <p className="text-xs text-slate-400 mt-1">
            Your orders will appear here after you place them
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order: Order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  )
}
