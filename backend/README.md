# ApiTrace API

Backend de la plataforma de trazabilidad apícola argentina. Monolito modular en
NestJS + TypeScript sobre PostgreSQL, preparado para extraer servicios cuando un
módulo lo justifique.

El modelo es **canónico y propio**: SENASA/SIGSA, ARCA y SIFeGA se integran
mediante adaptadores, nunca copiando sus estructuras internas al núcleo.

---

## Puesta en marcha local

Requisitos: Node 22+ y una base PostgreSQL 16 o superior — Neon (hoy sirve 18.6)
o un PostgreSQL local.

```bash
cd backend
cp .env.example .env          # pegar la cadena de Neon y los dos secretos JWT
npm install
npm run db:migrate            # aplica las migraciones SQL
npm run db:seed               # carga la cadena de demostración completa
npm run start:dev
```

La detección de TLS es automática: se activa si la URL apunta a `neon.tech`,
a `render.com`, o trae `sslmode=require`. Neon suspende el cómputo por
inactividad, así que la primera consulta tras un rato puede tardar unos
segundos; los timeouts del pool ya lo contemplan.

- API: `http://localhost:3000/api/v1`
- OpenAPI: `http://localhost:3000/docs`
- Health: `http://localhost:3000/health` · Readiness: `/ready`

Generar secretos JWT:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Usuarios del seed

Contraseña: `ApiTrace2026!` (configurable con `SEED_PASSWORD`).

| Correo | Rol | Alcance |
|---|---|---|
| `admin@apitrace.test` | ADMIN | todas las organizaciones |
| `productor@apitrace.test` | PRODUCTOR | Apiarios del Sur |
| `sala@apitrace.test` | SALA | Sala San Andrés |
| `acopio@apitrace.test` | ACOPIADOR | Acopio Pampa |
| `auditor@apitrace.test` | AUDITOR | lectura global |
| `laboratorio@apitrace.test` | LABORATORIO | Laboratorio Mielab |

---

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run start:dev` | Servidor con recarga en caliente |
| `npm run build` | Compila a `dist/` |
| `npm run db:generate` | Genera una migración SQL a partir del esquema |
| `npm run db:migrate` | Aplica las migraciones pendientes |
| `npm run db:seed` | Carga la cadena de demostración |
| `npm run db:reset` | Vacía las tablas (bloqueado en producción) |
| `npm run db:studio` | Explorador visual de la base |
| `npm test` | Tests unitarios |
| `npm run test:e2e` | Tests e2e contra PostgreSQL real |

---

## Arquitectura

```
src/
├── config/            Configuración validada al arrancar
├── database/
│   ├── schema/        Modelo canónico (Drizzle) por contexto
│   ├── migrate.ts     Runner de migraciones
│   └── seed.ts        Cadena de demostración vía servicios de dominio
├── common/
│   ├── services/      Auditoría, eventos, outbox, códigos, control de acceso
│   ├── guards/        JWT + RBAC
│   ├── interceptors/  Idempotencia y auditoría automática
│   └── filters/       Normalización de errores
└── modules/
    ├── identity/      CU-01 a CU-03
    ├── producer/      CU-04, CU-05
    ├── establishment/ CU-06
    ├── apiary/        CU-07, CU-08
    ├── movement/      CU-09 a CU-12 + motor de reglas
    ├── production/    CU-13 a CU-16, CU-21, CU-24, CU-25
    ├── traceability/  CU-17 a CU-19
    └── audit/         CU-33, CU-34
```

### Decisiones que conviene conocer antes de tocar el código

**El movimiento no es el DT-e.** `movement` es el concepto de dominio;
`dte` es un documento asociado con su propio estado interno, estado externo y
`sync_status`. Si SIGSA cambia, cambia el adaptador, no el núcleo.

**Las reglas normativas son datos, no código.** La tabla `movement_rule` define
qué traslados exigen documento, con `effective_from` / `effective_to`. La regla
de DT-e para material melario apiario → sala rige desde el 01/08/2026: una
consulta con fecha anterior devuelve la regla que estaba vigente entonces. La
evaluación usa la fecha del movimiento, no la fecha de carga.

**Los identificadores oficiales nunca son PK.** RENAPA, RENSPA, DT-e, CUIT, RNE
y RNPA viven en columnas propias, con su sistema de origen y estado de
sincronización. Las claves internas son UUID.

**El grafo de trazabilidad se recorre con CTE recursivas.** `lot_input` es la
arista: un lote puede componerse de movimientos, de una extracción o de otros
lotes, en cadenas de profundidad desconocida. Las consultas cortan ciclos con un
array `path` y un límite de profundidad. No hace falta Neo4j para este volumen.

**El outbox reemplaza al broker, no al patrón.** Los servicios publican eventos
en la misma transacción en que escriben (`outbox_event` + `traceability_event`).
El despachador entrega en proceso con `FOR UPDATE SKIP LOCKED`, así que escalar
horizontalmente no duplica entregas. Incorporar RabbitMQ o Kafka es reemplazar
`OutboxDispatcher`; los servicios de dominio no se tocan.

**La autorización mira el recurso, no solo el rol.** `AccessControlService`
limita cada consulta a la organización del usuario. Un movimiento es visible
desde ambos extremos: origen y destino son organizaciones distintas colaborando
sobre el mismo evento. ADMIN y AUDITOR tienen alcance global; AUDITOR y CONSULTA
no escriben.

**El historial se ordena por instante de registro.** `traceability_event` guarda
`occurred_at` (momento de negocio, que puede informarse con retraso) y
`created_at` (cuándo lo registró la plataforma). El timeline ordena por el
segundo para que un despacho cargado en forma retroactiva no reordene la historia.

---

## Endpoints principales

| Método | Ruta | Caso de uso |
|---|---|---|
| `POST` | `/auth/register` · `/auth/login` · `/auth/refresh` | CU-01, CU-02 |
| `PATCH` | `/users/:id` | CU-03 |
| `POST` | `/producers` · `/producers/:id/renapa` | CU-04, CU-05 |
| `POST` | `/establishments` · `/establishments/:id/renspa` | CU-06 |
| `POST` | `/apiaries` · `/apiaries/:id/hives` | CU-07, CU-08 |
| `POST` | `/movements` | CU-09 |
| `POST` | `/movements/:id/dte` · `/dte/status` · `/dte/close` | CU-10, CU-12 |
| `POST` | `/movements/:id/dispatch` · `/receive` | CU-11 |
| `POST` | `/extractions` · `/extractions/:id/complete` | CU-13 |
| `POST` | `/lots` · `/lots/:id/inputs` | CU-14, CU-15 |
| `POST` | `/lots/:id/drums` · `/drums/:id/transfer` | CU-16, CU-25 |
| `POST` | `/samples` | CU-21 |
| `GET` | `/lots/:id/trace/backward` · `/drums/:id/trace/backward` | CU-17 |
| `GET` | `/traceability/forward/:entityType/:id` | CU-18 |
| `GET` | `/traceability/timeline/:entityType/:id` | CU-19 |
| `GET` | `/audit/events` | CU-34 |
| `GET` | `/movement-rules` · `/movement-rules/effective` | inspección normativa |

Los `POST` que crean entidades aceptan la cabecera opcional `Idempotency-Key`:
un reintento con la misma clave devuelve la respuesta original en lugar de
crear un duplicado.

---

## Recorrido de la cadena completa

```bash
BASE=http://localhost:3000/api/v1
TOKEN=$(curl -s -X POST $BASE/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"acopio@apitrace.test","password":"ApiTrace2026!"}' | jq -r .accessToken)

