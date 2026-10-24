import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerServiceWorker } from './utils/webPush'

// CAM-119: el service worker que muestra las push. Si no se puede (sin HTTPS ni localhost), la app anda igual.
registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
