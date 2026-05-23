import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, X, Search, PackageOpen, AlertCircle } from 'lucide-react'
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  addSKU,
  type ProductCreatePayload,
  type ProductUpdatePayload,
  type SKUCreatePayload,
} from '../../api/products'
import { formatPKR } from '../../lib/format'
import type { Product, ProductType } from '../../types'

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

const TYPE_LABELS: Record<ProductType, string> = { shirt: 'Shirt', jeans: 'Jeans' }
const TYPE_BADGE: Record<ProductType, string> = {
  shirt: 'bg-indigo-100 text-indigo-700',
  jeans: 'bg-amber-100 text-amber-700',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPriceRange(p: Product): string {
  if (!p.skus.length) return formatPKR(parseFloat(p.base_price))
  const prices = p.skus.map((s) => parseFloat(s.sale_price))
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  if (min === max) return formatPKR(min)
  return `${formatPKR(min)} – ${formatPKR(max)}`
}

function getTotalStock(p: Product): number {
  return p.skus.reduce((sum, s) => sum + (s.inventory?.available ?? 0), 0)
}

// ── SKU form row ──────────────────────────────────────────────────────────────

interface SkuRow {
  key: number
  sku_code: string
  color: string
  size: string
  sale_price: string
  cost_price: string
}

const blankSku = (): SkuRow => ({
  key: Date.now() + Math.random(),
  sku_code: '',
  color: '',
  size: '',
  sale_price: '',
  cost_price: '',
})

function SkuFormRow({
  sku,
  onChange,
  onRemove,
  canRemove,
}: {
  sku: SkuRow
  onChange: (s: SkuRow) => void
  onRemove: () => void
  canRemove: boolean
}) {
  const f = (field: keyof SkuRow) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...sku, [field]: e.target.value })

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="grid grid-cols-3 gap-2">
        <input
          className={inputCls}
          placeholder="SKU code *"
          value={sku.sku_code}
          onChange={f('sku_code')}
          required
        />
        <input className={inputCls} placeholder="Color *" value={sku.color} onChange={f('color')} required />
        <input className={inputCls} placeholder="Size *" value={sku.size} onChange={f('size')} required />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <input
          className={inputCls}
          placeholder="Sale price *"
          type="number"
          min="0"
          step="0.01"
          value={sku.sale_price}
          onChange={f('sale_price')}
          required
        />
        <div className="flex gap-2">
          <input
            className={`${inputCls} flex-1`}
            placeholder="Cost price *"
            type="number"
            min="0"
            step="0.01"
            value={sku.cost_price}
            onChange={f('cost_price')}
            required
          />
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Input class ───────────────────────────────────────────────────────────────

const inputCls =
  'h-9 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'

const labelCls = 'mb-1 block text-xs font-medium text-slate-600'

// ── Slide-over ────────────────────────────────────────────────────────────────

interface SlideOverProps {
  open: boolean
  onClose: () => void
  editing: Product | null
  onSuccess: () => void
}

