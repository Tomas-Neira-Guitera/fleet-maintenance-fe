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

Necesitás el backend `fleet-maintenance` corriendo en esa URL para que la app funcione
(listado de vehículos, subida de fotos y envío de inspecciones).

## Scripts

- `npm run dev` — servidor de desarrollo con HMR
- `npm run build` — build de producción (`tsc -b && vite build`)
- `npm run preview` — sirve el build de producción localmente
- `npm run lint` — corre Oxlint

## Estructura

```
src/
├── App.tsx                    # orquesta el flujo: lista de vehículos ↔ inspección
├── main.tsx                   # entry point
├── App.css                    # estilos de todas las pantallas
├── styles/tokens.css          # tokens de diseño "Cuidado preventivo" (colores, radios, fuentes)
├── types/domain.ts            # tipos de dominio (Vehicle, Trip, Inspection, ChecklistItem, Defect...)
├── checklist/checklistDefinitions.ts  # ítems fijos del checklist pre-viaje/post-viaje
├── services/                  # capa de datos: llamadas fetch() a la API real
│   ├── apiClient.ts           # URL base, identidad de chofer (stub) y manejo de errores
│   ├── vehiclesService.ts     # getVehicles()
│   ├── inspectionsService.ts  # submitInspection(vehicleId, type, answers, notes)
│   └── photosService.ts       # uploadDefectPhoto(file)
└── components/
    ├── VehicleList.tsx        # pantalla 1: flota, patente + estado disponible/en viaje
    ├── InspectionFlow.tsx     # pantallas 2-6: checklist, resumen (anillo de salud) y éxito
    ├── ChecklistItemCard.tsx  # ítem OK/defecto con expansión inline (gravedad, foto, descripción)
    ├── HealthRing.tsx         # anillo circular de salud (pieza de marca)
    └── icons.tsx              # set de íconos SVG stroke-based
```

El checklist del pre-viaje/post-viaje (CAM-11) es un wizard mobile-first para el chofer. El
frontend consume la API real del backend `fleet-maintenance` (Spring Boot) — no usa datos mock.
Para levantar el flujo completo necesitás el backend corriendo en `http://localhost:8080`
(CORS ya está habilitado ahí para `http://localhost:5173`/`http://127.0.0.1:5173`).

No hay login real todavía: las inspecciones se envían con una identidad de chofer fija
(`driver-demo-1` / "Carlos Gómez", ver `src/services/apiClient.ts`) hasta que exista autenticación.
