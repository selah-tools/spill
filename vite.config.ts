import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import { resolve } from 'node:path'

/** Dev server: `/c/:slug` has no static file — serve `index.html` for the SPA. */
function spaCardRoutes(): Plugin {
  const rewrite = (
    req: { url?: string; method?: string },
    _res: unknown,
    next: () => void,
  ): void => {
    if (req.method !== 'GET') return next()
    const url = req.url?.split('?')[0] ?? ''
    if (!url.startsWith('/c/')) return next()
    if (url.includes('.') && !url.endsWith('.html')) return next()
    const q = req.url?.includes('?') ? '?' + req.url.split('?')[1]! : ''
    req.url = '/index.html' + q
    next()
  }
  return {
    name: 'spa-card-routes',
    configureServer(server) {
      server.middlewares.use(rewrite)
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite)
    },
  }
}

export default defineConfig({
  root: resolve(__dirname, 'app'),
  plugins: [spaCardRoutes()],
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'app/index.html'),
        curator: resolve(__dirname, 'app/curator.html'),
      },
    },
  },
})
