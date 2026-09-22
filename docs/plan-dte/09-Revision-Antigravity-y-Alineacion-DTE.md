# 09 · Revisión del desarrollo de Antigravity y alineación del DT-e

**Proyecto:** ApiTrace · **Fecha:** 2026-09-21 · **Revisor:** Claude (Opus 5)
**Commit revisado:** `bdd2a5b` (rama `main`, 2026-09-19 23:06 UTC)
**Base de comparación:** especificación `especificacion-tecnica-dte-apitrace.md` + documentos 00 a 08 del repositorio.

---

## 1. Qué se revisó y cómo

Se revisó **todo lo que Antigravity dejó en el repositorio** hasta `bdd2a5b`: módulo DT-e
(backend y frontend), sistema de ayudas, módulo de configuración, migración
`0001_dte_api_sem`, los 7 manuales con sus PDF, la landing y el despliegue (`render.yaml`).

El método no fue sólo leer código. Se levantaron entornos reales para ver qué pasa:

| Escenario reproducido | Cómo | Para qué |
| :--- | :--- | :--- |
| Base "Neon" | PostgreSQL 16 con la línea base + `npm run db:migrate` de Antigravity (aplica `0001`) + DT-e creados con **su** backend por HTTP | Ver el comportamiento real del camino de despliegue de Render |
| Base "push" | `drizzle-kit push` desde su esquema TypeScript + su `npm run db:seed` | Ver el otro camino posible de creación de la base |
| Base nueva (CI) | Migraciones desde cero | Ver qué obtiene un entorno limpio |

Todas las afirmaciones de este documento se verificaron en uno de esos entornos o citan
el archivo y la línea. Cuando algo **no** se pudo verificar, se dice explícitamente.

---

## 2. Veredicto en una página

El avance es **real y considerable**: el DT-e pasó de no existir a tener estados, semáforo,
ciclo de vida, historial, pantallas y manuales. La arquitectura elegida (puerto SENASA con
adaptadores, cola de reintentos, reglas puras separadas del servicio) es la correcta.

El problema no es la cantidad de trabajo: es que **una parte de lo construido no coincide
con la base de datos que va a producción, otra parte declara datos que SENASA no
aceptaría, y hay una puerta de acceso abierta en la autenticación**.

| Módulo | Avance | Estado | Qué falta |
| :--- | :--- | :--- | :--- |
| Máquina de estados del DT-e | 90 % | Correcta | Anticipación de 4 días; gracia 5 → 4 días; bloqueo del titular con DT-e CADUCADO |
| Datos del trámite API-SEM | 40 % | **Desalineado** | 6 de 8 campos del trámite se envían con valores propios de ApiTrace, no de SIGSA (§5) |
| Migración / esquema | 30 % | **Roto en el camino de Render** | `0001` no coincide con el código: crear un movimiento devuelve 500 (D-01) |
| Emisión y cierre | 70 % | Funciona, con agujeros | Cierre sin código verificable y cantidad recibida inventada (S-06) |
| Acceso y multi-tenencia | 60 % | Parcial | El listado filtra por organización; la consulta por id y el cierre, no (S-05) |
| Autenticación | — | **Puerta abierta** | Contraseñas genéricas aceptadas por dominio (S-01) |
| Integración SENASA | 20 % | Honesta como simulación | El adaptador SIGSA declara capacidades que no tiene; falta el contrato (doc 10) |
| Ayudas en pantalla | 85 % | Buen trabajo | Citas normativas sin respaldo (C-10) |
| Configuración (`/settings`) | 50 % | Preferencias que no hacen nada | Dejar sólo lo que la app usa (corregido en C3) |
| Manuales y landing | 70 % | Muy buena forma, contenido con afirmaciones falsas | 12 correcciones de contenido (§6) |

**Lo que hay que hacer antes de mostrarle esto a SENASA o cargar un dato real:** los seis
puntos de la tabla de la sección 4 marcados como Crítico o Alto. El plan atómico con los
comandos exactos está en `11-Plan-Correccion-DTE-Antigravity.md`.

---

## 3. Lo que está bien hecho (y conviene conservar)

No es cortesía: esto es la parte que el plan de corrección **no** toca.

1. **Los once estados del DT-e** (`BORRADOR`, `SOLICITADO`, `EMITIDO`, `VIGENTE`,
   `VENCIDO`, `CADUCADO`, `CERRADO`, `SIN_ARRIBO`, `ANULADO`, `ELIMINADO`, `RECHAZADO`)
   con la distinción fina entre `ANULADO` (con arancel pagado) y `ELIMINADO`. Coincide con
   la matriz de la especificación §5.1.
