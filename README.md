# BioRed API 🌿

Backend del sistema **BioRed · Bio-Nodos Barriales de Managua** (Desafío 04): motor logístico de
acopio de poda, motor físico de conversión **UCT-3**, trueque verde con vouchers **QR "Rama por
Planta"**, feed comunitario y telemetría municipal.

Un solo código TS/Deno corre **en dos lugares**:

| Runtime                     | Comando                         | URL                                                 |
| --------------------------- | ------------------------------- | --------------------------------------------------- |
| Servidor local (desarrollo) | `npm run dev`                   | `http://<IP-LAN>:3000/api/v1`                       |
| **Supabase Edge Function**  | `supabase functions deploy api` | `https://<ref>.supabase.co/functions/v1/api/api/v1` |

---

## Características

- 🚚 **Enrutamiento inverso Haversine** con _load balancing_: elige el Bio-Nodo que menos castiga la
  red y calcula el diésel ahorrado frente a llevar la rama al vertedero La Chureca.
- ⚙️ **Motor físico UCT-3** (cilindro Trommel tricapa): a partir de `toneladas` y `humedad` calcula
  mulch térmico, compost fino, fibra para Bio-Macetas, desgaste de cuchillas 5160 y valor comercial
  del lote.
- 🎫 **Vouchers QR "Rama por Planta"**: el vecino registra poda → se emite un vale firmado; el
  operario lo escanea → se acreditan Eco-Puntos y sube la tolva del nodo.
- 🛒 **Trueque verde**: canje de Eco-Puntos por abono, mulch, Bio-Macetas y madero negro.
- 📣 **Feed comunitario** y **Retos Barriales**.
- 📊 **Telemetría municipal**: toneladas desviadas, camiones ahorrados, ROI/CAPEX, reducción de
  temperatura del suelo y ahorro de agua.
- 🧪 **Doble repositorio**: `PostgresRepo` (producción, Supabase) y `MemoryRepo` (demo sin
  credenciales).

---

## Arquitectura

```
┌────────────────────┐   HTTP/JSON    ┌──────────────────────────────┐
│  App Expo (RallyApp)│ ─────────────▶ │  BioRed API                  │
│  src/services/*.ts  │                │  ┌────────────────────────┐  │
└────────────────────┘                │  │ routes → controllers    │  │
                                      │  │ services (UCT-3, routing)│ │
                                      │  │ repo (port)             │  │
                                      │  └───────┬────────┬────────┘  │
                                      │          │        │           │
                                      │   MemoryRepo   PostgresRepo   │
                                      │  (seed en RAM)    │ (supabase-js)
                                      └───────────────────┼───────────┘
                                                          │ PostgREST + RPC
                                                    ┌─────▼─────┐
                                                    │ Supabase  │
                                                    │ Postgres  │
                                                    └───────────┘
```

- **Sin Prisma/SQLite**: la persistencia es Postgres de Supabase. Las operaciones que tocan varias
  tablas son **funciones RPC atómicas** (`biored_verify_ticket`, `biored_redeem_item`,
  `biored_apply_batch`) para no dejar estados intermedios.
- **Backend único**: todo el dominio vive en `supabase/functions/_shared/`. El bundler de Supabase
  Edge sólo garantiza imports dentro de `supabase/functions/`, por eso `src/` contiene únicamente el
  servidor local y el cliente de la app.
- **Modo automático**: si no hay credenciales de Supabase, arranca con los datos semilla en memoria
  (demo instantánea). Si hay credenciales, usa Postgres.

---

## Inicio rápido (modo demo, sin credenciales)

```bash
npm install
npm run dev
# → http://localhost:3000/api/v1/health  { "mode": "memory", ... }
```

No requiere Supabase: el servidor levanta con los datos semilla de Managua en RAM y todos los
endpoints funcionan. Ideal para el pitch o para desarrollar la app.

Prueba rápida:

```bash
curl http://localhost:3000/api/v1/nodes
curl -X POST http://localhost:3000/api/v1/nodes/recommend \
  -H 'content-type: application/json' \
  -d '{"latitude":12.136,"longitude":-86.271,"volumeM3":0.8}'
```

---

## Desplegar en Supabase

### 1. Login y enlace del proyecto

```bash
npx supabase login
npx supabase link --project-ref <TU_PROJECT_REF>
```

### 2. Crear el esquema y los datos semilla

```bash
npx supabase db push
```

Aplica, en orden, todo `supabase/migrations/`:

| Migración                   | Contenido                                                          |
| --------------------------- | ------------------------------------------------------------------ |
| `20261016000001_init.sql`   | Tablas, constraints, índices y vista `biored_network_overview`.    |
| `20261016000002_rpc.sql`    | RPCs atómicas + RLS + permisos de funciones.                       |
| `20261016000003_seed.sql`   | Datos semilla de Managua (generado por el motor real).             |
| `20261016000004_grants.sql` | Grants explícitos y política `*_service_all` para el service role. |

### 3. Desplegar la Edge Function

```bash
npx supabase functions deploy api
```

