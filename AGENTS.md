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

```
src/
├── main.tsx     # entry point
├── App.tsx      # placeholder + chequeo de conexión con la API
├── App.css
└── index.css
```

## Reglas

**Ninguna llamada a la API sin mirar `API.md` primero.** Ruta, método y forma
exacta del JSON. Este repo ya tiene un bug de este tipo: `App.tsx` llama a
`/api/ping` y el backend expone `/api/health`, así que el indicador dice
"offline" aunque todo funcione. Es el error que más va a pasar en este proyecto.

**La URL del backend sale siempre de `import.meta.env.VITE_API_BASE_URL`**, con
`?? 'http://localhost:8080'` como fallback. Nunca hardcodeada en un componente.

**Los tipos de las respuestas se escriben a mano** siguiendo `API.md` (no hay
generación automática de tipos todavía). Definilos cerca de donde se usan hasta
que haya suficientes como para justificar un archivo aparte.

**Dependencias nuevas: proponelas, no las instales.** El scaffold es chico a
propósito. Todavía no hay router, ni librería de estado, ni de estilos, ni de
componentes — cada una de esas es una decisión a tomar cuando haga falta, no
antes.

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
Java 21 con el HttpServer del JDK, sin frameworks. Si necesitás un endpoint que
no existe, no lo simules con datos falsos: decímelo y lo agregamos del lado del
backend siguiendo `TIP - Backend/docs/guias/nuevo-endpoint.md`.
