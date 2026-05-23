import { useNavigate } from 'react-router-dom'
import { X, Plus, Minus, ShoppingBag, ArrowRight } from 'lucide-react'
import { useCart } from '../../contexts/CartContext'
import { formatPKR } from '../../lib/format'

export default function CartSidebar() {
  const { items, isCartOpen, closeCart, updateQuantity, removeItem, total, itemCount } = useCart()
  const navigate = useNavigate()

  function handleCheckout() {
    closeCart()
    navigate('/checkout')
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 ${
          isCartOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closeCart}
      />

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-sm z-50 bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isCartOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ShoppingBag size={18} className="text-indigo-600" />
            <h2 className="font-semibold text-slate-800">
              Cart
              {itemCount > 0 && (
                <span className="ml-2 text-xs font-medium text-slate-500">
                  {itemCount} item{itemCount !== 1 ? 's' : ''}
                </span>
              )}
            </h2>
          </div>
          <button
            onClick={closeCart}
            className="rounded-lg p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
              <div className="h-20 w-20 rounded-full bg-slate-50 flex items-center justify-center">
                <ShoppingBag size={36} className="text-slate-300" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Your cart is empty</p>
                <p className="text-xs text-slate-400 mt-1">Add items from the shop to get started</p>
              </div>
              <button
                onClick={() => {
                  closeCart()
                  navigate('/shop')
                }}
                className="mt-2 text-sm text-indigo-600 font-medium hover:underline"
              >
                Browse products
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.skuId} className="flex gap-3 py-1">
                  {/* Placeholder */}
                  <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center shrink-0">
                    <ShoppingBag size={20} className="text-indigo-300" />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-sm font-medium text-slate-800 truncate leading-snug">
                        {item.productName}
                      </p>
                      <button
                        onClick={() => removeItem(item.skuId)}
                        className="shrink-0 text-slate-300 hover:text-red-400 transition-colors ml-1"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 capitalize">
                      {item.color} · {item.size}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-sm font-bold text-slate-800">
                        {formatPKR(item.price * item.quantity)}
                      </p>
                      {/* Qty controls */}
                      <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50">
                        <button
                          onClick={() => updateQuantity(item.skuId, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          className="px-2 py-1 text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Minus size={11} />
                        </button>
                        <span className="text-xs font-semibold text-slate-700 w-5 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.skuId, item.quantity + 1)}
                          className="px-2 py-1 text-slate-500 hover:text-slate-800"
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="px-5 py-4 border-t border-slate-100 space-y-3 bg-white">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Subtotal</span>
              <span className="text-base font-bold text-slate-800">{formatPKR(total)}</span>
            </div>
            <p className="text-xs text-slate-400">Shipping calculated at checkout</p>
            <button
              onClick={handleCheckout}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3.5 text-sm font-semibold text-white hover:bg-indigo-700 active:scale-[0.98] transition-all"
            >
              Checkout
              <ArrowRight size={15} />
            </button>
          </div>
        )}
      </div>
    </>
  )
}
