import client from './client'
import type {
  KPIResponse,
  SalesDataPoint,
  TopProductItem,
  POPipelineItem,
  InventoryItem,
  PagedResponse,
  Order,
} from '../types'

export type KPIPeriod = 'today' | 'week' | 'month' | 'all'
export type SalesPeriod = 'week' | 'month' | 'quarter'
export type Granularity = 'day' | 'week'

export const getKPIs = (period: KPIPeriod) =>
  client.get<KPIResponse>('/analytics/kpis', { params: { period } }).then((r) => r.data)

export const getSalesOverTime = (period: SalesPeriod, granularity: Granularity) =>
  client
    .get<SalesDataPoint[]>('/analytics/sales-over-time', { params: { period, granularity } })
    .then((r) => r.data)

export const getTopProducts = (limit = 10) =>
  client
    .get<TopProductItem[]>('/analytics/top-products', { params: { limit } })
    .then((r) => r.data)

export const getLowStock = () =>
  client.get<InventoryItem[]>('/inventory/low-stock').then((r) => r.data)

export const getPOPipeline = () =>
  client.get<POPipelineItem[]>('/analytics/po-pipeline').then((r) => r.data)

export const getRecentOrders = (limit = 10) =>
  client
    .get<PagedResponse<Order>>('/orders', { params: { page_size: limit } })
    .then((r) => r.data)