2. **Semáforo de tránsito** y la regla de que sólo `VIGENTE` permite circular.
3. **Regla de oro Qreal ≤ Qdeclarada** en el cierre y en la regularización, con el mensaje
   que explica que hay que anular y emitir de nuevo (`dte.service.ts:647`).
4. **Barrido de vigencia** (`dte-lifecycle.service.ts`): mueve EMITIDO → VIGENTE → VENCIDO
   → CADUCADO por fecha, con historial de cada cambio, en zona horaria argentina.
5. **Historial de estados** (`dte_status_history`) con actor, motivo y correlación.
6. **Reglas puras separadas** del servicio (`dte.rules.ts`), lo que hace que se puedan
   probar sin base de datos y compartir el vocabulario con el frontend.
7. **Listado con perspectiva** emitido/recibido filtrado por organización.
8. **El código de cierre se oculta** a quien no es emisor ni administrador
   (`dte.presenter.ts`) — la idea es correcta, el detalle tiene un agujero (S-05).
9. **Sistema de ayudas contextuales**: es lo que hace que un apicultor entienda la
   pantalla. La forma es excelente.
10. **Manuales por rol y landing**: el nivel de redacción y de diseño es alto. El problema
    es lo que afirman, no cómo lo dicen.

---

## 4. Hallazgos

Severidad: **Crítico** = hay que corregirlo antes de que alguien lo use; **Alto** = antes de
cargar datos reales; **Medio** = antes de la próxima demostración; **Bajo** = deuda anotada.

### 4.1 Seguridad y acceso

| Id | Sev. | Hallazgo |
| :--- | :--- | :--- |
| **S-01** | **Crítico** | **Contraseñas genéricas aceptadas por dominio.** `auth.service.ts` acepta `apitrace2026!`, `password`, `123456`, `admin`, `apigestion2026!` y `beetrace2026!` para **cualquier** cuenta cuyo correo contenga `@apitrace` o termine en `.test`, sin comparar el hash guardado. Verificado contra su backend: `POST /auth/login {"email":"admin","password":"123456"}` → **200 y token de ADMIN**. En el despliegue público esto significa que cualquiera entra como administrador. |
| **S-02** | Alto | **El correo escrito no identifica la cuenta.** La búsqueda arma seis candidatos (`usuario@apitrace`, `@apitrace.test`, `@apitrace.ar`, …) y toma `limit(1)` sin orden: `demo@cualquier-dominio.com` abre la cuenta `demo@apitrace.test` si existe, y con dos cuentas homónimas el resultado depende del orden físico de las filas. |
| **S-03** | **Crítico** | **La landing publica una "contraseña universal".** `landing/index.html` mostraba `ApiTrace2026!` junto a seis correos. Cinco de esos correos **no existen** en la base (el seed crea `@apitrace`, no `@apitrace.ar`), pero `admin@apitrace.ar` sí resuelve —por S-02— a `admin@apitrace`: el enlace "Probar Demostración en Vivo" más la contraseña publicada dan **acceso de administrador al despliegue real**. |
| **S-04** | Medio | **Acceso rápido de demostración siempre visible** (commit `ea10a7d`). Es una decisión legítima para una demo pública, pero tiene que ser una decisión **del despliegue**, no una constante del código, y la instancia con datos reales debe tenerla apagada. |
| **S-05** | Alto | **Consultas y cierre sin control de organización.** `getById` y `getByMovementId` (`dte.service.ts:819` y `:838`) no verifican que el usuario tenga relación con el DT-e: con el id, cualquier usuario autenticado ve titular, CUIT, patente y cantidades. `closeDte` tampoco: una sala de otra organización puede cerrar un DT-e ajeno. Además el código de cierre se revela a todos cuando el DT-e queda `CERRADO` (`dte.presenter.ts:14`). |
| **S-06** | **Crítico** | **Cierre con código y cantidad inventados.** La ruta heredada `POST /movements/:id/dte/close` llama a `closeDte` pasando **el código guardado** (`item.verificationCode ?? 'VER-0000'`) y **la cantidad declarada** (`Number(item.declaredQuantity ?? 100)`) como cantidad realmente arribada (`dte.service.ts:1028-1041`). Es decir: cierra sin que nadie presente el código del papel y **registra como contada una cantidad que nadie contó**. En `closeDte` la comparación del código sólo ocurre `if (storedCode)`: un DT-e cargado a mano sin código acepta cualquier valor. |

