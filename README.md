# BioRed API & Physical Engine 🌿

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Deno](https://img.shields.io/badge/Deno-v2.x-black.svg?logo=deno)](https://deno.land/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green.svg?logo=supabase)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Backend y motor físico-logístico para **BioRed · Red Barrial de Bio-Nodos Urbanos de Managua**, desarrollado en el marco del **Rally Latinoamericano de Innovación 2026 (Desafío 04 - Valorización de Residuos de Poda Urbana)**.

El sistema resuelve la logística inversa y valorización in situ de poda urbana, sustituyendo la quema a cielo abierto y el transporte costoso hacia el vertedero municipal La Chureca por una red descentralizada de microestaciones de triturado y trueque circular.

---

## 🚀 Arquitectura General

```
┌─────────────────────────────────┐
│     RallyApp (Mobile Expo)      │
│     iOS & Android (SDK 57)      │
└───────────────┬─────────────────┘
                │
                │ HTTPS / PostgREST & RPC
                ▼
┌────────────────────────────────────────────────────────┐
│               BioRed API Service Layer                 │
│  ┌──────────────────────────────────────────────────┐  │
│  │ ⚙️ Motor Físico UCT-3 (Trommel Tricapa)          │  │
│  │ 🚚 Enrutador Haversine + Carga Adaptativa        │  │
│  │ 🎟️ Emisión & Liquidación Criptográfica de QR     │  │
│  │ 📊 Telemetría Municipal & Ahorro de Emisiones    │  │
│  └──────────────────────────────────────────────────┘  │
│         │                                     │        │
│   (Modo Cloud)                           (Modo Local)  │
│         ▼                                     ▼        │
│  ┌───────────────┐                     ┌─────────────┐ │
│  │ PostgresRepo  │                     │ MemoryRepo  │ │
│  └───────┬───────┘                     └─────────────┘ │
└──────────┼─────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│       Supabase Database         │
│  • Tablas Relacionales          │
│  • Funciones RPC Transaccionales│
│  • Índices Geoespaciales        │
│  • Row-Level Security (RLS)     │
└─────────────────────────────────┘
```

---

## 💡 Características Principales

### 1. ⚙️ Motor Físico UCT-3 (Cilindro Trommel Tricapa)
Ubicado en `supabase/functions/_shared/services/uct3.service.ts`:
* Modela el procesamiento de biomasa leñosa según la **humedad relativa ambiental de Managua (base 30%)**.
* Clasifica el triturado en tres fracciones mediante cribado rotativo:
  * **Fracción Gruesa (> 25 mm):** Mulch térmico de aplicación inmediata para retención de humedad.
  * **Fracción Fina (< 8 mm):** Materia prima para compostaje acelerado barrial (ciclo de 28 días).
  * **Fracción Media (8 a 25 mm):** Fibra vegetal aglutinable para prensado de **Bio-Macetas biodegradables** (rendimiento: 210 macetas por tonelada).
* Monitorea el desgaste acumulado de las **cuchillas de acero 5160** con alerta de mantenimiento a las 40 horas efectivas de rotación.
* Calcula la valorización económica en USD del lote procesado ($45/t mulch, $120/t compost, $0.90/ud bio-maceta).

### 2. 🚚 Enrutamiento Inverso Haversine con Balanceo de Carga
Ubicado en `supabase/functions/_shared/services/routing.service.ts`:
* Calcula la distancia ortodrómica (*great-circle*) desde la ubicación del ciudadano o cuadrilla hacia todos los Bio-Nodos activos.
* Asigna un puntaje dinámico de saturación:
  $$\text{Score} = \text{Distancia (km)} \times \left(1 + \frac{\text{Carga Tolva (\%)}}{100}\right)$$
* Evita el colapso de nodos congestionados y redirige de forma balanceada.
* Calcula el **diésel ahorrado** frente al trayecto habitual hacia el vertedero La Chureca (rendimiento estimado de camión recolector: 3.5 km/L a $1.32 USD/L).

### 3. 🎟️ Vouchers QR "Rama por Planta" con Transaccionalidad Atómica
* El vecino registra el volumen aproximado de ramas y genera un vale digital firmado criptográficamente con hash SHA-256.
* En el Bio-Nodo, el operario escanea el código QR desde la app.
* La liquidación se ejecuta mediante la función almacenada **`biored_verify_ticket`** en PostgreSQL:
  * Acredita los Bio-Puntos de forma inmediata en la billetera del vecino.
  * Incrementa la tolva y las métricas de recepción del nodo.
  * Invalida el vale para prevenir doble canje (*double-spending*).

### 4. 🛒 Trueque Verde & Economía Circular
* Los puntos acumulados se canjean por compost madurado, biofertilizantes foliares, plantines nativos (Madroño, Sacuanjoche, Madero Negro) y bio-macetas.
* La función RPC **`biored_redeem_item`** descuenta el inventario y los puntos del usuario en una sola transacción atómica segura.

---

## 🗄️ Esquema de Base de Datos (PostgreSQL en Supabase)

### Tablas Principales

| Tabla | Descripción |
| :--- | :--- |
| **`bio_nodes`** | 8 microestaciones georreferenciadas en Managua con capacidad, estado de tolva, horas de cuchilla y operador a cargo. |
| **`users`** | Perfiles ciudadanos, cuadrillas barriales, operarios municipales y administradores comunales. |
| **`community_posts`** | Feed social con evidencias fotográficas, kilos aportados, retos barriales y métricas de interacción. |
| **`nursery_items`** | Catálogo del trueque de insumos biológicos disponibles por nodo. |
| **`pruning_tickets`** | Vales QR generados para entrega de biomasa y trazabilidad de pesaje. |
| **`bio_batches`** | Registro histórico de lotes triturados por la máquina UCT-3 y subproductos obtenidos. |
| **`redemptions`** | Registro de canjes realizados por vecinos en los viveros comunitarios. |

### Funciones Almacenadas (RPC)

* `biored_verify_ticket(p_ticket_id, p_operator_id)`: Valida el QR, añade la carga a la tolva del nodo y acredita puntos al vecino.
* `biored_redeem_item(p_user_id, p_item_id)`: Verifica saldo y stock, descuenta puntos y genera el recibo de entrega.
* `biored_apply_batch(...)`: Registra el triturado industrial, incrementa stock de mulch/compost y suma horas a las cuchillas.

---

## 📡 Endpoints del API (`/api/v1`)

| Método | Endpoint | Descripción |
| :---: | :--- | :--- |
| `GET` | `/health` | Chequeo de salud del servicio y modo de persistencia (`postgres` o `memory`). |
| `GET` | `/nodes` | Lista de todos los Bio-Nodos, coordenadas y estado en vivo. |
| `POST`| `/nodes/recommend` | Algoritmo de recomendación y enrutamiento óptimo de entrega. |
| `GET` | `/nodes/:id` | Detalle específico de un Bio-Nodo y sus métricas de tolva. |
| `POST`| `/nodes/:id/process-batch`| Registro de molienda UCT-3 y actualización de derivados. |
| `GET` | `/pruning/tickets` | Consulta de vales de poda por usuario (`?userId=...`). |
| `POST`| `/pruning/tickets` | Generación y emisión de nuevo vale QR digital. |
| `POST`| `/pruning/verify-qr` | Escaneo y liquidación del vale en campo por el operario. |
| `GET` | `/marketplace/items` | Catálogo de insumos en viveros para canje con puntos. |
| `POST`| `/marketplace/redeem` | Ejecución de canje de insumos ecológicos. |
| `GET` | `/community/feed` | Publicaciones ciudadanas y retos de biomasa activos. |
| `POST`| `/community/posts` | Nueva publicación comunitaria con evidencia fotográfica. |
| `GET` | `/telemetry/summary` | Dashboard municipal de toneladas desviadas, ahorro de agua y diésel. |

---

## 🛠️ Instalación y Desarrollo Local

### Requisitos
* [Node.js](https://nodejs.org/) v18+ o [Deno](https://deno.land/) v2+
* [Supabase CLI](https://supabase.com/docs/guides/cli) (opcional para desarrollo local con Docker)

### 1. Clonar el repositorio
```bash
git clone git@github.com:josevelligh/Backend-Biored.git
cd Backend-Biored
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configuración de Variables de Entorno
Crea un archivo `.env` basado en el ejemplo:
```bash
cp .env.example .env
```

Configuración básica:
```env
# Modo Memoria (Sin base de datos externa, usa el dataset completo de Managua en RAM):
PORT=3000

# O Modo Supabase Postgres (Producción / Nube):
SUPABASE_URL=https://thlizppibkntlrpyhrmn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui
```

### 4. Iniciar el Servidor de Desarrollo
```bash
npm run dev
```
El servidor quedará disponible en `http://localhost:3000/api/v1/health`.

---

## 🧪 Pruebas Rápidas con cURL

**Verificar estado del servicio:**
```bash
curl -s http://localhost:3000/api/v1/health | jq .
```

**Consultar recomendación de Bio-Nodo óptimo:**
```bash
curl -s -X POST http://localhost:3000/api/v1/nodes/recommend \
  -H "Content-Type: application/json" \
  -d '{"latitude": 12.1360, "longitude": -86.2710, "volumeM3": 0.8}' | jq .
```

**Consultar Bio-Nodos registrados:**
```bash
curl -s http://localhost:3000/api/v1/nodes | jq .
```

---

## 📲 Conexión con la App Móvil (`RallyApp`)

El frontend móvil en Expo está configurado para consumir los datos directamente desde la nube de Supabase:

* **Endpoint Base:** `https://thlizppibkntlrpyhrmn.supabase.co/rest/v1`
* **Autenticación PostgREST:** Header `apikey: EXPO_PUBLIC_SUPABASE_ANON_KEY`
* **Resiliencia Offline:** En caso de corte de señal en campo, la app conmuta automáticamente a los modelos locales sin interrumpir la experiencia de usuario.

---

## 👥 Equipo y Créditos

Proyecto desarrollado para el **Rally Latinoamericano de Innovación 2026** por el equipo de innovación ambiental y desarrollo tecnológico de Managua, Nicaragua.
