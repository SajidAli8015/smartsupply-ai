import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'

const client = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

let isRefreshing = false
let refreshQueue: Array<(token: string | null, err?: unknown) => void> = []

function processQueue(token: string | null, err?: unknown) {
  refreshQueue.forEach((cb) => cb(token, err))
  refreshQueue = []
}

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

client.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config as typeof err.config & { _retry?: boolean }

    if (err.response?.status !== 401 || original._retry) {
      return Promise.reject(err)
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push((token, queueErr) => {
          if (queueErr) return reject(queueErr)
          original.headers.Authorization = `Bearer ${token}`
          resolve(client(original))
        })
      })
    }

    original._retry = true
    isRefreshing = true

    try {
      const { data } = await axios.post(
        `${baseURL}/auth/refresh`,
        {},
        { withCredentials: true },
      )
      const newToken: string = data.access_token
      localStorage.setItem('access_token', newToken)
      client.defaults.headers.common.Authorization = `Bearer ${newToken}`
      processQueue(newToken)
      original.headers.Authorization = `Bearer ${newToken}`
      return client(original)
    } catch (refreshErr) {
      processQueue(null, refreshErr)
      localStorage.removeItem('access_token')
      window.location.href = '/login'
      return Promise.reject(refreshErr)
    } finally {
      isRefreshing = false
    }
  },
)

export default client