La función se llama `api` y ya viene configurada en `supabase/config.toml` con `verify_jwt = false`
(modo demo: una sola URL para el APK).

> **Variables de entorno:** Supabase inyecta automáticamente `SUPABASE_URL` y
> `SUPABASE_SERVICE_ROLE_KEY` en las Edge Functions, así que **no** hay que declararlas como
> secrets.

### 4. Probar

```bash
curl https://<TU_PROJECT_REF>.supabase.co/functions/v1/api/api/v1/health
# → { "status": "ok", "mode": "postgres", "nodesRegistered": 4, ... }
```

---

## Variables de entorno

`.env` (local) / `npm run dev`:

```env
SUPABASE_URL=                 # vacío = MODO DEMO (memoria)
SUPABASE_SERVICE_ROLE_KEY=
PORT=3000
```

| Variable                                     | Efecto                                                    |
| -------------------------------------------- | --------------------------------------------------------- |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | Presentes → modo **Postgres**. Vacías → modo **memoria**. |
| `PORT`                                       | Puerto del servidor local (default `3000`).               |

---

## Endpoints (`/api/v1`)

| Método | Ruta                               | Descripción                                          |
| ------ | ---------------------------------- | ---------------------------------------------------- |
| `GET`  | `/`                                | Índice navegable de la API y constantes del dominio. |
| `GET`  | `/health`                          | Estado, modo de datos y número de nodos.             |
| `GET`  | `/nodes`                           | Lista de Bio-Nodos + resumen de red.                 |
| `GET`  | `/nodes/:id`                       | Detalle de un Bio-Nodo.                              |
| `GET`  | `/nodes/:id/batches`               | Lotes UCT-3 procesados en el nodo.                   |
| `GET`  | `/nodes/impact/network`            | Impacto agregado de toda la red.                     |
| `POST` | `/nodes/recommend`                 | Enrutamiento Haversine + load balancing.             |
| `POST` | `/nodes/:id/process-batch`         | Registra un lote procesado por la UCT-3.             |
| `GET`  | `/pruning/tickets?userId=`         | Vales de poda (filtrable por vecino).                |
| `POST` | `/pruning/tickets`                 | Registra poda y emite el vale QR.                    |
| `POST` | `/pruning/verify-qr`               | Liquida un vale escaneado (operario).                |
| `GET`  | `/marketplace/items`               | Catálogo del trueque verde.                          |
| `GET`  | `/marketplace/items/:id`           | Detalle de un insumo.                                |
| `GET`  | `/marketplace/redemptions?userId=` | Canjes de un vecino.                                 |
| `POST` | `/marketplace/redeem`              | Canje de Eco-Puntos por un insumo.                   |
| `GET`  | `/community/feed`                  | Feed de actividades + retos.                         |
| `GET`  | `/community/posts/:id`             | Detalle de una publicación.                          |
| `POST` | `/community/posts`                 | Publica una actividad.                               |
| `POST` | `/community/posts/:id/like`        | Like/dislike.                                        |
| `POST` | `/community/challenges`            | Abre un Reto Barrial.                                |
| `GET`  | `/telemetry/summary`               | KPIs municipales + ROI.                              |
| `GET`  | `/telemetry/districts`             | KPIs por distrito.                                   |
| `GET`  | `/telemetry/nodes`                 | KPIs por nodo.                                       |
| `GET`  | `/users`                           | Lista de vecinos.                                    |
| `GET`  | `/users/:id`                       | Perfil de un vecino.                                 |
| `GET`  | `/users/:id/wallet`                | Billetera: puntos, vale y canjes.                    |

### Ejemplos

```bash
# Recomendar nodo
curl -X POST $API/nodes/recommend -H 'content-type: application/json' \
  -d '{"latitude":12.136,"longitude":-86.271,"volumeM3":0.8}'

# Registrar poda (emite el vale QR)
curl -X POST $API/pruning/tickets -H 'content-type: application/json' \
  -d '{"userId":"user-martha","sizeCategory":"lg"}'

# Liquidar el vale (operario)
curl -X POST $API/pruning/verify-qr -H 'content-type: application/json' \
  -d '{"qrCodeHash":"<hash del vale>","operatorId":"user-operador-carmen"}'

# Procesar un lote en la UCT-3
curl -X POST $API/nodes/node-luis-alfonso/process-batch \
  -H 'content-type: application/json' \
  -d '{"tonsProcessed":2.5,"moisturePercent":42,"operatorId":"user-operador-carmen"}'
```

### Errores

Formato uniforme, con código estable para la app:

```json
{
  "error": {
    "code": "TICKET_ALREADY_VERIFIED",
    "message": "Este vale ya fue liquidado anteriormente."
  }
}
```

| HTTP  | Cuándo                                                                |
| ----- | --------------------------------------------------------------------- |
| `404` | Recurso inexistente (`*_NOT_FOUND`).                                  |
| `409` | Regla de negocio: vale ya liquidado, sin stock, puntos insuficientes. |
| `422` | Validación (`VALIDATION_ERROR` con `details[]`) o QR inválido.        |
| `500` | Error inesperado.                                                     |

