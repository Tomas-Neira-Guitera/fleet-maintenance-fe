import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// CAM-136: tests de componentes con Testing Library sobre jsdom (sin navegador real).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
