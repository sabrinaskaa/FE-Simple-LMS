import axios from 'axios'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

const api = axios.create({ baseURL: API_BASE_URL })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config || {}
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refresh = localStorage.getItem('refresh_token')
      if (!refresh || original.url?.includes('/auth/login') || original.url?.includes('/auth/refresh')) {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        return Promise.reject(error)
      }
      try {
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refresh })
        localStorage.setItem('access_token', data.access)
        original.headers = original.headers || {}
        original.headers.Authorization = `Bearer ${data.access}`
        return api(original)
      } catch (refreshError) {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        return Promise.reject(refreshError)
      }
    }
    return Promise.reject(error)
  }
)

export function getErrorMessage(error, fallback = 'Terjadi kesalahan. Silakan coba lagi.') {
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((item) => item.msg || item.message || JSON.stringify(item)).join(', ')
  if (detail && typeof detail === 'object') return detail.msg || detail.message || JSON.stringify(detail)
  return error?.message || fallback
}

export default api