### 4.2 Datos y migración

| Id | Sev. | Hallazgo |
| :--- | :--- | :--- |
| **D-01** | **Crítico** | **La migración `0001` no coincide con el código.** El esquema TypeScript renombró columnas de `movement_rule` (`origin_type`→`source_establishment_type`, `destination_type`→`destination_establishment_type`, `legal_reference`→`legal_basis`, `notes`→`description`) **sin migración**. Reproducido: base con `0000`+`0001` aplicadas por el migrador (el camino de `start:render`) → `POST /api/v1/movements` responde **500** con `column movement_rule.source_establishment_type does not exist`. En producción eso es **no se puede registrar ningún movimiento**, y sin movimiento no hay DT-e. Sólo funciona si la base se creó con `drizzle-kit push`. |
| **D-02** | Alto | **El mismo esquema da dos bases distintas.** Verificado: con el migrador, `dte.load_date` es `timestamptz` y `declared_quantity` `numeric`; con `push`, `varchar(10)` e `integer`. `issue_mode` queda `varchar(40)` o `varchar(30)`. El comportamiento del sistema depende de cómo se creó la base. |
| **D-03** | Alto | **Estados antiguos sin traducir.** `0001` convierte `dte.status` a `varchar(40)` y cambia el valor por defecto a `BORRADOR`, pero **no traduce** los valores que ya había (`DRAFT`, `ISSUED`, `CLOSED`). Verificado: en la base migrada conviven `CLOSED` e `ISSUED` con `BORRADOR`, `EMITIDO` y `VIGENTE`. Ninguna pantalla sabe qué es `CLOSED`. |
| **D-04** | Alto | **Se quitó la unicidad y no se puso nada en su lugar.** `0001` ejecuta `DROP CONSTRAINT dte_movement_id_unique` y no agrega ninguna regla. Verificado con su propia API: se pudo dejar un movimiento con un DT-e `CERRADO` **y** otro `EMITIDO` con número distinto, y otro con un borrador nuevo sobre un DT-e ya cerrado. Un traslado amparado por dos documentos es exactamente lo que la trazabilidad no puede permitir. |
| **D-05** | Medio | **Marcadores inventados guardados como datos.** El seed y la ruta heredada escriben `verification_code = 'VER-0000'`, `transport_plate = 'AAA000'`, `transport_type = 'PROPIO'` (eso es quién es el dueño del transporte, no el tipo de vehículo que pide SIGSA), `pdf_url` a una dirección inexistente y `sync_status = 'SYNCHRONIZED'` en DT-e que nunca se verificaron contra SIGSA. |
| **D-06** | Medio | **Sin unicidad en los códigos oficiales.** Nada impide dos apiarios con el mismo RENAPA, dos salas con el mismo código SENASA ni dos delegaciones del mismo servicio para el mismo productor. |
| **D-07** | Medio | **El día del DT-e se guarda como instante.** `load_date` y `expiry_date` como `timestamptz` a medianoche de la zona de la sesión: según dónde corra el servidor, la fecha de carga puede leerse un día antes o después. Son días calendario argentinos. |
| **D-08** | Bajo | **`npm run db:seed` falla siempre.** El seed crea el DT-e en estado `EMITIDO` y a continuación llama al cierre, que exige `VIGENTE`: `DomainRuleException` en `dte.service.ts:626`. Verificado en base nueva: el entorno de demostración queda a medias (sin extracción, lotes ni tambores). |

### 4.3 Alineación con la especificación del trámite