---

## Motores

### UCT-3 — conversión tricapa (`services/uct3.service.ts`)

```
deviation = humedad − 30                       (30 % = humedad de referencia)
grueso    = clamp(0.50 + deviation × 0.004)    (>25 mm → mulch térmico, Día 1)
fino      = clamp(0.35 − deviation × 0.006)    (<8 mm  → compost, 28 días)
medio     = 1 − grueso − fino                  (8–25 mm → fibra prensa Bio-Macetas)
```

Salidas: kg de cada fracción, Bio-Macetas (210 por tonelada de fibra), horas de cuchilla (alerta a
las 40 h), valor USD del lote (mulch $45/t, compost $120/t, Bio-Maceta $0.90) y flag
`needsPreDrying` (humedad > 45 %).

### Enrutamiento Haversine (`services/routing.service.ts`)

1. Distancia _great-circle_ del origen a cada nodo y al vertedero La Chureca.
2. Peso estimado = `volumen × 120 kg/m³`.
3. Se descartan nodos `full` o con carga proyectada > 100 %.
4. `score = distancia × (1 + carga/100)` → castiga nodos ya saturados.
5. Ahorro de diésel = `(km_vertedero − km_nodo) × rendimiento × precio` (NIC $1.32/L).

Fallback explícito: si ningún nodo tiene capacidad, sugiere el menos cargado y lo marca con
`fallbackApplied = true`.

### Telemetría (`services/telemetry.service.ts`)

Calculada en TypeScript (no en SQL) para una sola fuente de verdad: toneladas de la semana/mes,
camiones ahorrados (`toneladas ÷ 1.5 t`), Bio-Macetas, mulch/compost producido, CO₂ evitado, −6.5 °C
de suelo, 50 % de ahorro de agua y ROI (`capexUsd $1,200`, `monthlyReturnUsd $1,140` → payback ≈
1.05 meses).

---

## Datos semilla (Managua)

- **4 Bio-Nodos**: Las Madres (Distrito I), Luis Alfonso Velásquez, Plantel Noroeste Alcaldía y
  Parque Japonés / Distrito I.
- **5 vecinos**: `user-jose`, `user-operador-carmen`, `user-martha`, `user-marcos`, `user-alma`.
- **4 insumos** de trueque: `item-abono-5kg`, `item-madero-negro`, `item-biomaceta`,
  `item-mulch-10kg`.
- Vale pendiente conocido: `BIORED-MADRES-4821`.

El SQL semilla se **genera con el motor real** para que coincida con el modo memoria:

```bash
deno run --allow-read --allow-write scripts/generate-seed-sql.ts
```

---

## Estructura

```
supabase/
  config.toml                     # project_id + verify_jwt = false
  migrations/                     # init, rpc, seed, grants
  functions/
    api/index.ts                  # entry de la Edge Function
    _shared/
      app.ts  routes/  controllers/  schemas/  serializers/
      services/                   # routing, uct3, qrcode, telemetry
      data/                       # types, seed, repo (port), memory.repo, postgres.repo
      lib/                        # errores de dominio
      middlewares/                # error handler + CORS
src/
  server.ts                       # servidor local (`npm run dev`)
  api-client.ts                   # cliente tipado para la app Expo
scripts/
  generate-seed-sql.ts            # regenera la migración semilla
```

---

## Scripts

```bash
npm run dev          # servidor local (memoria o Postgres según .env)
npm run typecheck    # deno check
npm run fmt          # deno fmt
npm test             # deno test
npm run db:push      # supabase db push
npm run db:reset     # supabase db reset
npm run fn:deploy    # supabase functions deploy api
npm run fn:serve     # supabase functions serve api --env-file .env
```

---

## Seguridad

- La app móvil **nunca** escribe directo a Postgres: todo pasa por la Edge Function.
- Las RPC sensibles revocan `execute` a `anon`/`authenticated`; sólo `service_role`.
- RLS habilitado; lectura pública de catálogos vía políticas `*_read_all`.
- El filtro de búsqueda de vales se **sanea** (`sanitizeLookup`) antes de entrar al filtro
  `.or(...)` de PostgREST, evitando inyección de filtros.
- **Trade-off demo:** `verify_jwt = false`. Para producción, cámbialo a `true` en
  `supabase/config.toml` y despliega; la app ya envía `Authorization: Bearer <anon key>`.

---

## Conexión con la app Expo (`RallyApp`)

1. Levanta el backend (`npm run dev`) o despliega la Edge Function.
2. Define en `RallyApp/.env`:

   ```env
   EXPO_PUBLIC_BIORED_API_URL=http://<IP-LAN>:3000/api/v1
   # o en producción:
   # EXPO_PUBLIC_BIORED_API_URL=https://<ref>.supabase.co/functions/v1/api/api/v1
   ```

3. La app consume la API en `src/services/`; si la API no responde, cae de vuelta a los mocks
   locales (`constants/nodesData.ts`) para que el demo nunca se vea vacío.
