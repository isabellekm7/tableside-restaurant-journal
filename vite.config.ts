import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// The service worker is for real browsers only; keep it out of the test run.
const pwa = process.env.VITEST
  ? []
  : [
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: 'Tableside',
          short_name: 'Tableside',
          description: 'Find restaurants that will work for your kids, right now. Prototype with sample data.',
          lang: 'en',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          background_color: '#f5faf9',
          theme_color: '#0f766e',
          icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
        },
        workbox: {
          // Precache the app itself (not every font subset: only latin is ever used here).
          globPatterns: ['**/*.{js,css,html,svg}', '**/*latin*.woff2'],
          // Offline deep links like /saved or /restaurant/abc open the app shell.
          navigateFallback: '/index.html',
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            // Never cache account or data traffic: it must be live or fail so the app can fall back.
            { urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co'), handler: 'NetworkOnly' },
          ],
        },
        devOptions: { enabled: false },
      }),
    ]

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), ...pwa],
  test: {
    environment: 'jsdom',
    // Tests are hermetic: never talk to a real backend, whatever is in .env.local.
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '' },
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    // Vitest blanks CSS by default, including `?raw` imports. These files are read as text
    // by the styleguide and by the contrast / reduced-motion / focus tests, so let them through.
    css: { include: [/(tokens|base)\.css/] },
  },
})
