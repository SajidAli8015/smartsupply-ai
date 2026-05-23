import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle, Package, ClipboardList, Loader2 } from 'lucide-react'
import { getMyOrder } from '../../api/buyer'
import { formatPKR, formatDate } from '../../lib/format'

export default function OrderConfirmation() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: order, isLoading, isError } = useQuery({
    queryKey: ['my-order', id],
    queryFn: () => getMyOrder(Number(id)),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={32} className="animate-spin text-indigo-400" />
      </div>
    )
  }

  if (isError || !order) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-red-600 font-medium">Could not load order details</p>
        <button
          onClick={() => navigate('/my-orders')}
          className="mt-4 text-indigo-600 text-sm hover:underline"
        >
          View my orders
        </button>
      </div>
    )
  }

  const addr = order.shipping_address as Record<string, string> | null

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      {/* Success hero */}
      <div className="text-center mb-8">
        <div className="mx-auto h-20 w-20 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <CheckCircle size={44} className="text-green-500" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800">Order Placed!</h1>
        <p className="text-slate-500 mt-2 text-sm">
          Your order has been confirmed. We'll start packing it right away.
        </p>
      </div>

      {/* Order card */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-6">
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Order Number</p>
            <p className="text-lg font-bold text-slate-800 mt-0.5">#{order.id}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Placed on</p>
            <p className="text-sm font-medium text-slate-700 mt-0.5">{formatDate(order.created_at)}</p>
          </div>
        </div>

        {/* Items */}
        <div className="px-5 py-4 space-y-3">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center shrink-0">
                <Package size={16} className="text-indigo-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">{item.sku.sku_code}</p>
                <p className="text-xs text-slate-400 capitalize">
                  {item.sku.color} · {item.sku.size} · ×{item.quantity}
                </p>
              </div>
              <p className="text-sm font-semibold text-slate-700">
                {formatPKR(parseFloat(item.unit_price) * item.quantity)}
              </p>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="border-t border-slate-100 px-5 py-3 flex justify-between items-center">
          <span className="text-sm font-semibold text-slate-700">Order Total</span>
          <span className="text-base font-bold text-indigo-700">{formatPKR(order.total_amount)}</span>
        </div>

        {/* Shipping address */}
        {addr && Object.keys(addr).length > 0 && (
          <div className="border-t border-slate-100 px-5 py-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              Shipping To
            </p>
            <div className="text-sm text-slate-600 space-y-0.5">
              {addr.full_name && <p className="font-medium">{addr.full_name}</p>}
              {addr.phone && <p>{addr.phone}</p>}
              {addr.street && <p>{addr.street}</p>}
              {addr.city && <p>{addr.city}{addr.postal_code ? ` – ${addr.postal_code}` : ''}</p>}
            </div>
          </div>
        )}
      </div>

      {/* CTA buttons */}
      <div className="flex flex-col gap-3">
        <button
          onClick={() => navigate('/my-orders')}
          className="w-full flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
        >
          <ClipboardList size={16} />
          Track My Order
        </button>
        <button
          onClick={() => navigate('/shop')}
          className="w-full rounded-2xl border border-slate-200 py-3.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Continue Shopping
        </button>
      </div>
    </div>
  )
}