# Lote de acopio del seed
LOT=$(curl -s -H "Authorization: Bearer $TOKEN" $BASE/lots/by-code/LOTE-2026-000002 | jq -r .id)

# ¿De dónde vino esta miel?
curl -s -H "Authorization: Bearer $TOKEN" $BASE/lots/$LOT/trace/backward | jq '.summary'

# ¿Dónde terminó la producción de este apiario?
APIARY=$(curl -s -H "Authorization: Bearer $TOKEN" $BASE/apiaries | jq -r '.data[0].id')
curl -s -H "Authorization: Bearer $TOKEN" $BASE/traceability/forward/apiary/$APIARY | jq '.summary'
```

La respuesta de trazabilidad incluye `nodes`, `edges`, un `summary` legible y
`gaps`: huecos detectados como un lote sin origen, un movimiento sin el documento
que la regla exigía, o un DT-e todavía sin sincronizar con SIGSA.

---

## Despliegue en Render con base en Neon

El blueprint está en `render.yaml`, en la raíz del repositorio.

1. En Render: **New → Blueprint**, apuntando a este repositorio.
2. Render crea el web service de la API (`rootDir: backend`) y el static site
   de la aplicación web (`rootDir: frontend`).
3. Al crear la API, Render pide `DATABASE_URL`: pegar ahí la cadena de Neon.
   Está declarada como `sync: false` justamente para que la credencial **no
   viva en el repositorio**.
4. Los secretos JWT se generan solos; `CORS_ORIGINS` se toma del host del front.
5. `startCommand` aplica las migraciones antes de levantar el proceso: si una
   migración falla, el deploy no promociona y la versión anterior sigue sirviendo.

### Endpoint directo o agrupado

Neon ofrece dos hosts para la misma base:

| Endpoint | Cuándo usarlo |
|---|---|
| directo (`ep-xxxx.region.aws.neon.tech`) | Una sola instancia del servicio |
| agrupado (`ep-xxxx-pooler.region.aws.neon.tech`) | Varias instancias |

Con más de una instancia conviene el agrupado: el límite de conexiones del plan
gratuito se agota rápido. El backend avisa por log al arrancar si detecta que
está usando el directo.

Después del primer deploy, crear el usuario administrador (el primero queda
ADMIN activo):

```bash
curl -X POST https://<tu-servicio>.onrender.com/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@tudominio.com","password":"<clave-larga>","fullName":"Administrador"}'
```

Cargar las reglas normativas en producción (sin el resto de los datos de demo):

```bash
DATABASE_URL="<cadena-de-neon>" npm run db:seed
```

### Límites de los planes gratuitos

- El web service de Render duerme tras 15 minutos sin tráfico; el primer request
  posterior tarda unos segundos. El static site del frontend **no duerme**.
- Neon suspende el cómputo por inactividad y lo despierta al primer query. A
  diferencia de la base gratuita de Render, **no expira a los 30 días**: ese fue
  el motivo principal para moverse a Neon.
- `DATABASE_POOL_MAX` está en 5 porque el plan gratuito de Neon admite pocas
  conexiones simultáneas.

---

## Lo que este MVP deliberadamente no hace

Integración viva con SIGSA, ARCA y SIFeGA (los estados de sincronización ya
existen y quedan en `PENDING_SYNC`); object storage para los binarios de los
documentos (se guardan los metadatos); resultados de laboratorio; facturación
electrónica; fraccionamiento y producto final; QR público; PostGIS.

El detalle y el orden de incorporación están en `04-MVP-ApiTrace.md` y
`05-ADR-Decisiones-Tecnicas.md`, en la raíz del repositorio.

La aplicación web instalable que consume esta API está en `frontend/`.
