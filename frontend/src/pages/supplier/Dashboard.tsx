import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { DollarSign, ShoppingCart, Boxes, TrendingUp, RefreshCw, Sparkles } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { getKPIs, getRecentOrders, type KPIPeriod } from '../../api/analytics'
import KPICard, { KPICardSkeleton } from '../../components/dashboard/KPICard'
import SalesChart from '../../components/dashboard/SalesChart'
import TopProductsTable from '../../components/dashboard/TopProductsTable'
import LowStockAlert from '../../components/dashboard/LowStockAlert'
import POPipeline from '../../components/dashboard/POPipeline'
import { greeting, formatPKR, timeAgo, ORDER_STATUS_STYLES } from '../../lib/format'

const PERIOD_OPTS: { label: string; value: KPIPeriod }[] = [
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
]

const TODAY = new Date().toLocaleDateString('en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

const AI_CHIPS = [
  'Which products should I reorder?',
  'What was my revenue this month?',
  'Which orders are unshipped?',
]

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [period, setPeriod] = useState<KPIPeriod>('month')

  const {
    data: kpis,
    isLoading: kpisLoading,
    isError: kpisError,
    refetch: refetchKPIs,
  } = useQuery({
    queryKey: ['kpis', period],
    queryFn: () => getKPIs(period),
  })

  const {
    data: ordersPage,
    isLoading: ordersLoading,
    isError: ordersError,
    refetch: refetchOrders,
  } = useQuery({
    queryKey: ['recent-orders'],
    queryFn: () => getRecentOrders(10),
  })

  const recentOrders = ordersPage?.items ?? []

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            {user ? greeting(user.full_name) : 'Dashboard'}
          </h1>
          <p className="mt-0.5 text-sm text-slate-400">{TODAY}</p>
        </div>

        {/* Period selector */}
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
          {PERIOD_OPTS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setPeriod(value)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                period === value
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      {kpisError ? (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <p className="text-sm text-red-600">Failed to load KPIs</p>
          <button
            onClick={() => void refetchKPIs()}
            className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-red-600 shadow-sm hover:bg-red-50"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpisLoading ? (
            Array.from({ length: 4 }).map((_, i) => <KPICardSkeleton key={i} />)
          ) : kpis ? (
            <>
              <KPICard
                title="Total Revenue"
                value={formatPKR(kpis.total_revenue)}
                subtitle={`Period: ${kpis.period}`}
                icon={DollarSign}
                trend="neutral"
              />
              <KPICard
                title="Total Orders"
                value={kpis.total_orders.toLocaleString()}
                subtitle={`${kpis.orders_pending} pending`}
                icon={ShoppingCart}
                trend="neutral"
              />
              <KPICard
                title="Inventory Value"
                value={formatPKR(kpis.inventory_value)}
                subtitle={`${kpis.active_pos} active POs`}
                icon={Boxes}
                trend="neutral"
              />
              <KPICard
                title="Gross Margin"
                value={`${kpis.gross_margin_pct.toFixed(1)}%`}
                icon={TrendingUp}
                trend={
                  kpis.gross_margin_pct >= 30
                    ? 'positive'
                    : kpis.gross_margin_pct >= 15
                    ? 'neutral'
                    : 'negative'
                }
              />
            </>
          ) : null}
        </div>
      )}

      {/* ── Sales Chart + Top Products ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <SalesChart />
        </div>
        <div className="lg:col-span-2">
          <TopProductsTable />
        </div>
      </div>

      {/* ── Low Stock + PO Pipeline ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <LowStockAlert />
        <POPipeline />
      </div>

      {/* ── AI Assistant Widget ────────────────────────────────────────────── */}
      <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-purple-50 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-500" />
              <h2 className="text-sm font-semibold text-slate-800">Ask AI Assistant</h2>
            </div>
            <p className="text-xs text-slate-500">
              Get instant answers from your live business data — inventory, orders, revenue and more.
            </p>
          </div>
          <button
            onClick={() => navigate('/ai-assistant')}
            className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            Open AI Assistant
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {AI_CHIPS.map((q) => (
            <button
              key={q}
              onClick={() => navigate('/ai-assistant')}
              className="rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-xs text-indigo-600 shadow-sm transition-colors hover:bg-indigo-100"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* ── Recent Orders ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-700">Recent Orders</h2>
        </div>

        {ordersLoading && (
          <div className="animate-pulse divide-y divide-slate-50">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="h-3 w-16 rounded bg-slate-200" />
                <div className="h-3 flex-1 rounded bg-slate-200" />
                <div className="h-3 w-12 rounded bg-slate-200" />
                <div className="h-3 w-20 rounded bg-slate-200" />
                <div className="h-5 w-16 rounded-full bg-slate-200" />
                <div className="h-3 w-14 rounded bg-slate-200" />
              </div>
            ))}
          </div>
        )}

        {ordersError && (
          <div className="flex items-center justify-between px-5 py-4">
            <p className="text-sm text-red-500">Failed to load orders</p>
            <button
              onClick={() => void refetchOrders()}
              className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:underline"
            >
              <RefreshCw size={13} />
              Retry
            </button>
          </div>
        )}

        {!ordersLoading && !ordersError && recentOrders.length === 0 && (
          <div className="flex items-center justify-center p-10">
            <p className="text-sm text-slate-400">No orders yet</p>
          </div>
        )}

        {!ordersLoading && !ordersError && recentOrders.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                    Order #
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                    Buyer
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-400">
                    Items
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-400">
                    Amount
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wide text-slate-400">
                    Status
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-400">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-mono text-xs font-semibold text-slate-600">
                      #{String(order.id).padStart(5, '0')}
                    </td>
                    <td className="px-3 py-3 text-slate-700">{order.buyer.full_name}</td>
                    <td className="px-3 py-3 text-right text-slate-500">
                      {order.items.reduce((s, it) => s + it.quantity, 0)}
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-slate-700">
                      {formatPKR(order.total_amount)}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                          ORDER_STATUS_STYLES[order.status] ?? 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-slate-400">
                      {timeAgo(order.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
