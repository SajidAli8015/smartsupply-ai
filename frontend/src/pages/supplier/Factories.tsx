import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, X, Factory as FactoryIcon, AlertCircle, Phone, Mail } from 'lucide-react'
import {
  getFactories,
  createFactory,
  updateFactory,
  deleteFactory,
  type FactoryCreatePayload,
} from '../../api/factories'
import { useToast } from '../../contexts/ToastContext'
import type { Factory } from '../../types'

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputCls =
  'h-9 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
const labelCls = 'mb-1 block text-xs font-medium text-slate-600'

// ── Slide-over ────────────────────────────────────────────────────────────────

interface SlideOverProps {
  open: boolean
  onClose: () => void
  editing: Factory | null
}

const EMPTY: FactoryCreatePayload = {
  name: '', contact_person: '', email: '', phone: '', address: '', lead_time_days: undefined, is_active: true,
}

function FactorySlideOver({ open, onClose, editing }: SlideOverProps) {
  const qc = useQueryClient()
  const toast = useToast()
  const [form, setForm] = useState<FactoryCreatePayload>(EMPTY)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (open) {
      setErr('')
      setForm(
        editing
          ? {
              name: editing.name,
              contact_person: editing.contact_person ?? '',
              email: editing.email ?? '',
              phone: editing.phone ?? '',
              address: editing.address ?? '',
              lead_time_days: editing.lead_time_days ?? undefined,
              is_active: editing.is_active,
            }
          : EMPTY,
      )
    }
  }, [open, editing])

  const set = (k: keyof FactoryCreatePayload) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }))

  const createMut = useMutation({
    mutationFn: createFactory,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['factories'] })
      toast.success('Factory created')
      onClose()
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => {
      setErr(e.response?.data?.detail ?? 'Failed to create factory')
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FactoryCreatePayload }) =>
      updateFactory(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['factories'] })
      toast.success('Factory updated')
      onClose()
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => {
      setErr(e.response?.data?.detail ?? 'Failed to update factory')
    },
  })

  const busy = createMut.isPending || updateMut.isPending

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    const payload: FactoryCreatePayload = {
      name: form.name,
      contact_person: form.contact_person || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      address: form.address || undefined,
      lead_time_days: form.lead_time_days ? Number(form.lead_time_days) : undefined,
      is_active: form.is_active,
    }
    if (editing) {
      updateMut.mutate({ id: editing.id, data: payload })
    } else {
      createMut.mutate(payload)
    }
  }

  return (
    <div className={`fixed inset-0 z-40 ${open ? '' : 'pointer-events-none'}`}>
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <div
        className={`absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-800">
            {editing ? 'Edit Factory' : 'Add Factory'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <form id="factory-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className={labelCls}>Factory name *</label>
            <input className={inputCls} value={form.name} onChange={set('name')} required placeholder="e.g. Lahore Weaving Co." />
          </div>
          <div>
            <label className={labelCls}>Contact person</label>
            <input className={inputCls} value={form.contact_person ?? ''} onChange={set('contact_person')} placeholder="Full name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Email</label>
              <input className={inputCls} type="email" value={form.email ?? ''} onChange={set('email')} placeholder="contact@factory.com" />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input className={inputCls} value={form.phone ?? ''} onChange={set('phone')} placeholder="+92 300 000 0000" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Address</label>
            <textarea
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              rows={2}
              value={form.address ?? ''}
              onChange={set('address')}
              placeholder="Street, city, country"
            />
          </div>
          <div>
            <label className={labelCls}>Lead time (days)</label>
            <input
              className={inputCls}
              type="number"
              min="1"
              value={form.lead_time_days ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, lead_time_days: e.target.value ? parseInt(e.target.value) : undefined }))}
              placeholder="e.g. 14"
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              id="is_active"
              type="checkbox"
              checked={form.is_active ?? true}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="is_active" className="text-sm text-slate-700">Active factory</label>
          </div>
          {err && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
              <AlertCircle size={14} className="shrink-0" />
              {err}
            </div>
          )}
        </form>

        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" form="factory-form" disabled={busy} className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
            {busy ? 'Saving…' : editing ? 'Save Changes' : 'Add Factory'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete dialog ─────────────────────────────────────────────────────────────

function DeleteDialog({ factory, onConfirm, onCancel, busy }: { factory: Factory; onConfirm: () => void; onCancel: () => void; busy: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
          <Trash2 size={18} className="text-red-600" />
        </div>
        <h3 className="mt-3 text-base font-semibold text-slate-800">Delete factory?</h3>
        <p className="mt-1 text-sm text-slate-500">
          <span className="font-medium text-slate-700">"{factory.name}"</span> will be permanently removed.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={onConfirm} disabled={busy} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
            {busy ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Factories() {
  const qc = useQueryClient()
  const toast = useToast()
  const [slideOpen, setSlideOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Factory | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Factory | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['factories'],
    queryFn: () => getFactories(),
  })

  const deleteMut = useMutation({
    mutationFn: deleteFactory,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['factories'] })
      toast.success('Factory deleted')
      setDeleteTarget(null)
    },
    onError: () => toast.error('Failed to delete factory'),
  })

  const factories = data?.items ?? []

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Factories</h1>
          {!isLoading && (
            <p className="mt-0.5 text-sm text-slate-400">{factories.length} supplier{factories.length !== 1 ? 's' : ''}</p>
          )}
        </div>
        <button
          onClick={() => { setEditTarget(null); setSlideOpen(true) }}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          <Plus size={16} />
          Add Factory
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {isLoading && (
          <div className="animate-pulse divide-y divide-slate-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="h-8 w-8 rounded-lg bg-slate-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-40 rounded bg-slate-200" />
                  <div className="h-3 w-24 rounded bg-slate-200" />
                </div>
                <div className="h-3 w-28 rounded bg-slate-200" />
                <div className="h-3 w-24 rounded bg-slate-200" />
                <div className="h-3 w-16 rounded bg-slate-200" />
                <div className="h-5 w-14 rounded-full bg-slate-200" />
              </div>
            ))}
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <AlertCircle size={24} className="text-red-400" />
            <p className="text-sm text-slate-600">Failed to load factories</p>
            <button onClick={() => void refetch()} className="text-sm font-medium text-indigo-600 hover:underline">Retry</button>
          </div>
        )}

        {!isLoading && !isError && factories.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <FactoryIcon size={22} className="text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-700">No factories yet</p>
            <p className="text-xs text-slate-400">Add your first manufacturing partner</p>
            <button
              onClick={() => { setEditTarget(null); setSlideOpen(true) }}
              className="mt-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Add Factory
            </button>
          </div>
        )}

        {!isLoading && !isError && factories.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Name', 'Contact person', 'Email', 'Phone', 'Lead time', 'Status', ''].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400 first:pl-5 last:pr-5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {factories.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
                          <FactoryIcon size={15} className="text-indigo-600" />
                        </div>
                        <span className="font-medium text-slate-800">{f.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{f.contact_person ?? <span className="text-slate-300">—</span>}</td>
                    <td className="px-5 py-3.5">
                      {f.email ? (
                        <a href={`mailto:${f.email}`} className="flex items-center gap-1 text-indigo-600 hover:underline">
                          <Mail size={12} />{f.email}
                        </a>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      {f.phone ? (
                        <span className="flex items-center gap-1 text-slate-600"><Phone size={12} />{f.phone}</span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {f.lead_time_days != null ? `${f.lead_time_days}d` : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${f.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {f.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setEditTarget(f); setSlideOpen(true) }} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Edit">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setDeleteTarget(f)} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <FactorySlideOver open={slideOpen} onClose={() => setSlideOpen(false)} editing={editTarget} />
      {deleteTarget && (
        <DeleteDialog
          factory={deleteTarget}
          busy={deleteMut.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteMut.mutate(deleteTarget.id)}
        />
      )}
    </div>
  )
}
