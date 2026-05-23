import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  X,
  Package,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Info,
} from 'lucide-react'
import { getOrders, getOrder, updateOrderStatus } from '../../api/orders'
import { useToast } from '../../contexts/ToastContext'
import { formatPKR, timeAgo, ORDER_STATUS_STYLES } from '../../lib/format'
import type { Order, OrderStatus, OrderItem } from '../../types'
import type { OrderStatusPayload } from '../../api/orders'

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS: { label: string; value: OrderStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Packed', value: 'packed' },
  { label: 'Shipped', value: 'shipped' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Cancelled', value: 'cancelled' },
]

const STATUS_PROGRESSION: OrderStatus[] = [
  'pending',
  'confirmed',
  'packed',
  'shipped',
  'delivered',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function itemsSummary(items: OrderItem[]): string {
  const parts = items.slice(0, 2).map((i) => `${i.quantity}× ${i.sku.color} ${i.sku.size}`)
  if (items.length > 2) parts.push(`+${items.length - 2} more`)
  return parts.join(', ')
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── StatusTimeline ────────────────────────────────────────────────────────────

function StatusTimeline({ order }: { order: Order }) {
  if (order.status === 'cancelled') {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
        <X size={14} />
        <span>Order cancelled</span>
      </div>
    )
  }

  const currentIdx = STATUS_PROGRESSION.indexOf(order.status)
  const shipment = order.shipments?.[0]

  const steps: { key: OrderStatus; label: string; date: string | null }[] = [
    { key: 'pending', label: 'Order Placed', date: order.created_at },
    { key: 'confirmed', label: 'Confirmed', date: null },
    { key: 'packed', label: 'Packed & Ready', date: null },
    { key: 'shipped', label: 'Shipped', date: shipment?.shipped_at ?? null },
    { key: 'delivered', label: 'Delivered', date: shipment?.delivered_at ?? null },
  ]

  return (
    <div>
      {steps.map((step, i) => {
        const stepIdx = STATUS_PROGRESSION.indexOf(step.key)
        const done = stepIdx < currentIdx
        const active = stepIdx === currentIdx
        const upcoming = stepIdx > currentIdx

        return (
          <div key={step.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${
                  done
                    ? 'bg-green-500 text-white'
                    : active
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-100 text-slate-400'
                }`}
              >
                {done ? (
                  <CheckCircle size={13} />
                ) : (
                  <span className="text-[10px] font-semibold">{i + 1}</span>
                )}
              </div>
              {i < steps.length - 1 && (
                <div
                  className="w-px my-1"
                  style={{ minHeight: 20, backgroundColor: done ? '#bbf7d0' : '#e2e8f0' }}
                />
              )}
            </div>
            <div className="pb-3.5">
              <p
                className={`text-sm font-medium leading-tight ${
                  upcoming ? 'text-slate-400' : 'text-slate-700'
                }`}
              >
                {step.label}
              </p>
              {step.date && !upcoming && (
                <p className="text-xs text-slate-400 mt-0.5">{formatShortDate(step.date)}</p>
              )}
              {step.key === 'shipped' && shipment?.tracking_number && !upcoming && (
                <p className="text-xs text-slate-500 mt-0.5">
                  {shipment.carrier} · {shipment.tracking_number}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── OrderDetailSlideOver ──────────────────────────────────────────────────────

function OrderDetailSlideOver({
  orderId,
  onClose,
  onStatusUpdate,
  mutating,
}: {
  orderId: number
  onClose: () => void
  onStatusUpdate: (id: number, payload: OrderStatusPayload) => void
  mutating: boolean
}) {
  const { data: order, isLoading } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => getOrder(orderId),
  })

  const addr = order?.shipping_address as Record<string, string> | null | undefined

  // Only pending and shipped get action buttons here.
  // confirmed + packed are handled in Fulfillment queue.
  const showAction = order?.status === 'pending' || order?.status === 'shipped'
  const showFulfillmentHint =
    order?.status === 'confirmed' || order?.status === 'packed'

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-lg z-50 bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            {isLoading ? (
              <div className="h-5 w-32 bg-slate-100 rounded animate-pulse" />
            ) : (
              <>
                <h2 className="text-base font-semibold text-slate-800">Order #{order?.id}</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {order ? timeAgo(order.created_at) : ''}
                </p>
              </>
            )}
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100">
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        {/* Body */}
        {isLoading ? (
          <div className="flex-1 p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : order ? (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {/* Buyer */}
            <section>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                Buyer
              </h3>
              <p className="text-sm font-medium text-slate-800">{order.buyer.full_name}</p>
              <p className="text-sm text-slate-500">{order.buyer.email}</p>
            </section>

            {/* Shipping address */}
            {addr && Object.keys(addr).length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Shipping Address
                </h3>
                <div className="text-sm text-slate-600 space-y-0.5">
                  {addr.street && <p>{addr.street}</p>}
                  {(addr.city || addr.province) && (
                    <p>{[addr.city, addr.province].filter(Boolean).join(', ')}</p>
                  )}
                  {addr.postal_code && <p>{addr.postal_code}</p>}
                  {addr.country && <p>{addr.country}</p>}
                  {!addr.street && !addr.city && (
                    <p className="text-slate-400 text-xs font-mono">
                      {JSON.stringify(addr, null, 2)}
                    </p>
                  )}
                </div>
              </section>
            )}

            {/* Items */}
            <section>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                Items
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 border-b border-slate-100">
                    <th className="text-left pb-2 font-medium">Product / SKU</th>
                    <th className="text-center pb-2 font-medium w-12">Qty</th>
                    <th className="text-right pb-2 font-medium">Unit Price</th>
                    <th className="text-right pb-2 font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2.5">
                        <p className="font-medium text-slate-700">{item.sku.sku_code}</p>
                        <p className="text-xs text-slate-400">
                          {item.sku.color} · {item.sku.size}
                        </p>
                      </td>
                      <td className="py-2.5 text-center text-slate-600">{item.quantity}</td>
                      <td className="py-2.5 text-right text-slate-600">
                        {formatPKR(item.unit_price)}
                      </td>
                      <td className="py-2.5 text-right font-medium text-slate-800">
                        {formatPKR(parseFloat(item.unit_price) * item.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200">
                    <td colSpan={3} className="pt-3 text-sm font-semibold text-slate-700">
                      Order Total
                    </td>
                    <td className="pt-3 text-right text-sm font-bold text-slate-800">
                      {formatPKR(order.total_amount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </section>

            {/* Status timeline */}
            <section>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                Order Status
              </h3>
              <div className="flex items-center gap-2 mb-4">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${ORDER_STATUS_STYLES[order.status] ?? ''}`}
                >
                  {order.status}
                </span>
              </div>
              <StatusTimeline order={order} />

              {/* Hint for statuses handled by Fulfillment */}
              {showFulfillmentHint && (
                <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
                  <Info size={12} className="shrink-0" />
                  Packing and shipping is managed in the Fulfillment queue
                </p>
              )}
            </section>
          </div>
        ) : null}

        {/* Action footer — only pending (Confirm) and shipped (Deliver) */}
        {order && showAction && (
          <div className="px-6 py-4 border-t border-slate-100 shrink-0">
            {order.status === 'pending' ? (
              <button
                onClick={() => onStatusUpdate(order.id, { status: 'confirmed' })}
                disabled={mutating}
                className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                <CheckCircle size={15} />
                {mutating ? 'Confirming…' : 'Confirm Order'}
              </button>
            ) : (
              <button
                onClick={() => onStatusUpdate(order.id, { status: 'delivered' })}
                disabled={mutating}
                className="w-full rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                <CheckCircle size={15} />
                {mutating ? 'Updating…' : 'Mark as Delivered'}
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Orders() {
  const [activeTab, setActiveTab] = useState<OrderStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)

  const toast = useToast()
  const queryClient = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['orders', activeTab, page],
    queryFn: () =>
      getOrders({
        status: activeTab !== 'all' ? (activeTab as OrderStatus) : undefined,
        page,
        page_size: 20,
      }),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: OrderStatusPayload }) =>
      updateOrderStatus(id, payload),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['order', updated.id] })
      const messages: Partial<Record<OrderStatus, string>> = {
        confirmed: 'Order confirmed',
        delivered: 'Order marked as delivered',
      }
      toast.success(messages[updated.status] ?? 'Order status updated')
      setSelectedOrderId(null)
    },
    onError: () => toast.error('Failed to update order status'),
  })

  function handleStatusUpdate(id: number, payload: OrderStatusPayload) {
    statusMutation.mutate({ id, payload })
  }

  function handleTabChange(tab: OrderStatus | 'all') {
    setActiveTab(tab)
    setPage(1)
  }

  const orders = data?.items ?? []
  const totalPages = data?.total_pages ?? 0
  const total = data?.total ?? 0

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Orders</h1>
        <p className="mt-1 text-sm text-slate-500">Manage and confirm customer orders</p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {/* Status tabs */}
        <div className="border-b border-slate-100 overflow-x-auto">
          <div className="flex px-4 min-w-max">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => handleTabChange(tab.value)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.value
                    ? 'border-slate-800 text-slate-800'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {isError ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm font-medium text-red-600">Failed to load orders</p>
            <p className="text-xs text-slate-400 mt-1">Check your connection and try again</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs font-medium text-slate-400 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Order</th>
                  <th className="text-left px-4 py-3">Buyer</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Items</th>
                  <th className="text-right px-4 py-3">Total</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3 hidden lg:table-cell">Placed</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading
                  ? [...Array(8)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-4 py-3.5">
                          <div className="h-4 w-12 bg-slate-100 rounded" />
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="h-4 w-28 bg-slate-100 rounded" />
                        </td>
                        <td className="px-4 py-3.5 hidden md:table-cell">
                          <div className="h-4 w-36 bg-slate-100 rounded" />
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="h-4 w-20 bg-slate-100 rounded ml-auto" />
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="h-5 w-20 bg-slate-100 rounded-full" />
                        </td>
                        <td className="px-4 py-3.5 hidden lg:table-cell">
                          <div className="h-4 w-16 bg-slate-100 rounded" />
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="h-4 w-8 bg-slate-100 rounded" />
                        </td>
                      </tr>
                    ))
                  : orders.length === 0
                    ? null
                    : orders.map((order: Order) => (
                        <tr
                          key={order.id}
                          onClick={() => setSelectedOrderId(order.id)}
                          className="hover:bg-slate-50 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3.5 font-medium text-slate-700">
                            #{order.id}
                          </td>
                          <td className="px-4 py-3.5 text-slate-600">
                            {order.buyer.full_name}
                          </td>
                          <td className="px-4 py-3.5 text-slate-400 hidden md:table-cell max-w-[180px] truncate">
                            {itemsSummary(order.items)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-medium text-slate-800">
                            {formatPKR(order.total_amount)}
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${ORDER_STATUS_STYLES[order.status] ?? ''}`}
                            >
                              {order.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-slate-400 text-xs hidden lg:table-cell">
                            {timeAgo(order.created_at)}
                          </td>
                          <td className="px-4 py-3.5">
                            <ChevronRight size={16} className="text-slate-300" />
                          </td>
                        </tr>
                      ))}
              </tbody>
            </table>

            {/* Empty state */}
            {!isLoading && orders.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Package size={32} className="text-slate-300 mb-3" />
                <p className="text-sm font-medium text-slate-600">No orders found</p>
                <p className="text-xs text-slate-400 mt-1">
                  {activeTab === 'all'
                    ? 'Orders will appear here once buyers place them'
                    : `No ${activeTab} orders at the moment`}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        {!isLoading && !isError && total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-400">{total} orders</p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 1}
                className="rounded-lg p-1.5 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} className="text-slate-600" />
              </button>
              <span className="text-xs text-slate-600 px-2">
                {page} / {totalPages || 1}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                className="rounded-lg p-1.5 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} className="text-slate-600" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Order detail slide-over */}
      {selectedOrderId !== null && (
        <OrderDetailSlideOver
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          onStatusUpdate={handleStatusUpdate}
          mutating={statusMutation.isPending}
        />
      )}
    </div>
  )
}
