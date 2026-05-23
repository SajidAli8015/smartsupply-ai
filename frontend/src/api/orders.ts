import client from './client'
import type { Order, OrderStatus, PagedResponse, FulfillmentOrder } from '../types'

export interface OrderFilters {
  status?: OrderStatus
  page?: number
  page_size?: number
}

export interface OrderStatusPayload {
  status: OrderStatus
  tracking_number?: string
  carrier?: string
}

export const getOrders = (params?: OrderFilters) =>
  client.get<PagedResponse<Order>>('/orders', { params }).then((r) => r.data)

export const getOrder = (id: number) =>
  client.get<Order>(`/orders/${id}`).then((r) => r.data)

export const updateOrderStatus = (id: number, data: OrderStatusPayload) =>
  client.put<Order>(`/orders/${id}/status`, data).then((r) => r.data)

export const getFulfillmentQueue = () =>
  client.get<FulfillmentOrder[]>('/fulfillment/queue').then((r) => r.data)
