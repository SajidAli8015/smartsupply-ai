export type UserRole = 'supplier' | 'buyer' | 'staff'

export interface User {
  id: number
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface PagedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface ApiError {
  detail: string
}

// ── Products ─────────────────────────────────────────────────────────────────

export type ProductType = 'shirt' | 'jeans'

export interface InventoryBrief {
  quantity_on_hand: number
  quantity_reserved: number
  available: number
  low_stock_threshold: number
  warehouse_location: string | null
}

export interface SKU {
  id: number
  product_id: number
  sku_code: string
  color: string
  size: string
  cost_price: string
  sale_price: string
  inventory: InventoryBrief | null
}

export interface Product {
  id: number
  name: string
  type: ProductType
  description: string | null
  base_price: string
  cost_price: string
  images: string[] | null
  skus: SKU[]
}

// ── Inventory ─────────────────────────────────────────────────────────────────

export interface InventoryItem {
  id: number
  sku_id: number
  sku_code: string
  color: string
  size: string
  quantity_on_hand: number
  quantity_reserved: number
  available: number
  low_stock_threshold: number
  warehouse_location: string | null
}

export interface InventoryAdjust {
  delta: number
  reason?: string
}

// ── Factories ─────────────────────────────────────────────────────────────────

export interface Factory {
  id: number
  name: string
  contact_person: string | null
  email: string | null
  phone: string | null
  address: string | null
  lead_time_days: number | null
  is_active: boolean
}

// ── Purchase Orders ───────────────────────────────────────────────────────────

export type POStatus =
  | 'draft'
  | 'placed'
  | 'confirmed'
  | 'in_production'
  | 'shipped'
  | 'received'
  | 'cancelled'

export interface POLineItem {
  id: number
  sku_id: number
  sku_code: string
  quantity_ordered: number
  quantity_received: number
  unit_cost: string
}

export interface PurchaseOrder {
  id: number
  factory_id: number
  factory: { id: number; name: string; contact_person: string | null }
  created_by: number
  status: POStatus
  expected_delivery_date: string | null
  notes: string | null
  created_at: string
  line_items: POLineItem[]
}

export interface POPipelineItem {
  status: string
  count: number
  total_value: string
}

// ── Orders ────────────────────────────────────────────────────────────────────

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'cancelled'

export interface OrderSKUBrief {
  id: number
  sku_code: string
  color: string
  size: string
}

export interface OrderBuyer {
  id: number
  email: string
  full_name: string
}

export interface OrderItem {
  id: number
  sku_id: number
  sku: OrderSKUBrief
  quantity: number
  unit_price: string
}

export interface ShipmentBrief {
  id: number
  tracking_number: string | null
  carrier: string | null
  status: string | null
  shipped_at: string | null
  delivered_at: string | null
}

export interface Order {
  id: number
  buyer_id: number
  buyer: OrderBuyer
  status: OrderStatus
  total_amount: string
  shipping_address: Record<string, unknown> | null
  created_at: string
  items: OrderItem[]
  shipments: ShipmentBrief[]
}

export interface FulfillmentOrder {
  id: number
  buyer_id: number
  buyer: OrderBuyer | null
  status: OrderStatus
  total_amount: string
  shipping_address: Record<string, unknown> | null
  created_at: string
  items: OrderItem[]
  is_priority: boolean
}

// ── Notifications ─────────────────────────────────────────────────────────────

export interface Notification {
  id: number
  user_id: number
  title: string
  message: string
  type: string | null
  is_read: boolean
  created_at: string
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export interface KPIResponse {
  period: string
  total_revenue: string
  total_orders: number
  orders_pending: number
  inventory_value: string
  gross_margin_pct: number
  active_pos: number
}

export interface SalesDataPoint {
  date: string
  revenue: string
  order_count: number
}

export interface TopProductItem {
  product_id: number
  name: string
  units_sold: number
  revenue: string
  gross_margin: number
}
