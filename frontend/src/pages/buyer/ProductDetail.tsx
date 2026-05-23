import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Minus, Plus, ShoppingCart, Package } from 'lucide-react'
import { getProduct } from '../../api/buyer'
import { useCart } from '../../contexts/CartContext'
import { formatPKR } from '../../lib/format'
import type { SKU } from '../../types'

// ── Constants ─────────────────────────────────────────────────────────────────

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '28', '30', '32', '34', '36', '38', '40']

const COLOR_HEX: Record<string, string> = {
  white: '#F8FAFC',
  black: '#1E293B',
  blue: '#3B82F6',
  navy: '#1E3A5F',
  red: '#EF4444',
  green: '#22C55E',
  gray: '#94A3B8',
  grey: '#94A3B8',
  brown: '#92400E',
  yellow: '#EAB308',
  purple: '#A855F7',
  pink: '#EC4899',
  orange: '#F97316',
  khaki: '#C3A76B',
  beige: '#E8D5B7',
  cream: '#FEF9C3',
  maroon: '#7F1D1D',
  olive: '#65A30D',
  teal: '#0D9488',
}

function getColorHex(color: string): string {
  return COLOR_HEX[color.toLowerCase()] ?? '#CBD5E1'
}

// ── Stock badge ───────────────────────────────────────────────────────────────

