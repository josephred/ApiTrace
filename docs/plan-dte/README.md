# `docs/plan-dte` · Revisión, plan y contrato del DT-e

Paquete de trabajo sobre el **Documento de Tránsito electrónico (DT-e, movimiento API-SEM)**
de ApiTrace: qué se revisó, qué hay que corregir, con qué comandos, y qué necesita ApiTrace
de SENASA.

Generado el **2026-09-21** contra el estado del repositorio en `bdd2a5b` (rama `main`).

---

## Por dónde empezar

| Si querés… | Leé |
| :--- | :--- |
| Saber cómo quedó lo que hizo Antigravity y qué falta | [`09-Revision-Antigravity-y-Alineacion-DTE.md`](09-Revision-Antigravity-y-Alineacion-DTE.md) |
| Aplicar las correcciones, paso por paso | [`11-Plan-Correccion-DTE-Antigravity.md`](11-Plan-Correccion-DTE-Antigravity.md) y `tareas/` |
| Preparar la reunión con SENASA | [`10-API-Integracion-SENASA-ApiTrace.md`](10-API-Integracion-SENASA-ApiTrace.md) + `openapi-apitrace-senasa.yaml` |
| Revisar la base de producción antes de desplegar | [`sql/diagnostico-pre-0002.sql`](sql/diagnostico-pre-0002.sql) |
| Ver el código ya corregido | `parches/` (para aplicar) y `referencia-dte.zip` (copias completas) |

---

## Contenido

```
docs/plan-dte/
├── README.md                                  este índice
├── 09-Revision-Antigravity-y-Alineacion-DTE.md  qué se revisó, hallazgos, matriz de alineación, qué falta
├── 10-API-Integracion-SENASA-ApiTrace.md        qué API necesita ApiTrace de SENASA + checklist de la reunión
├── openapi-apitrace-senasa.yaml                 el mismo contrato en OpenAPI 3.1 (anexo técnico)
├── 11-Plan-Correccion-DTE-Antigravity.md        plan de corrección: orden, dependencias y definición de terminado
├── tareas/
│   ├── T00-preparacion.md                       rama de trabajo y respaldo de la base
│   ├── T01-diagnostico-base.md                  diagnóstico de la base real y resolución de bloqueos
│   ├── T02-seguridad-acceso.md                  cerrar la puerta de la autenticación (C1)
│   ├── T03-backend-dte.md                       modelo DT-e y migración de reparación (C2)
│   ├── T04-frontend-dte.md                      pantallas del DT-e (C3)
│   ├── T05-contenido-y-pdf.md                   landing, manuales y PDF (C4)
│   ├── T06-render-entorno.md                    variables de entorno del despliegue
│   ├── T07-base-sin-migraciones.md              base creada con `drizzle-kit push` (condicional)
│   ├── T08-despliegue-y-verificacion.md         desplegar y verificar en el aire
│   ├── T09-cuentas-demostracion.md              cuentas de demostración y acceso rápido
│   └── T10-capturas-y-cierre.md                 capturas, PDF finales y commit (opcional)
├── sql/
│   ├── diagnostico-pre-0002.sql                 solo lectura: qué puede detener la migración (D0–D8)
│   ├── registrar-migraciones-push.sql           si la base se creó con `push` y no tiene historial
│   └── cuentas-demo-produccion.sql              desactivar las cuentas de demostración
├── parches/
│   ├── 01-seguridad-acceso.patch                3 archivos
│   ├── 02-backend-dte.patch                     59 archivos (incluye la migración 0002)
│   ├── 03-frontend-dte.patch                    26 archivos
│   └── 04-contenido-landing-manuales.patch      10 archivos
├── referencia-dte.zip                           copia completa de los 91 archivos corregidos,
│                                                con la misma ruta que en el repositorio
└── referencia-INVENTARIO.md                     qué hay en el zip: tamaño, líneas y sha256
```

---

## Cómo se aplica, en corto

```powershell
cd C:\github\ApiTrace
git checkout -b correccion/dte

# 1. Antes de tocar nada: diagnóstico de la base real (tarea T01).
#    Neon > SQL Editor > docs\plan-dte\sql\diagnostico-pre-0002.sql

# 2. Fases, en este orden (tareas T02 a T05).
git apply docs\plan-dte\parches\01-seguridad-acceso.patch
git apply docs\plan-dte\parches\02-backend-dte.patch
git apply docs\plan-dte\parches\03-frontend-dte.patch
git apply docs\plan-dte\parches\04-contenido-landing-manuales.patch

# 3. Verificación (no se sigue sin esto).
cd backend;  npm run build; npm test; npm run test:e2e; cd ..
cd frontend; npm run build; npx vitest run;             cd ..
```

Cada tarea de `tareas/` trae los comandos completos, la salida esperada, la condición que
deja pasar a la siguiente y lo que **no** hay que hacer. Si un parche no aplica, la copia
completa del archivo está en `referencia-dte.zip` (mismas rutas que el repositorio) y su
`sha256` en `referencia-INVENTARIO.md`:

```powershell
Expand-Archive docs\plan-dte\referencia-dte.zip -DestinationPath docs\plan-dte\referencia -Force
```

---

## Estado de la implementación de referencia

Probada antes de entregarse, sobre PostgreSQL 16:

| Verificación | Resultado |
| :--- | :--- |
| `npm run build` (backend y frontend) | Sin errores |
| `npm test` (backend) | 43 pruebas |
| `npm run test:e2e` (backend, base limpia) | 68 pruebas |
| `npx vitest run` (frontend) | 21 pruebas |
| `npx drizzle-kit generate` | Sin cambios de esquema pendientes |
| Esquema final desde los tres puntos de partida (migrador, `push`, base nueva) | Idéntico |
| Migración `0002` sobre datos creados con el backend de Antigravity | Repara y, cuando hace falta una decisión humana, se detiene y revierte |

El detalle de cada escenario está en la sección 8 del documento 09.

---

## Reglas que este paquete respeta

- No se modifica `0001_dte_api_sem.sql`: ya se aplicó en Neon. Toda corrección va hacia
  adelante, en `0002_dte_reparacion.sql`.
- No se inventan datos: si falta un RENAPA o un código SENASA, el campo queda vacío y la
  pantalla lo pide.
- No se borran DT-e: se marcan `ELIMINADO` o `ANULADO` con motivo y quedan en el historial.
- Nada se afirma sin haberlo verificado; lo que es un supuesto está marcado como tal.
