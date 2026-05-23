import client from './client'
import type { PurchaseOrder, POStatus, PagedResponse } from '../types'

export interface POFilters {
  status?: POStatus
  page?: number
  page_size?: number
}

export interface POLineItemPayload {
  sku_id: number
  quantity_ordered: number
  unit_cost: number
}

export interface POCreatePayload {
  factory_id: number
  expected_delivery_date?: string
  notes?: string
  line_items: POLineItemPayload[]
}

export interface POReceiveItemPayload {
  sku_id: number
  quantity_received: number
}

export const getPurchaseOrders = (params?: POFilters) =>
  client
    .get<PagedResponse<PurchaseOrder>>('/purchase-orders', { params })
    .then((r) => r.data)

export const getPurchaseOrder = (id: number) =>
  client.get<PurchaseOrder>(`/purchase-orders/${id}`).then((r) => r.data)

export const createPurchaseOrder = (data: POCreatePayload) =>
  client.post<PurchaseOrder>('/purchase-orders', data).then((r) => r.data)

export const updatePOStatus = (id: number, status: POStatus) =>
  client.put<PurchaseOrder>(`/purchase-orders/${id}/status`, { status }).then((r) => r.data)

export const receivePO = (id: number, items: POReceiveItemPayload[]) =>
  client.post<PurchaseOrder>(`/purchase-orders/${id}/receive`, { items }).then((r) => r.data)