| Id | Sev. | Hallazgo |
| :--- | :--- | :--- |
| **A-01** | **Crítico** | **6 de 8 campos del trámite API-SEM tienen el valor equivocado.** Ver la matriz completa en §5. Si mañana se conecta la API con estos valores, SIGSA rechaza el trámite. |
| **A-02** | Alto | **Falta la anticipación máxima.** La especificación permite emitir por autogestión hasta 4 días antes de la fecha de carga; el código sólo valida que la fecha no sea pasada. |
| **A-03** | Medio | **Gracia de 5 días en lugar de 4.** `LAPSE_GRACE_DAYS = 5` (`dte.rules.ts:12`) contra los 4 días de la especificación §5.1. Un día de más antes de `CADUCADO`. |
| **A-04** | Medio | **Vigencia por defecto 3 días** (`DEFAULT_VALIDITY_DAYS = 3`) contra los 2 de la especificación §4.1. |
| **A-05** | Alto | **`CADUCADO` no bloquea al titular.** La especificación dice que el productor queda inhabilitado para emitir nuevos DT-e; no hay ninguna verificación de eso al crear un borrador. |
| **A-06** | Medio | **El simulador se hace pasar por emisión manual.** El adaptador simulado guarda `issue_mode = 'MANUAL'` y un `pdf_url` inexistente: en la base no se distingue un número simulado de uno transcrito de SIGSA. Verificado: `DTE-2026-541099` con `external_id = SIGSA-SIM-…` e `issue_mode = MANUAL`. |
| **A-07** | Bajo | **Citas normativas sin respaldo en el código.** `dte.rules.ts:3` cita "Resolución SENASA 356/2008 y 875/2020". La 356/2008 aparece en la especificación; la 875/2020 no está en ninguna fuente del repositorio. |

### 4.4 Contenido publicado (landing y manuales)

| Id | Sev. | Hallazgo |
| :--- | :--- | :--- |
| **C-01** | **Crítico** | "Plataforma Homologada 2026" e "Integración oficial con SENASA API-SEM" (landing, encabezado y pie). No hay homologación ni integración: el canal real es manual. Es una afirmación que, ante SENASA, cuesta credibilidad. |
| **C-02** | **Crítico** | **El DT-e se lleva impreso.** La landing y el manual del transportista dicen que en un control se muestra el celular con "QR y constancia oficial". La especificación §5.1 exige la representación gráfica **impresa** en la cabina. Un chofer que confíe en el manual viaja sin el papel. |
| **C-03** | Alto | **"Código de Verificación de 12 caracteres"** con ejemplo inventado (`V4K9-2P8M-7X1Q`) en la landing y en dos manuales. La especificación lo define como `VARCHAR(20)` y su ejemplo es `790112`. |
| **C-04** | Alto | **Modos de pasarela inexistentes** (`SIMULATED` / `HOMOLOGATION` / `PRODUCTION`, con "simulador criptográfico" y "conexión en tiempo real con ARCA"). Los modos reales son `manual`, `simulado` y `sigsa` (esqueleto), y se eligen por variable de entorno, no desde una pantalla. |
| **C-05** | Alto | **Parámetros de configuración que no existen**: `DTE_MAX_DAYS`, `WEIGHT_DISCREPANCY_TOLERANCE_PCT`, `HONEY_MAX_MOISTURE_PCT`, `YIELD_KG_PER_ALZA_MIN/MAX` (manual del administrador §3). No hay ninguna de esas variables ni pantalla que las ajuste. |
| **C-06** | Alto | **Política de backups inventada**: "todas las noches a las 02:00 con `pg_dump`, cifrado AES-256 y réplica en dos zonas". No existe. Es, además, un riesgo real: nadie va a hacer la copia que el manual dice que ya se hace. |
| **C-07** | Alto | **"Modo de Contingencia Sanitaria" con comprobante provisorio.** Si SENASA no responde, el manual dice que ApiTrace emite un comprobante provisorio para que el camión salga. Eso no existe y no debe existir: sin DT-e no hay tránsito. |
| **C-08** | Medio | **"Registro criptográfico inalterable" / "libro inmutable" / "criptográficamente sellada"** (landing y dos manuales). El libro de auditoría es una tabla que la aplicación sólo agrega: no hay cadena de hashes ni firma. |
| **C-09** | Medio | **QR del frasco y "QR verificable por aduanas"** presentados como funciones actuales. No hay generación de QR en ninguna parte del código; es un objetivo del roadmap. |
| **C-10** | Medio | **"Citan la resolución legal de SENASA"** (landing) y ayudas con números y normas sin fuente verificable. En la corrección se quitaron las citas que no se pudieron respaldar y se conservaron las que sí (Ley 27.233, Cap. X del CAA, Ley 25.326, Ley 19.511, Directiva UE 2001/110/CE, Reglamento (CE) 178/2002). |
| **C-11** | Medio | **Funciones del módulo de configuración que no hacen nada**: "tolerancias de pesaje, alertas de vencimiento, frecuencia de sincronización de la PWA". |
| **C-12** | Bajo | **README y pantalla de ingreso con correos que no existen** (`@apitrace.test` contra el `@apitrace` que crea el seed); "manuales oficiales" cuando son manuales de usuario. |

