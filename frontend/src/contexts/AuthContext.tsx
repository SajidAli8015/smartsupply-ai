import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import client from '../api/client'
import type { User } from '../types'

interface AuthContextValue {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<User>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('access_token'))
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('access_token')
    if (!stored) {
      setIsLoading(false)
      return
    }
    client
      .get<User>('/auth/me')
      .then(({ data }) => setUser(data))
      .catch(() => {
        localStorage.removeItem('access_token')
        setToken(null)
      })
      .finally(() => setIsLoading(false))
  }, [])

  async function login(email: string, password: string): Promise<User> {
    const { data: tokenData } = await client.post<{ access_token: string }>('/auth/login', {
      email,
      password,
    })
    localStorage.setItem('access_token', tokenData.access_token)
    setToken(tokenData.access_token)

    const { data: me } = await client.get<User>('/auth/me')
    setUser(me)
    return me
  }

  async function logout(): Promise<void> {
    try {
      await client.post('/auth/logout')
    } catch {
      // best-effort
    } finally {
      localStorage.removeItem('access_token')
      setToken(null)
      setUser(null)
      window.location.href = '/login'
    }
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
