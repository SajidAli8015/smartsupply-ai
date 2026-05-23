import client from './client'
import type { Product, Order, PagedResponse, ProductType } from '../types'

export interface ProductFilters {
  type?: ProductType
  search?: string
  page?: number
  page_size?: number
}

export interface PlaceOrderPayload {
  items: { sku_id: number; quantity: number }[]
  shipping_address: Record<string, string>
}

export const getProducts = (params?: ProductFilters) =>
  client.get<PagedResponse<Product>>('/products', { params }).then((r) => r.data)

export const getProduct = (id: number) =>
  client.get<Product>(`/products/${id}`).then((r) => r.data)

export const placeOrder = (data: PlaceOrderPayload) =>
  client.post<Order>('/orders', data).then((r) => r.data)

export const getMyOrders = (page = 1, pageSize = 100) =>
  client
    .get<PagedResponse<Order>>('/orders', { params: { page, page_size: pageSize } })
    .then((r) => r.data)

export const getMyOrder = (id: number) =>
  client.get<Order>(`/orders/${id}`).then((r) => r.data)

export const cancelOrder = (id: number) =>
  client.post<Order>(`/orders/${id}/cancel`).then((r) => r.data)