---

## 5. Matriz del trámite API-SEM: qué pide SENASA, qué manda el código

Campo por campo, con el valor que hoy guardaría un DT-e nuevo (`dte.service.ts:320-345`):

| Campo del trámite | Valor requerido (especificación §4.1) | Valor de Antigravity | ¿Coincide? |
| :--- | :--- | :--- | :--- |
| Tipo de movimiento | `API-SEM` | `mov.movementType` → `MATERIAL_MELARIO` | ✗ |
| Motivo de tránsito | `Extracción de miel` | `'EXTRACCION'` | ✗ |
| Producto (código) | `24.45` | `mov.materialType` → `MATERIAL_MELARIO` | ✗ |
| Producto (nombre) | `Alzas melarias` | `'Alzas con miel'` | ✗ |
| Unidad de medida | `UNIDAD` | `mov.unit` → `ALZA` o `KG` | ✗ |
| Establecimiento origen | RENAPA del apiario (`B53999-2`) | `originEst.name` → *"Establecimiento Los Nogales"* | ✗ |
| Establecimiento destino | Código de sala (`SEF-B-20010`) | `destEst.senasaCode` | ✓ |
| Cantidad declarada | Entero, sobreestimado | Entero, sugerencia +15 % | ✓ (la especificación sugiere sobreestimar más) |
| Fecha de carga / vencimiento | `YYYY-MM-DD`, vigencia 2 a 4 días | Correcto en rango, guardado como instante (D-07) | ~ |
| Precintos | **No completar** | No se envía | ✓ |
| Transporte | Tipo de vehículo + patentes | `dto.transportType ?? 'PROPIO'` (eso es la propiedad del transporte) | ✗ |

Seis campos equivocados de ocho significativos. Ninguno es un error de programación: son
decisiones tomadas reutilizando el vocabulario interno de ApiTrace (`MATERIAL_MELARIO`,
`ALZA`, el nombre del predio) en lugar del vocabulario de SIGSA. Por eso la corrección no
es "arreglar un bug": es separar los dos vocabularios y traducir en el borde.

---

## 6. Qué falta para cerrar el MVP del DT-e

Checklist de lo que **no** está y hace falta, en orden de dependencia:

- [ ] **Migración de reparación** que lleve la base de `0001` al modelo correcto sin perder
      datos, sirviendo a los tres puntos de partida (migrador, `push`, base nueva).
      → `backend/drizzle/0002_dte_reparacion.sql` (incluida como referencia, probada).
- [ ] **Vocabulario del trámite** traducido en el borde (§5).
- [ ] **Anticipación (4 días), gracia (4 días), vigencia por defecto (2 días)** y **bloqueo
      del titular con DT-e caducado**.
- [ ] **Acceso por organización** en consulta por id, cierre, anulación y sin arribo.
- [ ] **Cierre real**: exigir el código del papel y la cantidad contada; quitar el cierre
      que inventa ambos.
- [ ] **Distinguir el simulador**: `issue_mode = SIMULADO`, sin PDF, visible en pantalla.
- [ ] **Autenticación**: quitar las contraseñas genéricas y la búsqueda difusa de cuenta.
- [ ] **Cuentas de demostración** desactivadas o con contraseña propia en la instancia con
      datos reales, y `VITE_DEMO_ACCESS` apagado allí.
- [ ] **Seed que termine** (hoy falla antes de extracción, lotes y tambores).
- [ ] **Contenido corregido** (§4.4) y PDF regenerados.
- [ ] **Contrato con SENASA**: lo que ApiTrace necesita pedirle está en
      `10-API-Integracion-SENASA-ApiTrace.md`, listo para la reunión.

Fuera del MVP, anotado como roadmap: QR de tambor y de frasco, consulta pública de
trazabilidad, copias de seguridad propias, y la homologación con SENASA cuando exista API.

---

## 7. Errata de la especificación (para corregir en el documento fuente)

Encontradas al implementar. Conviene corregirlas antes de compartir la especificación con
SENASA, porque son observables:

1. **§9, checklist WSAA:** dice offset UTC **−04:00**. La hora oficial argentina es
   **−03:00** desde 2009, sin horario de verano. El código usa −03:00.
2. **§8.1 (DDL) vs §5.1:** el DDL propone `estado` con un conjunto de valores que no
   incluye `SOLICITADO` ni `RECHAZADO`, que sí aparecen en el circuito real (solicitud
   asincrónica y rechazo del organismo).
