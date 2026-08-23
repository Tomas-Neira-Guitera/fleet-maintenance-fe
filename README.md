# fleet-maintenance-fe

Frontend del proyecto **FleetGuard** — mantenimiento preventivo e inspecciones de flota.

## Stack

- React 19 + TypeScript
- Vite
- Oxlint (linting)

## Requisitos previos

- Node 20+

## Levantar el proyecto

```bash
npm install
npm run dev
```

La app queda disponible en `http://localhost:5173`.

## Configuración

Copiar `.env.example` a `.env` y ajustar la URL del backend si hace falta:

```bash
cp .env.example .env
```

```
VITE_API_BASE_URL=http://localhost:8080
```

## Scripts

- `npm run dev` — servidor de desarrollo con HMR
- `npm run build` — build de producción (`tsc -b && vite build`)
- `npm run preview` — sirve el build de producción localmente
- `npm run lint` — corre Oxlint

## Estructura

```
src/
├── App.tsx      # componente raíz (placeholder + chequeo de conexión con la API)
├── main.tsx     # entry point
└── assets/
```

A partir de acá se van a ir agregando las pantallas del dominio (inspecciones, defectos,
órdenes de trabajo, flota, mantenimiento preventivo, login/roles).
