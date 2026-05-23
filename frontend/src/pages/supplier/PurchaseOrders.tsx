import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, X, ChevronRight, AlertCircle, ClipboardList, Check, ArrowRight,
} from 'lucide-react'
import {
  getPurchaseOrders, createPurchaseOrder, updatePOStatus, receivePO,
  type POCreatePayload,
} from '../../api/purchase_orders'
import { getFactories } from '../../api/factories'
import { getProducts } from '../../api/products'
import { useToast } from '../../contexts/ToastContext'
import { formatPKR, formatDate } from '../../lib/format'
import type { PurchaseOrder, POStatus, POLineItem, SKU } from '../../types'

// ── Status meta ───────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; badge: string; step: string }> = {
  draft:         { label: 'Draft',         badge: 'bg-slate-100 text-slate-600',   step: 'bg-slate-400' },
  placed:        { label: 'Placed',        badge: 'bg-blue-100 text-blue-700',     step: 'bg-blue-500' },
  confirmed:     { label: 'Confirmed',     badge: 'bg-violet-100 text-violet-700', step: 'bg-violet-500' },
  in_production: { label: 'In Production', badge: 'bg-amber-100 text-amber-700',   step: 'bg-amber-500' },
  shipped:       { label: 'Shipped',       badge: 'bg-orange-100 text-orange-700', step: 'bg-orange-500' },
  received:      { label: 'Received',      badge: 'bg-green-100 text-green-700',   step: 'bg-green-500' },
  cancelled:     { label: 'Cancelled',     badge: 'bg-red-100 text-red-600',       step: 'bg-red-400' },
}

const PIPELINE: POStatus[] = ['draft', 'placed', 'confirmed', 'in_production', 'shipped', 'received']

const NEXT_STATUS: Partial<Record<POStatus, POStatus>> = {
  draft:         'placed',
  placed:        'confirmed',
  confirmed:     'in_production',
  in_production: 'shipped',
  shipped:       'received',
}

