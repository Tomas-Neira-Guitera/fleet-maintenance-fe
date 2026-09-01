# AGENTS.md — fleet-maintenance-fe (frontend)

Frontend de **FleetGuard**. El contexto del sistema, el contrato de API y el
estado de avance viven en el repo del backend, carpeta hermana `TIP - Backend`:

- `TIP - Backend/docs/PROJECT.md` — qué es FleetGuard y por qué está así
- `TIP - Backend/docs/API.md` — **qué endpoints existen y qué devuelven**
- `TIP - Backend/docs/STATE.md` — en qué quedó el trabajo

Están ahí y no duplicados acá a propósito: dos copias del contrato de API se
desincronizan, y una copia desactualizada es peor que no tenerla.

## Stack

| Qué | Con qué |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 8 |
| Linter | Oxlint (`.oxlintrc.json`) |
| Node | 20+ |

## Estructura hoy

Desde la migración a Spring Boot del backend y CAM-11 (2026-08-31):

```
src/
├── App.tsx                            # orquesta el flujo: lista de vehículos ↔ inspección
├── main.tsx                           # entry point
├── App.css                            # estilos de todas las pantallas
├── index.css                          # solo importa styles/tokens.css
├── styles/tokens.css                  # tokens de diseño "Cuidado preventivo" (colores, radios, fuentes)
├── types/domain.ts                    # tipos de dominio (Vehicle, Trip, Inspection, ChecklistItem, Defect...)
├── checklist/checklistDefinitions.ts  # ítems fijos del checklist pre-viaje/post-viaje
├── services/                          # capa de datos: llamadas fetch() a la API real
│   ├── apiClient.ts                   # URL base, identidad de chofer (stub) y manejo de errores
│   ├── vehiclesService.ts
│   ├── inspectionsService.ts
│   └── photosService.ts
└── components/
    ├── VehicleList.tsx
    ├── InspectionFlow.tsx
    ├── ChecklistItemCard.tsx
    ├── HealthRing.tsx
    └── icons.tsx
```

No hay pantalla de listado de defectos todavía — la vieja (`DefectosList.tsx`)
se descartó en el merge del 2026-08-31 porque apuntaba al contrato viejo
(`GET /api/defectos` en español). Hay que rehacerla contra `GET /api/defects`
(ver `TIP - Backend/docs/API.md`) cuando se retome esa historia.

## Reglas

**Ninguna llamada a la API sin mirar `API.md` (o `docs/api/openapi.yaml` para
CAM-11) primero.** Ruta, método y forma exacta del JSON. Un campo desalineado
es el error que más va a pasar en este proyecto.

**La URL del backend sale siempre de `import.meta.env.VITE_API_BASE_URL`**, con
`?? 'http://localhost:8080'` como fallback (ver `services/apiClient.ts`).
Nunca hardcodeada en un componente.

**Los tipos de las respuestas se escriben a mano** en `types/domain.ts`,
siguiendo el contrato (no hay generación automática de tipos todavía).

**Dependencias nuevas: proponelas, no las instales.** Todavía no hay router,
ni librería de estado, ni de componentes — cada una de esas es una decisión a
tomar cuando haga falta, no antes. Sí hay ya una capa de diseño propia
(`styles/tokens.css`, paleta "Cuidado preventivo") — no traer una librería de
estilos/componentes que la reemplace sin proponerlo antes.

**Todo cambio pasa por `npm run lint` y `npm run build`** antes de darse por
terminado. El build corre `tsc -b`, así que un error de tipos lo frena.

## Comandos

```bash
npm install
npm run dev      # http://localhost:5173
npm run lint     # oxlint
npm run build    # tsc -b && vite build
```

## El otro repo

El backend es `fleet-maintenance`, en la carpeta hermana `TIP - Backend`.
Java 21 + Spring Boot (Spring MVC + Spring Data JPA) desde el 2026-08-31 — ver
`TIP - Backend/AGENTS.md` y `TIP - Backend/docs/PROJECT.md` para el porqué del
cambio de stack. Si necesitás un endpoint que no existe, no lo simules con
datos falsos: decímelo y lo agregamos del lado del backend siguiendo
`TIP - Backend/docs/guias/nuevo-endpoint.md`.
