import client from './client'
import type { Product, SKU, InventoryItem, PagedResponse, ProductType } from '../types'

// ── Products ──────────────────────────────────────────────────────────────────

export interface ProductFilters {
  type?: ProductType
  search?: string
  page?: number
  page_size?: number
}

export interface SKUCreatePayload {
  sku_code: string
  color: string
  size: string
  sale_price: number
  cost_price: number
}

export interface ProductCreatePayload {
  name: string
  type: ProductType
  description?: string
  base_price: number
  cost_price: number
  images?: string[]
  skus: SKUCreatePayload[]
}

export interface ProductUpdatePayload {
  name?: string
  type?: ProductType
  description?: string
  base_price?: number
  cost_price?: number
  images?: string[]
}

export const getProducts = (params?: ProductFilters) =>
  client.get<PagedResponse<Product>>('/products', { params }).then((r) => r.data)

export const getProduct = (id: number) =>
  client.get<Product>(`/products/${id}`).then((r) => r.data)

export const createProduct = (data: ProductCreatePayload) =>
  client.post<Product>('/products', data).then((r) => r.data)

export const updateProduct = (id: number, data: ProductUpdatePayload) =>
  client.put<Product>(`/products/${id}`, data).then((r) => r.data)

export const deleteProduct = (id: number) => client.delete(`/products/${id}`)

export const addSKU = (productId: number, data: SKUCreatePayload) =>
  client.post<SKU>(`/products/${productId}/skus`, data).then((r) => r.data)

// ── Inventory ─────────────────────────────────────────────────────────────────

export type AdjustReason = 'damage' | 'recount' | 'return' | 'other'

export interface InventoryAdjustPayload {
  quantity: number
  reason: AdjustReason
  notes?: string
}

export const getInventory = (page = 1, pageSize = 50) =>
  client
    .get<PagedResponse<InventoryItem>>('/inventory', { params: { page, page_size: pageSize } })
    .then((r) => r.data)

export const getLowStock = () =>
  client.get<InventoryItem[]>('/inventory/low-stock').then((r) => r.data)

export const adjustInventory = (skuId: number, data: InventoryAdjustPayload) =>
  client.post<InventoryItem>(`/inventory/${skuId}/adjust`, data).then((r) => r.data)
