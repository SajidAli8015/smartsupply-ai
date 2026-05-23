import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ShoppingBag, Loader2 } from 'lucide-react'
import { placeOrder } from '../../api/buyer'
import { useCart } from '../../contexts/CartContext'
import { useToast } from '../../contexts/ToastContext'
import { formatPKR } from '../../lib/format'

interface ShippingForm {
  full_name: string
  phone: string
  address: string
  city: string
  postal_code: string
}

const EMPTY_FORM: ShippingForm = {
  full_name: '',
  phone: '',
  address: '',
  city: '',
  postal_code: '',
}

function Field({
  label,
  id,
  type = 'text',
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string
  id: keyof ShippingForm
  type?: string
  value: string
  onChange: (k: keyof ShippingForm, v: string) => void
  placeholder?: string
  required?: boolean
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(id, e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
      />
    </div>
  )
}

export default function Checkout() {
  const navigate = useNavigate()
  const { items, total, clearCart } = useCart()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<ShippingForm>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<ShippingForm>>({})

  useEffect(() => {
    if (items.length === 0) {
      navigate('/shop')
    }
  }, [items.length, navigate])

  const orderMutation = useMutation({
    mutationFn: placeOrder,
    onSuccess: (order) => {
      clearCart()
      queryClient.invalidateQueries({ queryKey: ['my-orders'] })
      navigate(`/order-confirmation/${order.id}`)
    },
    onError: () => toast.error('Failed to place order. Please try again.'),
  })

  function setField(k: keyof ShippingForm, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }))
    if (errors[k]) setErrors((prev) => ({ ...prev, [k]: undefined }))
  }

  function validate(): boolean {
    const newErrors: Partial<ShippingForm> = {}
    if (!form.full_name.trim()) newErrors.full_name = 'Required'
    if (!form.phone.trim()) newErrors.phone = 'Required'
    if (!form.address.trim()) newErrors.address = 'Required'
    if (!form.city.trim()) newErrors.city = 'Required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function handleSubmit() {
    if (!validate()) return

    orderMutation.mutate({
      items: items.map((i) => ({ sku_id: i.skuId, quantity: i.quantity })),
      shipping_address: {
        full_name: form.full_name,
        phone: form.phone,
        street: form.address,
        city: form.city,
        postal_code: form.postal_code,
      },
    })
  }

  if (items.length === 0) return null

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-800 mb-8">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
        {/* Left: Shipping form */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
          <h2 className="text-base font-semibold text-slate-800">Shipping Address</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <Field
                label="Full Name"
                id="full_name"
                value={form.full_name}
                onChange={setField}
                placeholder="Muhammad Ali"
                required
              />
              {errors.full_name && (
                <p className="text-xs text-red-500 mt-1">{errors.full_name}</p>
              )}
            </div>

            <div>
              <Field
                label="Phone Number"
                id="phone"
                type="tel"
                value={form.phone}
                onChange={setField}
                placeholder="03001234567"
                required
              />
              {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
            </div>

            <div>
              <Field
                label="City"
                id="city"
                value={form.city}
                onChange={setField}
                placeholder="Karachi"
                required
              />
              {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city}</p>}
            </div>

            <div className="sm:col-span-2">
              <Field
                label="Street Address"
                id="address"
                value={form.address}
                onChange={setField}
                placeholder="House 5, Block B, Gulshan-e-Iqbal"
                required
              />
              {errors.address && (
                <p className="text-xs text-red-500 mt-1">{errors.address}</p>
              )}
            </div>

            <div>
              <Field
                label="Postal Code"
                id="postal_code"
                value={form.postal_code}
                onChange={setField}
                placeholder="75300"
              />
            </div>
          </div>
        </div>

        {/* Right: Order summary */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 lg:sticky lg:top-24">
            <h2 className="text-base font-semibold text-slate-800">Order Summary</h2>

            {/* Items */}
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {items.map((item) => (
                <div key={item.skuId} className="flex gap-3">
                  <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center shrink-0">
                    <ShoppingBag size={16} className="text-indigo-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{item.productName}</p>
                    <p className="text-xs text-slate-400 capitalize">
                      {item.color} · {item.size} · ×{item.quantity}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-slate-700 shrink-0">
                    {formatPKR(item.price * item.quantity)}
                  </p>
                </div>
              ))}
            </div>

            {/* Divider + Total */}
            <div className="border-t border-slate-100 pt-4 space-y-2">
              <div className="flex justify-between text-sm text-slate-500">
                <span>Subtotal</span>
                <span>{formatPKR(total)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-500">
                <span>Shipping</span>
                <span className="text-green-600 font-medium">Free</span>
              </div>
              <div className="flex justify-between text-base font-bold text-slate-800 pt-1 border-t border-slate-100">
                <span>Total</span>
                <span className="text-indigo-700">{formatPKR(total)}</span>
              </div>
            </div>

            {/* Place order button */}
            <button
              onClick={handleSubmit}
              disabled={orderMutation.isPending}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-70 active:scale-[0.98] transition-all"
            >
              {orderMutation.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Placing Order…
                </>
              ) : (
                'Place Order'
              )}
            </button>

            <p className="text-xs text-slate-400 text-center">
              No payment required — demo mode
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
