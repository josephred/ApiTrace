# T03 · Modelo DT-e correcto y migración de reparación (C2)

**Objetivo:** que el DT-e que guarda ApiTrace sea el trámite API-SEM de SENASA, y que la
base existente llegue a ese modelo sin perder datos.

**Cierra:** D-01 a D-08, A-01 a A-07, S-05, S-06.

## Precondiciones

- T01 cumplido: diagnóstico sin bloqueos.
- T02 cumplido.
- PostgreSQL local disponible para las pruebas e2e (o, si no hay, ver la nota al final).

## Pasos

```powershell
cd C:\github\ApiTrace

# 1. Aplicar la fase.
git apply --check docs\plan-dte\parches\02-backend-dte.patch
git apply docs\plan-dte\parches\02-backend-dte.patch
git status --short | Measure-Object -Line      # 59 archivos

# 2. Que no haya cambiado ninguna dependencia.
git diff --stat backend/package.json backend/package-lock.json   # sin salida

# 3. Compilar y probar.
cd backend
npm run build
npm test                                       # 43 pruebas
```

Pruebas e2e sobre una base limpia (crea el esquema con las tres migraciones):

```powershell
# Base local vacía para las e2e.
psql -U postgres -c "DROP DATABASE IF EXISTS apitrace_test"
psql -U postgres -c "CREATE DATABASE apitrace_test"
$env:DATABASE_URL_TEST = "postgresql://postgres:postgres@localhost:5432/apitrace_test"
npm run test:e2e                               # 68 pruebas
```

Comprobar que el esquema del código y el de las migraciones coinciden:

```powershell
npx drizzle-kit generate
```

Ensayo de la migración contra **una copia de los datos reales** (la rama de respaldo de
Neon creada en T00 — nunca contra producción en este paso):

```powershell
$env:DATABASE_URL = "<cadena de conexión de la rama respaldo-pre-0002-2026-09-21>"
npm run db:migrate
cd ..
```

## Salida esperada

- `npm run build`: sin errores.
- `npm test`: `Tests: 43 passed, 43 total`.
- `npm run test:e2e`: `Tests: 68 passed, 68 total`.
- `npx drizzle-kit generate`: `No schema changes, nothing to migrate`.
- `npm run db:migrate` contra la copia:
  `[migrate] Migraciones aplicadas correctamente.`

Si la migración se detiene, el mensaje empieza así:

```
cause: error: 0002_dte_reparacion: <qué pasó>. Ver docs/plan-dte/sql/diagnostico-pre-0002.sql, consulta D6.
```

Eso significa que quedó un caso sin resolver en T01: la copia **no** quedó a medias (todo
se revierte). Volver a T01 con esa consulta, resolver, y repetir este paso.

## Verificación (gate)

- [ ] 43 unitarias y 68 e2e en verde.
- [ ] `drizzle-kit generate` sin cambios de esquema.
- [ ] La migración corrió completa sobre la copia de los datos reales.
- [ ] En esa copia: `SELECT count(*) FROM dte WHERE verification_code = 'VER-0000';` → `0`,
      y `SELECT count(*) FROM (SELECT movement_id FROM dte WHERE status NOT IN ('ANULADO','ELIMINADO','RECHAZADO') GROUP BY movement_id HAVING count(*) > 1) x;` → `0`.

## Qué NO hacer

- No editar `0001_dte_api_sem.sql` ni `0000_init.sql`.
- No correr `npm run db:push` en ningún entorno: reescribe el esquema sin registrar nada.
- No correr `db:migrate` contra producción en esta tarea (eso pasa solo, en T08, con el
  despliegue).
- No borrar `backend/drizzle/meta/0002_snapshot.json`: sin él, la próxima migración que
  genere `drizzle-kit` va a repetir todo.

> **Si no hay PostgreSQL local:** se puede correr las e2e contra una rama de prueba de Neon
> (`CREATE DATABASE` no hace falta: la rama ya es una base vacía si se crea desde
> `main` y se truncan las tablas). Las e2e truncan tablas, así que **nunca** apuntarlas a
> producción.
