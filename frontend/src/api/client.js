import axios from 'axios'

const client = axios.create({
  // Defaults to the local dev backend; override with VITE_API_URL (e.g. to point
  // at a throwaway demo backend) without editing this file.
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  // Without a timeout a stalled request never settles, so a screen waiting on it
  // shows its loader forever with no way out. 45s is deliberately generous: the
  // API sleeps when idle on its host's free tier, and the first request after
  // that has to wait for a full cold boot. Better a slow success than a
  // premature failure — but bounded, so a truly dead request surfaces as one.
  timeout: 45000,
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('issei_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// On any 401 (expired token, or token for a user that no longer exists), clear
// the stale session and send the user to login. This keeps session expiry from
// surfacing as a confusing error inside an unrelated feature.
client.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest = error.config?.url?.includes('/auth/login')
    if (error.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem('issei_token')
      localStorage.removeItem('issei_user')
      if (window.location.pathname !== '/login') {
        window.location.assign('/login')
      }
    }
    return Promise.reject(error)
  },
)

export default client
