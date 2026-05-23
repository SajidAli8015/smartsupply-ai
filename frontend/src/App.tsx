import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { CartProvider } from './contexts/CartContext'
import ProtectedRoute from './components/ProtectedRoute'
import SupplierLayout from './layouts/SupplierLayout'
import BuyerLayout from './layouts/BuyerLayout'

import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import Unauthorized from './pages/Unauthorized'

import Dashboard from './pages/supplier/Dashboard'
import Orders from './pages/supplier/Orders'
import Inventory from './pages/supplier/Inventory'
import Products from './pages/supplier/Products'
import Factories from './pages/supplier/Factories'
import PurchaseOrders from './pages/supplier/PurchaseOrders'
import Fulfillment from './pages/supplier/Fulfillment'

import Shop from './pages/buyer/Shop'
import ProductDetail from './pages/buyer/ProductDetail'
import Checkout from './pages/buyer/Checkout'
import OrderConfirmation from './pages/buyer/OrderConfirmation'
import MyOrders from './pages/buyer/MyOrders'

// CartProvider wraps only buyer routes so it has access to cart state
// BuyerLayout reads useCart() and renders CartSidebar
function BuyerShell() {
  return (
    <CartProvider>
      <BuyerLayout />
    </CartProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Supplier / Staff */}
          <Route element={<ProtectedRoute allowedRoles={['supplier', 'staff']} />}>
            <Route element={<SupplierLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/products" element={<Products />} />
              <Route path="/factories" element={<Factories />} />
              <Route path="/purchase-orders" element={<PurchaseOrders />} />
              <Route path="/fulfillment" element={<Fulfillment />} />
            </Route>
          </Route>

          {/* Buyer */}
          <Route element={<ProtectedRoute allowedRoles={['buyer']} />}>
            <Route element={<BuyerShell />}>
              <Route path="/shop" element={<Shop />} />
              <Route path="/shop/:id" element={<ProductDetail />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/order-confirmation/:id" element={<OrderConfirmation />} />
              <Route path="/my-orders" element={<MyOrders />} />
            </Route>
          </Route>

          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  )
}
