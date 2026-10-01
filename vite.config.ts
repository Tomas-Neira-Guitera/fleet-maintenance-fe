import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `npm run dev:https` (modo "https"): HTTPS con certificado autofirmado, visible en la red local y con
// /api redirigido al backend. El navegador solo habilita el micrófono (CAM-32) en una página segura,
// así que hace falta para probar el dictado desde un celular.
export default defineConfig(async ({ mode }) => {
  if (mode !== 'https') return { plugins: [react()] }
  const { default: basicSsl } = await import('@vitejs/plugin-basic-ssl')
  return {
    plugins: [react(), basicSsl()],
    server: { host: true, proxy: { '/api': 'http://localhost:8080' } },
  }
})