function StockBadge({ sku }: { sku: SKU }) {
  const available = sku.inventory?.available ?? 0
  const threshold = sku.inventory?.low_stock_threshold ?? 5

  if (available === 0)
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        Out of Stock
      </span>
    )
  if (available <= 3)
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
        Only {available} left!
      </span>
    )
  if (available <= threshold)
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
        Low Stock
      </span>
    )
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
      In Stock
    </span>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { addItem } = useCart()

  const [selectedColor, setSelectedColor] = useState('')
  const [selectedSize, setSelectedSize] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [addedFeedback, setAddedFeedback] = useState(false)

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ['buyer-product', id],
    queryFn: () => getProduct(Number(id)),
    enabled: !!id,
  })

  // Init selected color to first available
  useEffect(() => {
    if (product && !selectedColor) {
      const firstAvailable = product.skus.find((s) => (s.inventory?.available ?? 0) > 0)
      setSelectedColor(firstAvailable?.color ?? product.skus[0]?.color ?? '')
    }
  }, [product, selectedColor])

  // Reset size when color changes
  function handleColorChange(color: string) {
    setSelectedColor(color)
    setSelectedSize('')
    setQuantity(1)
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <p className="text-red-600 font-medium">Product not found</p>
        <button onClick={() => navigate('/shop')} className="mt-4 text-indigo-600 text-sm hover:underline">
          Back to Shop
        </button>
      </div>
    )
  }

  if (isLoading || !product) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-pulse">
          <div className="aspect-square bg-slate-100 rounded-2xl" />
          <div className="space-y-4">
            <div className="h-8 bg-slate-100 rounded w-3/4" />
            <div className="h-4 bg-slate-100 rounded w-full" />
            <div className="h-4 bg-slate-100 rounded w-2/3" />
            <div className="h-6 bg-slate-100 rounded w-32 mt-4" />
          </div>
        </div>
      </div>
    )
  }

  // Unique colors (preserving order of first appearance)
  const uniqueColors = [...new Set(product.skus.map((s) => s.color))]

  // SKUs of selected color
  const skusOfColor = product.skus.filter((s) => s.color === selectedColor)

  // Unique sizes for selected color, sorted
  const sizesForColor = [
    ...new Set(skusOfColor.map((s) => s.size)),
  ].sort((a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b))

  // Selected SKU
  const selectedSku = product.skus.find(
    (s) => s.color === selectedColor && s.size === selectedSize,
  )

  const available = selectedSku?.inventory?.available ?? 0
  const maxQty = Math.min(10, available)

  function handleAddToCart() {
    if (!selectedSku || !product || available === 0) return
    addItem(selectedSku, product, quantity)
    setAddedFeedback(true)
    setTimeout(() => setAddedFeedback(false), 2000)
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Back button */}
      <button
        onClick={() => navigate('/shop')}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6"
      >
        <ArrowLeft size={15} />
        Back to Shop
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
        {/* Left: image placeholder */}
        <div className="aspect-square bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-2xl flex items-center justify-center">
          <Package size={96} className="text-indigo-200" />
        </div>

        {/* Right: product info */}
        <div className="flex flex-col gap-5">
          {/* Name + type badge */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`text-xs font-medium px-2.5 py-0.5 rounded-full capitalize ${
                  product.type === 'shirt'
                    ? 'bg-blue-50 text-blue-600'
                    : 'bg-amber-50 text-amber-700'
                }`}
              >
                {product.type === 'shirt' ? 'Shirt' : 'Jeans'}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-800">{product.name}</h1>
            {product.description && (
              <p className="mt-2 text-sm text-slate-500 leading-relaxed">{product.description}</p>
            )}
          </div>

          {/* Price */}
          <div>
            {selectedSku ? (
              <p className="text-2xl font-bold text-indigo-700">
                {formatPKR(selectedSku.sale_price)}
              </p>
            ) : (
              <p className="text-lg font-semibold text-slate-500">
                {formatPKR(Math.min(...product.skus.map((s) => parseFloat(s.sale_price))))}
                {' '}– {formatPKR(Math.max(...product.skus.map((s) => parseFloat(s.sale_price))))}
              </p>
            )}
          </div>

          {/* Color selector */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2.5">
              Color{selectedColor && <span className="ml-1.5 font-normal text-slate-500 capitalize">{selectedColor}</span>}
            </p>
            <div className="flex gap-2.5 flex-wrap">
              {uniqueColors.map((color) => {
                const colorSkus = product.skus.filter((s) => s.color === color)
                const isAvailable = colorSkus.some((s) => (s.inventory?.available ?? 0) > 0)
                const hex = getColorHex(color)
                const isSelected = selectedColor === color

                return (
                  <button
                    key={color}
                    onClick={() => handleColorChange(color)}
                    title={color}
                    className={`relative h-9 w-9 rounded-full border-2 transition-all ${
                      isSelected
                        ? 'border-indigo-500 ring-2 ring-indigo-300 ring-offset-1'
                        : 'border-slate-300 hover:border-slate-400'
                    } ${!isAvailable ? 'opacity-40' : ''}`}
                    style={{ backgroundColor: hex }}
                  >
                    {!isAvailable && (
                      <span className="absolute inset-0 flex items-center justify-center text-slate-600 text-xs font-bold">
                        ×
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Size selector */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2.5">
              Size{selectedSize && <span className="ml-1.5 font-normal text-slate-500">{selectedSize}</span>}
            </p>
            <div className="flex gap-2 flex-wrap">
              {sizesForColor.map((size) => {
                const sku = skusOfColor.find((s) => s.size === size)
                const isAvailable = (sku?.inventory?.available ?? 0) > 0
                const isSelected = selectedSize === size

                return (
                  <button
                    key={size}
                    onClick={() => {
                      setSelectedSize(size)
                      setQuantity(1)
                    }}
                    disabled={!isAvailable}
                    className={`min-w-[44px] px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : isAvailable
                          ? 'border-slate-200 text-slate-700 hover:border-slate-300'
                          : 'border-slate-100 text-slate-300 line-through cursor-not-allowed'
                    }`}
                  >
                    {size}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Stock badge */}
          {selectedSku && (
            <div>
              <StockBadge sku={selectedSku} />
            </div>
          )}

          {/* Quantity */}
          {selectedSku && available > 0 && (
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2.5">Quantity</p>
              <div className="inline-flex items-center border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  className="px-3 py-2.5 hover:bg-slate-50 disabled:opacity-40 text-slate-600"
                >
                  <Minus size={14} />
                </button>
                <span className="px-4 py-2.5 text-sm font-semibold text-slate-800 min-w-[40px] text-center">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                  disabled={quantity >= maxQty}
                  className="px-3 py-2.5 hover:bg-slate-50 disabled:opacity-40 text-slate-600"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Add to cart */}
          <button
            onClick={handleAddToCart}
            disabled={!selectedSku || available === 0 || !selectedSize}
            className={`flex items-center justify-center gap-2 w-full rounded-2xl py-4 text-sm font-semibold transition-all ${
              addedFeedback
                ? 'bg-green-500 text-white'
                : !selectedSku || available === 0 || !selectedSize
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98]'
            }`}
          >
            <ShoppingCart size={16} />
            {addedFeedback
              ? 'Added to Cart!'
              : !selectedSize
                ? 'Select a Size'
                : available === 0
                  ? 'Out of Stock'
                  : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  )
}