const STATUS_TABS: { label: string; value: POStatus | '' }[] = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'draft' },
  { label: 'Placed', value: 'placed' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'In Production', value: 'in_production' },
  { label: 'Shipped', value: 'shipped' },
  { label: 'Received', value: 'received' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputCls = 'h-9 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
const labelCls = 'mb-1 block text-xs font-medium text-slate-600'

function poTotal(po: PurchaseOrder): number {
  return po.line_items.reduce((s, li) => s + parseFloat(li.unit_cost) * li.quantity_ordered, 0)
}

function lineTotal(unitCost: string, qty: string): number {
  const c = parseFloat(unitCost)
  const q = parseInt(qty, 10)
  return isNaN(c) || isNaN(q) ? 0 : c * q
}

// ── Status stepper ────────────────────────────────────────────────────────────

function StatusStepper({ status }: { status: POStatus }) {
  const currentIdx = PIPELINE.indexOf(status)
  return (
    <div className="flex items-center gap-1 overflow-x-auto py-1">
      {PIPELINE.map((s, i) => {
        const done = i < currentIdx
        const active = i === currentIdx
        const meta = STATUS_META[s]
        return (
          <div key={s} className="flex shrink-0 items-center gap-1">
            <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white ${
              done ? 'bg-green-500' : active ? meta.step : 'bg-slate-200'
            }`}>
              {done ? <Check size={12} /> : i + 1}
            </div>
            <span className={`text-xs font-medium ${active ? 'text-slate-800' : done ? 'text-green-600' : 'text-slate-400'}`}>
              {meta.label}
            </span>
            {i < PIPELINE.length - 1 && (
              <ChevronRight size={14} className="text-slate-300" />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Receive PO modal ──────────────────────────────────────────────────────────

function ReceivePOModal({ po, onClose }: { po: PurchaseOrder; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [quantities, setQuantities] = useState<Record<number, string>>(
    Object.fromEntries(po.line_items.map((li) => [li.sku_id, String(li.quantity_ordered)])),
  )

  const mut = useMutation({
    mutationFn: () =>
      receivePO(
        po.id,
        po.line_items.map((li) => ({
          sku_id: li.sku_id,
          quantity_received: parseInt(quantities[li.sku_id] ?? '0', 10),
        })),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      toast.success('Purchase order received — inventory updated')
      onClose()
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      toast.error(e.response?.data?.detail ?? 'Failed to receive PO'),
  })

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Receive Purchase Order #{po.id}</h2>
            <p className="text-xs text-slate-400">Enter actual quantities received per line item</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
        </div>

        <div className="p-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-2 text-left text-xs font-medium text-slate-400">SKU</th>
                <th className="pb-2 text-right text-xs font-medium text-slate-400">Ordered</th>
                <th className="pb-2 text-right text-xs font-medium text-slate-400">Receiving</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {po.line_items.map((li) => (
                <tr key={li.sku_id}>
                  <td className="py-2.5 font-mono text-xs font-semibold text-slate-700">{li.sku_code || `SKU #${li.sku_id}`}</td>
                  <td className="py-2.5 text-right text-slate-500">{li.quantity_ordered}</td>
                  <td className="py-2.5 text-right">
                    <input
                      type="number"
                      min="0"
                      max={li.quantity_ordered}
                      className="h-8 w-24 rounded-lg border border-slate-300 px-2 text-right text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      value={quantities[li.sku_id] ?? ''}
                      onChange={(e) => setQuantities((q) => ({ ...q, [li.sku_id]: e.target.value }))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-5 flex justify-end gap-3">
            <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
            <button
              onClick={() => mut.mutate()}
              disabled={mut.isPending}
              className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
            >
              {mut.isPending ? 'Processing…' : 'Confirm Receipt'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── PO detail slide-over ──────────────────────────────────────────────────────

function PODetailSlideOver({ po, onClose }: { po: PurchaseOrder; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [receiveOpen, setReceiveOpen] = useState(false)

  const nextStatus = NEXT_STATUS[po.status]
  const isTerminal = po.status === 'received' || po.status === 'cancelled'

  const advanceMut = useMutation({
    mutationFn: () => updatePOStatus(po.id, nextStatus!),
    onSuccess: (updated) => {
      void qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      toast.success(`Status updated to ${STATUS_META[updated.status]?.label}`)
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      toast.error(e.response?.data?.detail ?? 'Failed to update status'),
  })

  const total = poTotal(po)

  return (
    <>
      <div className={`fixed inset-0 z-40`}>
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <h2 className="text-base font-semibold text-slate-800">Purchase Order #{po.id}</h2>
              <p className="mt-0.5 text-xs text-slate-400">
                {po.factory.name} · Created {formatDate(po.created_at)}
                {po.expected_delivery_date && ` · Expected ${formatDate(po.expected_delivery_date)}`}
              </p>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
          </div>

          {/* Status stepper */}
          <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
            <StatusStepper status={po.status} />
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Meta */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-slate-400">Status</p>
                <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_META[po.status]?.badge}`}>
                  {STATUS_META[po.status]?.label}
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-400">Factory</p>
                <p className="mt-1 text-sm font-medium text-slate-700">{po.factory.name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Items</p>
                <p className="mt-1 text-sm font-medium text-slate-700">{po.line_items.length} SKU{po.line_items.length !== 1 ? 's' : ''}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Total Value</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{formatPKR(total)}</p>
              </div>
            </div>

            {po.notes && (
              <div className="rounded-lg bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium text-slate-400">Notes</p>
                <p className="mt-1 text-sm text-slate-700">{po.notes}</p>
              </div>
            )}

            {/* Line items */}
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Line Items</h3>
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-400">SKU</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-400">Ordered</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-400">Received</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-400">Unit Cost</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-400">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {po.line_items.map((li: POLineItem) => (
                      <tr key={li.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">
                          {li.sku_code || `SKU #${li.sku_id}`}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">{li.quantity_ordered}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={li.quantity_received > 0 ? 'font-medium text-green-600' : 'text-slate-300'}>
                            {li.quantity_received > 0 ? li.quantity_received : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">{formatPKR(parseFloat(li.unit_cost))}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700">
                          {formatPKR(parseFloat(li.unit_cost) * li.quantity_ordered)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200 bg-slate-50">
                      <td colSpan={4} className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600">Grand Total</td>
                      <td className="px-4 py-2.5 text-right text-sm font-bold text-slate-800">{formatPKR(total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          {/* Actions footer */}
          {!isTerminal && (
            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
              {po.status === 'shipped' ? (
                <button
                  onClick={() => setReceiveOpen(true)}
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700"
                >
                  <Check size={15} />
                  Receive PO
                </button>
              ) : (
                <div />
              )}
              {nextStatus && po.status !== 'shipped' && (
                <button
                  onClick={() => advanceMut.mutate()}
                  disabled={advanceMut.isPending}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {advanceMut.isPending ? 'Updating…' : <>Advance to {STATUS_META[nextStatus]?.label} <ArrowRight size={14} /></>}
                </button>
              )}
              {po.status !== 'shipped' && !nextStatus && <div />}
            </div>
          )}
        </div>
      </div>

      {receiveOpen && <ReceivePOModal po={po} onClose={() => setReceiveOpen(false)} />}
    </>
  )
}

// ── Create PO slide-over ──────────────────────────────────────────────────────

interface LineItemRow {
  key: number
  skuId: string
  quantity: string
  unitCost: string
}

const blankLine = (): LineItemRow => ({ key: Date.now() + Math.random(), skuId: '', quantity: '', unitCost: '' })

function CreatePOSlideOver({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [factoryId, setFactoryId] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineItemRow[]>([blankLine()])
  const [err, setErr] = useState('')

  // Reset when opening
  const resetForm = () => { setStep(1); setFactoryId(''); setDeliveryDate(''); setNotes(''); setLines([blankLine()]); setErr('') }
  const handleClose = () => { resetForm(); onClose() }

  const { data: factoriesData } = useQuery({
    queryKey: ['factories'],
    queryFn: () => getFactories(),
    enabled: open,
  })

  const { data: productsData } = useQuery({
    queryKey: ['products-all'],
    queryFn: () => getProducts({ page_size: 500 }),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  })

  // Flat SKU list for selector
  const skuOptions = useMemo<Array<{ sku: SKU; productName: string }>>(() => {
    if (!productsData) return []
    return productsData.items.flatMap((p) =>
      p.skus.map((s) => ({ sku: s, productName: p.name })),
    )
  }, [productsData])

  const factories = factoriesData?.items.filter((f) => f.is_active) ?? []

  const runningTotal = lines.reduce((s, l) => s + lineTotal(l.unitCost, l.quantity), 0)

  const mut = useMutation({
    mutationFn: (payload: POCreatePayload) => createPurchaseOrder(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      toast.success('Purchase order created')
      handleClose()
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => {
      setErr(e.response?.data?.detail ?? 'Failed to create purchase order')
      setStep(3)
    },
  })

  function goNext() {
    setErr('')
    if (step === 1) {
      if (!factoryId) { setErr('Please select a factory'); return }
      setStep(2)
    } else if (step === 2) {
      const valid = lines.filter((l) => l.skuId && l.quantity && l.unitCost)
      if (!valid.length) { setErr('Add at least one line item'); return }
      setStep(3)
    }
  }

  function handleSubmit() {
    setErr('')
    const validLines = lines.filter((l) => l.skuId && l.quantity && l.unitCost)
    mut.mutate({
      factory_id: parseInt(factoryId, 10),
      expected_delivery_date: deliveryDate || undefined,
      notes: notes || undefined,
      line_items: validLines.map((l) => ({
        sku_id: parseInt(l.skuId, 10),
        quantity_ordered: parseInt(l.quantity, 10),
        unit_cost: parseFloat(l.unitCost),
      })),
    })
  }

  const selectedFactory = factories.find((f) => f.id === parseInt(factoryId, 10))

  return (
    <div className={`fixed inset-0 z-40 ${open ? '' : 'pointer-events-none'}`}>
      <div className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`} onClick={handleClose} />
      <div className={`absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-white shadow-2xl transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Create Purchase Order</h2>
            <p className="text-xs text-slate-400">Step {step} of 3</p>
          </div>
          <button onClick={handleClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>

        {/* Step indicators */}
        <div className="flex border-b border-slate-100">
          {(['Factory & Details', 'Line Items', 'Review'] as const).map((label, i) => (
            <div key={label} className={`flex-1 py-2.5 text-center text-xs font-medium ${step === i + 1 ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-400'}`}>
              {label}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Factory *</label>
                <select className={inputCls} value={factoryId} onChange={(e) => setFactoryId(e.target.value)}>
                  <option value="">Select a factory…</option>
                  {factories.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}{f.lead_time_days ? ` (${f.lead_time_days}d lead time)` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Expected delivery date</label>
                <input className={inputCls} type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <textarea
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  rows={3}
                  placeholder="Fabric specs, special instructions…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-500">Add SKUs and quantities</p>
                <button onClick={() => setLines((ls) => [...ls, blankLine()])} className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline">
                  <Plus size={12} />Add item
                </button>
              </div>

              {lines.map((line, i) => (
                <div key={line.key} className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className={labelCls}>SKU *</label>
                      <select
                        className={inputCls}
                        value={line.skuId}
                        onChange={(e) => setLines((ls) => ls.map((l, idx) => idx === i ? { ...l, skuId: e.target.value } : l))}
                      >
                        <option value="">Select SKU…</option>
                        {skuOptions.map(({ sku, productName }) => (
                          <option key={sku.id} value={sku.id}>
                            {sku.sku_code} — {productName} ({sku.color}/{sku.size})
                          </option>
                        ))}
                      </select>
                    </div>
                    {lines.length > 1 && (
                      <button
                        onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
                        className="mt-5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-200 text-red-400 hover:bg-red-50"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Quantity *</label>
                      <input
                        className={inputCls}
                        type="number"
                        min="1"
                        placeholder="0"
                        value={line.quantity}
                        onChange={(e) => setLines((ls) => ls.map((l, idx) => idx === i ? { ...l, quantity: e.target.value } : l))}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Unit cost (PKR) *</label>
                      <input
                        className={inputCls}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={line.unitCost}
                        onChange={(e) => setLines((ls) => ls.map((l, idx) => idx === i ? { ...l, unitCost: e.target.value } : l))}
                      />
                    </div>
                  </div>
                  {line.skuId && line.quantity && line.unitCost && (
                    <p className="text-right text-xs font-medium text-slate-600">
                      Subtotal: {formatPKR(lineTotal(line.unitCost, line.quantity))}
                    </p>
                  )}
                </div>
              ))}

              <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-right">
                <span className="text-xs text-slate-500">Running total: </span>
                <span className="ml-1 text-sm font-bold text-indigo-700">{formatPKR(runningTotal)}</span>
              </div>
            </div>
          )}

          {/* Step 3 — Review */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="rounded-lg border border-slate-200 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Factory</span>
                  <span className="font-medium text-slate-800">{selectedFactory?.name}</span>
                </div>
                {deliveryDate && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Expected delivery</span>
                    <span className="font-medium text-slate-800">{formatDate(deliveryDate)}</span>
                  </div>
                )}
                {notes && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Notes</span>
                    <span className="max-w-[60%] text-right text-slate-700">{notes}</span>
                  </div>
                )}
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Line Items</h3>
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-400">SKU</th>
                        <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-400">Qty</th>
                        <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-400">Unit Cost</th>
                        <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-400">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {lines.filter((l) => l.skuId && l.quantity && l.unitCost).map((l) => {
                        const opt = skuOptions.find((o) => o.sku.id === parseInt(l.skuId, 10))
                        return (
                          <tr key={l.key}>
                            <td className="px-4 py-2.5 font-mono text-xs text-slate-700">
                              {opt?.sku.sku_code ?? `SKU #${l.skuId}`}
                            </td>
                            <td className="px-4 py-2.5 text-right text-slate-600">{l.quantity}</td>
                            <td className="px-4 py-2.5 text-right text-slate-600">{formatPKR(parseFloat(l.unitCost))}</td>
                            <td className="px-4 py-2.5 text-right font-medium text-slate-700">{formatPKR(lineTotal(l.unitCost, l.quantity))}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-200 bg-slate-50">
                        <td colSpan={3} className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600">Grand Total</td>
                        <td className="px-4 py-2.5 text-right text-sm font-bold text-indigo-700">{formatPKR(runningTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {err && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
                  <AlertCircle size={14} className="shrink-0" />{err}
                </div>
              )}
            </div>
          )}

          {err && step !== 3 && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
              <AlertCircle size={14} className="shrink-0" />{err}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between border-t border-slate-200 px-6 py-4">
          <button
            onClick={() => step > 1 ? setStep((s) => (s - 1) as 1 | 2 | 3) : handleClose()}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          {step < 3 ? (
            <button onClick={goNext} className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
              Next <ChevronRight size={14} className="inline" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={mut.isPending}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {mut.isPending ? 'Creating…' : 'Create PO'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PurchaseOrders() {
  const [statusFilter, setStatusFilter] = useState<POStatus | ''>('')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [detailPO, setDetailPO] = useState<PurchaseOrder | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['purchase-orders', statusFilter, page],
    queryFn: () =>
      getPurchaseOrders({ status: statusFilter || undefined, page, page_size: 20 }),
  })

  const pos = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = data?.total_pages ?? 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Purchase Orders</h1>
          {!isLoading && <p className="mt-0.5 text-sm text-slate-400">{total.toLocaleString()} order{total !== 1 ? 's' : ''}</p>}
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          <Plus size={16} />
          Create PO
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm gap-1">
        {STATUS_TABS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => { setStatusFilter(value); setPage(1) }}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === value
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {isLoading && (
          <div className="animate-pulse divide-y divide-slate-100">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="h-3 w-16 rounded bg-slate-200" />
                <div className="h-3 flex-1 rounded bg-slate-200" />
                <div className="h-5 w-20 rounded-full bg-slate-200" />
                <div className="h-3 w-10 rounded bg-slate-200" />
                <div className="h-3 w-24 rounded bg-slate-200" />
                <div className="h-3 w-20 rounded bg-slate-200" />
              </div>
            ))}
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <AlertCircle size={24} className="text-red-400" />
            <p className="text-sm text-slate-600">Failed to load purchase orders</p>
            <button onClick={() => void refetch()} className="text-sm font-medium text-indigo-600 hover:underline">Retry</button>
          </div>
        )}

        {!isLoading && !isError && pos.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <ClipboardList size={22} className="text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-700">No purchase orders</p>
            <p className="text-xs text-slate-400">
              {statusFilter ? `No orders with status "${STATUS_META[statusFilter]?.label}"` : 'Create your first PO to get started'}
            </p>
          </div>
        )}

        {!isLoading && !isError && pos.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">PO #</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">Factory</th>
                    <th className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wide text-slate-400">Status</th>
                    <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-400">Items</th>
                    <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-400">Total Value</th>
                    <th className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wide text-slate-400">Expected</th>
                    <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-400">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {pos.map((po) => (
                    <tr
                      key={po.id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => setDetailPO(po)}
                    >
                      <td className="px-5 py-3.5 font-mono text-xs font-semibold text-slate-600">
                        #{String(po.id).padStart(5, '0')}
                      </td>
                      <td className="px-3 py-3.5 font-medium text-slate-700">{po.factory.name}</td>
                      <td className="px-3 py-3.5 text-center">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_META[po.status]?.badge}`}>
                          {STATUS_META[po.status]?.label}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-right text-slate-500">
                        {po.line_items.reduce((s, li) => s + li.quantity_ordered, 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-3.5 text-right font-medium text-slate-700">{formatPKR(poTotal(po))}</td>
                      <td className="px-3 py-3.5 text-center text-slate-500">
                        {po.expected_delivery_date ? formatDate(po.expected_delivery_date) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-right text-slate-400 text-xs">{formatDate(po.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
                <p className="text-xs text-slate-400">{total.toLocaleString()} total</p>
                <div className="flex gap-2">
                  <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40">Previous</button>
                  <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <CreatePOSlideOver open={createOpen} onClose={() => setCreateOpen(false)} />
      {detailPO && <PODetailSlideOver po={detailPO} onClose={() => setDetailPO(null)} />}
    </div>
  )
}
