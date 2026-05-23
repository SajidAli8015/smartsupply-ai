import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, SlidersHorizontal, X, Package, ShoppingBag } from 'lucide-react'
import { getProducts } from '../../api/buyer'
import type { Product, ProductType } from '../../types'
import { formatPKR } from '../../lib/format'

// ── Constants ─────────────────────────────────────────────────────────────────

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '28', '30', '32', '34', '36']

// ── Helpers ───────────────────────────────────────────────────────────────────

function priceRange(product: Product): { min: number; max: number } {
  const prices = product.skus.map((s) => parseFloat(s.sale_price))
  return { min: Math.min(...prices), max: Math.max(...prices) }
}

function ProductCard({ product }: { product: Product }) {
  const navigate = useNavigate()
  const { min, max } = priceRange(product)
  const hasStock = product.skus.some((s) => (s.inventory?.available ?? 0) > 0)

  return (
    <div className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all duration-200 flex flex-col">
      {/* Placeholder image */}
      <div className="aspect-[4/3] bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center relative">
        <Package size={52} className="text-indigo-200" />
        {!hasStock && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
            <span className="text-xs font-semibold text-slate-500 bg-white rounded-full px-3 py-1 border border-slate-200">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col flex-1 gap-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">
            {product.name}
          </h3>
          <span
            className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${
              product.type === 'shirt'
                ? 'bg-blue-50 text-blue-600'
                : 'bg-amber-50 text-amber-700'
            }`}
          >
            {product.type === 'shirt' ? 'Shirt' : 'Jeans'}
          </span>
        </div>

        {product.description && (
          <p className="text-xs text-slate-400 line-clamp-2">{product.description}</p>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <div>
            <p className="text-xs text-slate-400">Starting from</p>
            <p className="text-sm font-bold text-slate-800">
              {min === max ? formatPKR(min) : `${formatPKR(min)} – ${formatPKR(max)}`}
            </p>
          </div>
          <button
            onClick={() => navigate(`/shop/${product.id}`)}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            View
          </button>
        </div>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-pulse">
      <div className="aspect-[4/3] bg-slate-100" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-slate-100 rounded w-3/4" />
        <div className="h-3 bg-slate-100 rounded w-full" />
        <div className="h-3 bg-slate-100 rounded w-1/2" />
        <div className="flex justify-between items-center pt-1">
          <div className="h-5 bg-slate-100 rounded w-24" />
          <div className="h-8 bg-slate-100 rounded-xl w-16" />
        </div>
      </div>
    </div>
  )
}

// ── Filters sidebar ───────────────────────────────────────────────────────────

function FilterPanel({
  typeFilter,
  setTypeFilter,
  selectedSizes,
  toggleSize,
  minPrice,
  setMinPrice,
  maxPrice,
  setMaxPrice,
  onReset,
}: {
  typeFilter: ProductType | 'all'
  setTypeFilter: (t: ProductType | 'all') => void
  selectedSizes: string[]
  toggleSize: (s: string) => void
  minPrice: string
  setMinPrice: (v: string) => void
  maxPrice: string
  setMaxPrice: (v: string) => void
  onReset: () => void
}) {
  const hasFilters =
    typeFilter !== 'all' || selectedSizes.length > 0 || minPrice !== '' || maxPrice !== ''

  return (
    <div className="space-y-6">
      {/* Type */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
          Category
        </p>
        <div className="space-y-1">
          {(['all', 'shirt', 'jeans'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                typeFilter === t
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t === 'all' ? 'All Products' : t === 'shirt' ? 'Shirts' : 'Jeans'}
            </button>
          ))}
        </div>
      </div>

      {/* Size */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Size</p>
        <div className="grid grid-cols-3 gap-1.5">
          {SIZES.map((s) => (
            <button
              key={s}
              onClick={() => toggleSize(s)}
              className={`rounded-lg border py-1.5 text-xs font-medium transition-colors ${
                selectedSizes.includes(s)
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Price range */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
          Price (PKR)
        </p>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Min"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <input
            type="number"
            placeholder="Max"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
      </div>

      {hasFilters && (
        <button
          onClick={onReset}
          className="w-full text-sm text-slate-400 hover:text-slate-600 py-1"
        >
          Reset all filters
        </button>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Shop() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<ProductType | 'all'>('all')
  const [selectedSizes, setSelectedSizes] = useState<string[]>([])
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  function handleSearchChange(v: string) {
    setSearch(v)
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => setDebouncedSearch(v), 300)
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['buyer-products'],
    queryFn: () => getProducts({ page_size: 100 }),
    staleTime: 5 * 60 * 1000,
  })

  const products = data?.items ?? []

  const filteredProducts = useMemo(() => {
    let result = products

    if (typeFilter !== 'all') {
      result = result.filter((p) => p.type === typeFilter)
    }

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase()
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q),
      )
    }

    if (selectedSizes.length > 0) {
      result = result.filter((p) => p.skus.some((s) => selectedSizes.includes(s.size)))
    }

    if (minPrice !== '') {
      const min = parseFloat(minPrice)
      result = result.filter((p) =>
        p.skus.some((s) => parseFloat(s.sale_price) >= min),
      )
    }

    if (maxPrice !== '') {
      const max = parseFloat(maxPrice)
      result = result.filter((p) =>
        p.skus.some((s) => parseFloat(s.sale_price) <= max),
      )
    }

    return result
  }, [products, typeFilter, debouncedSearch, selectedSizes, minPrice, maxPrice])

  function toggleSize(s: string) {
    setSelectedSizes((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    )
  }

  function resetFilters() {
    setTypeFilter('all')
    setSelectedSizes([])
    setMinPrice('')
    setMaxPrice('')
    setSearch('')
    setDebouncedSearch('')
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Shop</h1>
        <p className="mt-1 text-sm text-slate-500">
          {!isLoading && `${filteredProducts.length} product${filteredProducts.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Search + filter toggle */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search products…"
            className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          {search && (
            <button
              onClick={() => handleSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`lg:hidden flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
            showFilters
              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          <SlidersHorizontal size={15} />
          Filters
          {(typeFilter !== 'all' || selectedSizes.length > 0 || minPrice || maxPrice) && (
            <span className="h-4 w-4 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
              !
            </span>
          )}
        </button>
      </div>

      <div className="flex gap-8">
        {/* Sidebar — desktop always visible, mobile toggled */}
        <aside
          className={`w-52 shrink-0 ${showFilters ? 'block' : 'hidden'} lg:block`}
        >
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sticky top-24">
            <FilterPanel
              typeFilter={typeFilter}
              setTypeFilter={setTypeFilter}
              selectedSizes={selectedSizes}
              toggleSize={toggleSize}
              minPrice={minPrice}
              setMinPrice={setMinPrice}
              maxPrice={maxPrice}
              setMaxPrice={setMaxPrice}
              onReset={resetFilters}
            />
          </div>
        </aside>

        {/* Grid */}
        <div className="flex-1 min-w-0">
          {isError ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <p className="text-sm font-medium text-red-600">Failed to load products</p>
              <p className="text-xs text-slate-400 mt-1">Check your connection and try again</p>
            </div>
          ) : isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <ShoppingBag size={40} className="text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-600">No products found</p>
              <p className="text-xs text-slate-400 mt-1">
                Try adjusting your filters or search term
              </p>
              <button
                onClick={resetFilters}
                className="mt-4 text-sm text-indigo-600 hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map((product: Product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
