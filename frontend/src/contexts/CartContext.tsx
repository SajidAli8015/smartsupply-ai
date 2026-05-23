import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react'
import type { Product, SKU } from '../types'

export interface CartItem {
  skuId: number
  skuCode: string
  productName: string
  color: string
  size: string
  price: number
  quantity: number
}

interface CartContextValue {
  items: CartItem[]
  addItem: (sku: SKU, product: Product, quantity: number) => void
  removeItem: (skuId: number) => void
  updateQuantity: (skuId: number, quantity: number) => void
  clearCart: () => void
  itemCount: number
  total: number
  isCartOpen: boolean
  openCart: () => void
  closeCart: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

const STORAGE_KEY = 'smartsupply_cart'

function load(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as CartItem[]) : []
  } catch {
    return []
  }
}

function save(items: CartItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(load)
  const [isCartOpen, setIsCartOpen] = useState(false)

  useEffect(() => {
    save(items)
  }, [items])

  const addItem = useCallback((sku: SKU, product: Product, quantity: number) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.skuId === sku.id)
      if (existing) {
        return prev.map((i) =>
          i.skuId === sku.id ? { ...i, quantity: i.quantity + quantity } : i,
        )
      }
      return [
        ...prev,
        {
          skuId: sku.id,
          skuCode: sku.sku_code,
          productName: product.name,
          color: sku.color,
          size: sku.size,
          price: parseFloat(sku.sale_price),
          quantity,
        },
      ]
    })
    setIsCartOpen(true)
  }, [])

  const removeItem = useCallback((skuId: number) => {
    setItems((prev) => prev.filter((i) => i.skuId !== skuId))
  }, [])

  const updateQuantity = useCallback((skuId: number, quantity: number) => {
    if (quantity < 1) return
    setItems((prev) => prev.map((i) => (i.skuId === skuId ? { ...i, quantity } : i)))
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
  }, [])

  const openCart = useCallback(() => setIsCartOpen(true), [])
  const closeCart = useCallback(() => setIsCartOpen(false), [])

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        itemCount,
        total,
        isCartOpen,
        openCart,
        closeCart,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