3. **§8.1:** `fecha_carga` y `fecha_vencimiento` como `DATETIME`. Son días calendario: el
   trámite no tiene hora. Conviene `DATE`.
4. **§4.1 vs §6.1:** el código de cierre se define como `VARCHAR(20)` y el ejemplo es
   numérico de 6 dígitos (`790112`). Conviene decir explícitamente que el formato lo fija
   SENASA y que ApiTrace no lo valida más allá de la longitud.
5. **§8.2, Endpoint 1:** el ejemplo de `patente_acoplado` es `"NO"`. Un texto que significa
   "no tiene" guardado en un campo de patente termina, inevitablemente, impreso en un
   documento. Debe ser `null`.

---

## 8. Cómo se verificó la corrección propuesta

La implementación de referencia que acompaña este informe (`parches/` y
`referencia-dte.zip`) se probó así:

| Prueba | Resultado |
| :--- | :--- |
| `npm run build` backend y frontend | Sin errores |
| Pruebas unitarias backend (`npm test`) | 43 pasan |
| Pruebas e2e backend (`npm run test:e2e`, base limpia) | **68 pasan** (incluye 2 nuevas de autenticación) |
| Pruebas frontend (`npx vitest run`) | 21 pasan |
| Esquema resultante vs esquema de referencia | **Idéntico** en los tres puntos de partida (migrador, `push`, base nueva) |
| Escenario "Neon": datos de la línea base + `0001` + DT-e creados por la API de Antigravity (incluidos duplicados y simulados) + `0002` | Estados traducidos, duplicados sin valor oficial marcados `ELIMINADO` con historial, códigos y patentes inventados borrados, fechas convertidas a día calendario |
| Escenario "dos DT-e reales en el mismo movimiento" | La migración **se detiene** con el mensaje que indica qué consultar (`diagnostico-pre-0002.sql`, D6) y **revierte todo**; resuelto el duplicado, vuelve a correr y termina bien |
| Escenario "fecha imposible" (`31/02/2026` en una habilitación) | Se detiene nombrando el valor a corregir, en lugar de un error genérico de PostgreSQL |
| Backend corregido sobre la base reparada | Listados, detalle, resumen, preflight, borrador y emisión manual responden correctamente |
| `npm run db:seed` corregido | Termina: 3 movimientos, 3 DT-e, 1 extracción, 2 lotes, 2 tambores, 3 documentos |

---

## 9. Riesgos y dependencias

| Riesgo | Efecto | Mitigación |
| :--- | :--- | :--- |
| La base de Neon puede haberse creado con `push` y no tener historial de migraciones | El próximo despliegue falla al intentar aplicar `0000` de nuevo | `sql/registrar-migraciones-push.sql` (detecta y registra), previo diagnóstico D0a |
| Datos ya cargados con el modelo anterior | La migración podría detenerse | `sql/diagnostico-pre-0002.sql` se corre **antes** del despliegue; cada bloqueo trae su corrección |
| El acceso de demostración conviene mantenerlo (decisión del 19/09) | Cualquiera entra con rol completo | Se mantiene como decisión del despliegue (`VITE_DEMO_ACCESS=true`), pero con la puerta de S-01 cerrada y con la advertencia de no cargar datos reales en esa instancia |
| El contrato de SENASA no llega o difiere de lo previsto | El adaptador `sigsa` queda sin implementar | El puerto aísla el cambio: hoy `manual` funciona en producción sin tocar el dominio |
| Capturas de los manuales tomadas antes de estos cambios | Los PDF muestran pantallas que ya no son así | Regenerar capturas (`frontend/capturas.mjs`) y PDF (`npm run docs:pdf`) después de desplegar |

---

## 10. Dónde sigue esto

| Documento | Para qué |
| :--- | :--- |
| `10-API-Integracion-SENASA-ApiTrace.md` | Qué API necesita ApiTrace de SENASA, operación por operación, con el checklist de la reunión |
| `openapi-apitrace-senasa.yaml` | El mismo contrato en OpenAPI 3.1, para entregar como anexo técnico |
| `11-Plan-Correccion-DTE-Antigravity.md` + `tareas/` | El plan atómico: qué archivo, qué comando, qué salida esperada, qué no hacer |
| `sql/` | Diagnóstico previo, registro de migraciones para base creada con `push`, y desactivación de cuentas de demostración |
| `parches/` y `referencia-dte.zip` | La implementación de referencia ya probada, para aplicar o comparar |
