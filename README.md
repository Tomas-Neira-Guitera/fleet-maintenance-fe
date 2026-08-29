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
├── App.tsx                    # orquesta el flujo: lista de vehículos ↔ inspección
├── main.tsx                   # entry point
├── App.css                    # estilos de todas las pantallas
├── styles/tokens.css          # tokens de diseño "Cuidado preventivo" (colores, radios, fuentes)
├── types/domain.ts            # tipos de dominio (Vehicle, Trip, Inspection, ChecklistItem, Defect...)
├── checklist/checklistDefinitions.ts  # ítems fijos del checklist pre-viaje/post-viaje + accesorios
├── mocks/vehicles.json        # datos mock de la flota
├── services/                  # capa de datos: vehiclesService, inspectionsService, mockStore
│   ├── vehiclesService.ts     # getVehicles/getVehicleById (mock o fetch según VITE_USE_MOCKS)
│   ├── inspectionsService.ts  # submitPreTrip/submitPostTrip/getOpenTripForVehicle
│   └── mockStore.ts           # store en memoria (mientras no hay backend)
└── components/
    ├── VehicleList.tsx        # pantalla 1: flota, patente + estado disponible/en viaje
    ├── InspectionFlow.tsx     # pantallas 2-6: checklist, resumen (anillo de salud) y éxito
    ├── ChecklistItemCard.tsx  # ítem OK/defecto con expansión inline (gravedad, foto, descripción)
    ├── HealthRing.tsx         # anillo circular de salud (pieza de marca)
    └── icons.tsx              # set de íconos SVG stroke-based
```

El checklist del pre-viaje/post-viaje (CAM-11) es un wizard mobile-first para el chofer, con
datos mock por ahora (`VITE_USE_MOCKS=true`) — la capa de servicios está armada para que
cambiar a la API real sea solo tocar `services/*Service.ts`, sin tocar componentes.