function ProductSlideOver({ open, onClose, editing, onSuccess }: SlideOverProps) {
  const qc = useQueryClient()

  const [form, setForm] = useState({ name: '', type: 'shirt' as ProductType, description: '', base_price: '', cost_price: '' })
  const [newSkus, setNewSkus] = useState<SkuRow[]>([blankSku()])
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      if (editing) {
        setForm({
          name: editing.name,
          type: editing.type,
          description: editing.description ?? '',
          base_price: editing.base_price,
          cost_price: editing.cost_price,
        })
        setNewSkus([])
      } else {
        setForm({ name: '', type: 'shirt', description: '', base_price: '', cost_price: '' })
        setNewSkus([blankSku()])
      }
      setError('')
    }
  }, [open, editing])

  const createMut = useMutation({
    mutationFn: createProduct,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['products'] }); onSuccess() },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      setError(e.response?.data?.detail ?? 'Failed to create product'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ProductUpdatePayload }) => updateProduct(id, data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['products'] }); onSuccess() },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      setError(e.response?.data?.detail ?? 'Failed to update product'),
  })

  const addSkuMut = useMutation({
    mutationFn: ({ productId, data }: { productId: number; data: SKUCreatePayload }) =>
      addSKU(productId, data),
  })

  const busy = createMut.isPending || updateMut.isPending || addSkuMut.isPending

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const base = parseFloat(form.base_price)
    const cost = parseFloat(form.cost_price)
    if (isNaN(base) || base <= 0 || isNaN(cost) || cost <= 0) {
      setError('Prices must be positive numbers')
      return
    }

    if (editing) {
      const payload: ProductUpdatePayload = {
        name: form.name,
        type: form.type,
        description: form.description || undefined,
        base_price: base,
        cost_price: cost,
      }
      updateMut.mutate(
        { id: editing.id, data: payload },
        {
          onSuccess: async (updated) => {
            for (const sku of newSkus) {
              if (!sku.sku_code || !sku.color || !sku.size || !sku.sale_price || !sku.cost_price) continue
              await addSkuMut.mutateAsync({
                productId: updated.id,
                data: {
                  sku_code: sku.sku_code,
                  color: sku.color,
                  size: sku.size,
                  sale_price: parseFloat(sku.sale_price),
                  cost_price: parseFloat(sku.cost_price),
                },
              })
            }
            void qc.invalidateQueries({ queryKey: ['products'] })
            onSuccess()
          },
        },
      )
    } else {
      const skusPayload: SKUCreatePayload[] = newSkus
        .filter((s) => s.sku_code && s.color && s.size && s.sale_price && s.cost_price)
        .map((s) => ({
          sku_code: s.sku_code,
          color: s.color,
          size: s.size,
          sale_price: parseFloat(s.sale_price),
          cost_price: parseFloat(s.cost_price),
        }))

      const payload: ProductCreatePayload = {
        name: form.name,
        type: form.type,
        description: form.description || undefined,
        base_price: base,
        cost_price: cost,
        skus: skusPayload,
      }
      createMut.mutate(payload)
    }
  }

  return (
    <div className={`fixed inset-0 z-40 ${open ? '' : 'pointer-events-none'}`}>
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={`absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-white shadow-2xl transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-800">
            {editing ? 'Edit Product' : 'Add Product'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form id="product-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Product fields */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Product Details
            </h3>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Product name *</label>
                <input
                  className={inputCls}
                  placeholder="e.g. Oxford Dress Shirt"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>

              <div>
                <label className={labelCls}>Type *</label>
                <select
                  className={inputCls}
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ProductType }))}
                >
                  <option value="shirt">Shirt</option>
                  <option value="jeans">Jeans</option>
                </select>
              </div>

              <div>
                <label className={labelCls}>Description</label>
                <textarea
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  rows={2}
                  placeholder="Optional product description"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Base price (PKR) *</label>
                  <input
                    className={inputCls}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.base_price}
                    onChange={(e) => setForm((f) => ({ ...f, base_price: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Cost price (PKR) *</label>
                  <input
                    className={inputCls}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.cost_price}
                    onChange={(e) => setForm((f) => ({ ...f, cost_price: e.target.value }))}
                    required
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Existing SKUs (edit mode) */}
          {editing && editing.skus.length > 0 && (
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Existing SKUs ({editing.skus.length})
              </h3>
              <div className="space-y-2">
                {editing.skus.map((sku) => (
                  <div
                    key={sku.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <div>
                      <span className="text-sm font-medium text-slate-700">{sku.sku_code}</span>
                      <span className="ml-2 text-xs text-slate-400">
                        {sku.color} / {sku.size}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-slate-700">{formatPKR(parseFloat(sku.sale_price))}</p>
                      <p className="text-xs text-slate-400">
                        Stock: {sku.inventory?.available ?? 0}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* New SKUs */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {editing ? 'Add New SKUs' : 'SKUs'}
              </h3>
              <button
                type="button"
                onClick={() => setNewSkus((s) => [...s, blankSku()])}
                className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
              >
                <Plus size={12} />
                Add SKU
              </button>
            </div>

            {newSkus.length === 0 && editing && (
              <p className="text-xs text-slate-400">Click "Add SKU" to append more variants.</p>
            )}

            <div className="space-y-2">
              {newSkus.map((sku, i) => (
                <SkuFormRow
                  key={sku.key}
                  sku={sku}
                  canRemove={!editing ? newSkus.length > 1 : true}
                  onChange={(updated) =>
                    setNewSkus((rows) => rows.map((r, idx) => (idx === i ? updated : r)))
                  }
                  onRemove={() => setNewSkus((rows) => rows.filter((_, idx) => idx !== i))}
                />
              ))}
            </div>
          </section>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
              <AlertCircle size={14} className="shrink-0" />
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="product-form"
            disabled={busy}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {busy ? 'Saving…' : editing ? 'Save Changes' : 'Create Product'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete dialog ─────────────────────────────────────────────────────────────

function DeleteDialog({
  product,
  onConfirm,
  onCancel,
  busy,
}: {
  product: Product
  onConfirm: () => void
  onCancel: () => void
  busy: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
          <Trash2 size={18} className="text-red-600" />
        </div>
        <h3 className="mt-3 text-base font-semibold text-slate-800">Delete product?</h3>
        <p className="mt-1 text-sm text-slate-500">
          <span className="font-medium text-slate-700">"{product.name}"</span> and all its SKUs
          will be permanently removed. This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {busy ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Products() {
  const qc = useQueryClient()

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<ProductType | ''>('')
  const [page, setPage] = useState(1)
  const [slideOverOpen, setSlideOverOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Product | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['products', page, typeFilter, debouncedSearch],
    queryFn: () =>
      getProducts({
        page,
        page_size: PAGE_SIZE,
        type: typeFilter || undefined,
        search: debouncedSearch || undefined,
      }),
  })

  const deleteMut = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['products'] })
      setDeleteTarget(null)
    },
  })

  function openAdd() {
    setEditTarget(null)
    setSlideOverOpen(true)
  }

  function openEdit(p: Product) {
    setEditTarget(p)
    setSlideOverOpen(true)
  }

  function closeSlideOver() {
    setSlideOverOpen(false)
    setEditTarget(null)
  }

  const products = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = data?.total_pages ?? 0

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Products</h1>
          {!isLoading && (
            <p className="mt-0.5 text-sm text-slate-400">
              {total.toLocaleString()} product{total !== 1 ? 's' : ''} total
            </p>
          )}
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          <Plus size={16} />
          Add Product
        </button>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="h-9 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {(['', 'shirt', 'jeans'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTypeFilter(t); setPage(1) }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                typeFilter === t
                  ? 'bg-indigo-600 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              {t === '' ? 'All' : TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {isLoading && (
          <div className="animate-pulse divide-y divide-slate-100">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="h-4 flex-1 rounded bg-slate-200" />
                <div className="h-5 w-14 rounded-full bg-slate-200" />
                <div className="h-4 w-8 rounded bg-slate-200" />
                <div className="h-4 w-32 rounded bg-slate-200" />
                <div className="h-4 w-12 rounded bg-slate-200" />
                <div className="flex gap-2">
                  <div className="h-7 w-7 rounded bg-slate-200" />
                  <div className="h-7 w-7 rounded bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <AlertCircle size={24} className="text-red-400" />
            <p className="text-sm text-slate-600">Failed to load products</p>
            <button
              onClick={() => void refetch()}
              className="text-sm font-medium text-indigo-600 hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && !isError && products.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <PackageOpen size={22} className="text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-700">No products found</p>
            <p className="text-xs text-slate-400">
              {debouncedSearch || typeFilter ? 'Try adjusting your filters' : 'Add your first product to get started'}
            </p>
            {!debouncedSearch && !typeFilter && (
              <button
                onClick={openAdd}
                className="mt-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Add Product
              </button>
            )}
          </div>
        )}

        {!isLoading && !isError && products.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                      Name
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                      Type
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wide text-slate-400">
                      SKUs
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-400">
                      Price Range
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-400">
                      Stock
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-800">{product.name}</p>
                        {product.description && (
                          <p className="mt-0.5 max-w-xs truncate text-xs text-slate-400">
                            {product.description}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3.5">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${TYPE_BADGE[product.type]}`}>
                          {TYPE_LABELS[product.type]}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-center text-slate-600">
                        {product.skus.length}
                      </td>
                      <td className="px-3 py-3.5 text-right text-slate-700">
                        {getPriceRange(product)}
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <span
                          className={`font-medium ${
                            getTotalStock(product) === 0
                              ? 'text-red-500'
                              : getTotalStock(product) < 20
                              ? 'text-amber-600'
                              : 'text-slate-700'
                          }`}
                        >
                          {getTotalStock(product).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(product)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(product)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
                <p className="text-xs text-slate-400">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of{' '}
                  {total.toLocaleString()}
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

      {/* ── Slide-over ───────────────────────────────────────────────────── */}
      <ProductSlideOver
        open={slideOverOpen}
        onClose={closeSlideOver}
        editing={editTarget}
        onSuccess={closeSlideOver}
      />

      {/* ── Delete confirm ────────────────────────────────────────────────── */}
      {deleteTarget && (
        <DeleteDialog
          product={deleteTarget}
          busy={deleteMut.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteMut.mutate(deleteTarget.id)}
        />
      )}
    </div>
  )
}
