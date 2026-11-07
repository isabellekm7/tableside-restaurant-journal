import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    // Vitest blanks CSS by default, including `?raw` imports. tokens.css is read
    // as text by the styleguide and contrast tests, so let it through.
    css: { include: [/tokens\.css/] },
  },
})
