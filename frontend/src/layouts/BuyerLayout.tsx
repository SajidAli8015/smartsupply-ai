import { NavLink, Outlet } from 'react-router-dom'
import { ShoppingBag, ClipboardList, LogOut, Menu, X, ShoppingCart } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useCart } from '../contexts/CartContext'
import CartSidebar from '../components/buyer/CartSidebar'

export default function BuyerLayout() {
  const { user, logout } = useAuth()
  const { itemCount, openCart } = useCart()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <nav className="sticky top-0 z-10 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <span className="text-base font-bold text-indigo-700">SmartSupply</span>

          {/* Desktop links */}
          <div className="hidden items-center gap-1 sm:flex">
            <NavLink
              to="/shop"
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                }`
              }
            >
              <ShoppingBag size={16} />
              Shop
            </NavLink>
            <NavLink
              to="/my-orders"
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                }`
              }
            >
              <ClipboardList size={16} />
              My Orders
            </NavLink>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-slate-500 sm:block">{user?.full_name}</span>

            {/* Cart button */}
            <button
              onClick={openCart}
              className="relative flex items-center rounded-lg p-2 text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Open cart"
            >
              <ShoppingCart size={20} />
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {itemCount > 9 ? '9+' : itemCount}
                </span>
              )}
            </button>

            <button
              onClick={() => logout()}
              className="hidden sm:flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              <LogOut size={16} />
              Sign out
            </button>

            <button
              className="text-slate-500 hover:text-slate-700 sm:hidden rounded-lg p-1.5"
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="border-t border-slate-100 px-4 pb-3 sm:hidden">
            <NavLink
              to="/shop"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <ShoppingBag size={16} />
              Shop
            </NavLink>
            <NavLink
              to="/my-orders"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <ClipboardList size={16} />
              My Orders
            </NavLink>
            <button
              onClick={() => logout()}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        )}
      </nav>

      <main className="flex-1">
        <Outlet />
      </main>

      {/* Cart sidebar — renders on all buyer pages */}
      <CartSidebar />
    </div>
  )
}
