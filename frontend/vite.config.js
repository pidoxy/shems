import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// SPA history-API fallback: serve index.html for every non-asset route so
// React Router can handle deep-links and hard-reloads on any page.
const spaFallback = {
  name: 'spa-fallback',
  configureServer(server) {
    // Returning a function places this AFTER Vite's own middleware,
    // so it only fires when no real file was matched.
    return () => {
      server.middlewares.use((req, _res, next) => {
        const url = req.url ?? ''
        const isAsset =
          url.includes('.')          || // JS, CSS, images, etc.
          url.startsWith('/@')       || // Vite internal (/@vite/client …)
          url.startsWith('/__')      || // Vite HMR / ping
          url.startsWith('/api/')       // backend proxy routes
        if (!isAsset) req.url = '/index.html'
        next()
      })
    }
  },
}

export default defineConfig({
  plugins: [react(), spaFallback],
  server: {
    host: true,
    port: 5173,
  },
})
