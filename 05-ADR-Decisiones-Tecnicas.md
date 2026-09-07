# Decisiones técnicas (ADR) — ApiTrace

**Versión:** 1.0
**Fecha:** 2026-08-25
**Tipo:** Registro de decisiones de arquitectura
**Relación con el documento 03:** este registro documenta dónde la implementación
se aparta de la arquitectura de referencia y por qué. Donde no hay ADR, se siguió
el documento 03 tal como está escrito.

---

## Índice

| ADR | Decisión | Se aparta del doc. 03 |
|---|---|---|
| [ADR-001](#adr-001--nestjs--typescript-en-lugar-de-java--spring-boot) | NestJS + TypeScript en lugar de Java + Spring Boot | Sí |
| [ADR-002](#adr-002--drizzle-orm-en-lugar-de-un-orm-con-motor-binario) | Drizzle ORM | No previsto |
| [ADR-003](#adr-003--jwt-propio-en-lugar-de-keycloak-para-el-mvp) | JWT propio en lugar de Keycloak | Sí, temporalmente |
| [ADR-004](#adr-004--outbox-transaccional-en-lugar-de-rabbitmq-para-el-mvp) | Outbox transaccional en lugar de RabbitMQ | Sí, temporalmente |
| [ADR-005](#adr-005--reglas-documentales-como-datos-versionados) | Reglas documentales como datos versionados | No, lo implementa |
| [ADR-006](#adr-006--ctes-recursivas-sobre-postgresql-en-lugar-de-un-motor-de-grafos) | CTE recursivas en lugar de motor de grafos | No, lo confirma |
| [ADR-007](#adr-007--sin-api-gateway-dedicado-en-el-mvp) | Sin API Gateway dedicado | Sí, previsto por el propio doc. 03 |
| [ADR-008](#adr-008--multi-tenancy-por-organización-en-la-capa-de-aplicación) | Multi-tenancy en la aplicación | No, lo implementa |
| [ADR-009](#adr-009--neon-en-lugar-de-la-base-postgresql-de-render) | Neon en lugar del PostgreSQL de Render | No previsto |
| [ADR-010](#adr-010--spa-con-vite-en-lugar-de-nextjs) | SPA con Vite en lugar de Next.js | Sí |
| [ADR-011](#adr-011--escrituras-offline-con-cola-e-idempotencia-de-cliente) | Escrituras offline con cola e idempotencia de cliente | No previsto |

---

## ADR-001 — NestJS + TypeScript en lugar de Java + Spring Boot

**Estado:** Aceptada · 2026-08-25

### Contexto

El documento de arquitectura recomienda **Java 21 + Spring Boot** por madurez
empresarial, transacciones, mensajería y disponibilidad de desarrolladores.
Es una recomendación sólida y sigue siendo válida para el destino final del
sistema. Sin embargo, se decidió desplegar el backend en **Render desde el
primer día**, y esa restricción cambia el balance para el MVP.

### Comparación en el entorno de despliegue elegido

| | NestJS + Node 22 | Spring Boot + Java 21 |
|---|---|---|
| Despliegue en Render | Runtime nativo, sin Dockerfile | Requiere Dockerfile |
| Tiempo de build | 1–2 min | 4–6 min |
| Arranque en frío | ~3 s | 20–40 s |
| Memoria en reposo | ~150 MB | ~400 MB |
| Plan free de Render (512 MB) | Holgado | Al límite |
| Tipado estático | TypeScript | Java |
| Transacciones y validación | Suficientes para el dominio | Superiores |

El plan free duerme el servicio tras 15 minutos sin tráfico. Con Spring Boot,
cada demostración empezaría con 30 segundos de espera; con Node, con 3.

### Decisión

NestJS + TypeScript para el MVP.

NestJS conserva lo que hacía atractivo a Spring Boot en este proyecto: módulos
con límites explícitos, inyección de dependencias, decoradores para transversales
(guards, interceptores, filtros) y una estructura que empuja a sacar la lógica de
los controladores. La arquitectura de monolito modular del documento 03 se
implementa igual, con los mismos límites de dominio: `producer`, `establishment`,
`apiary`, `movement`, `production`, `traceability`, `audit`, `identity`.

### Consecuencias

**A favor:** iteración más rápida, costo de infraestructura menor, un solo
lenguaje cuando llegue el frontend Next.js que el documento 03 recomienda.

**En contra:** menos rigor de tipos en runtime que la JVM; el ecosistema
empresarial de Java es más profundo en integraciones SOAP —relevante para ARCA,
que usa SOAP/XML—; si el equipo real es Java, esta decisión debe revisarse.

**Reversibilidad:** media. El modelo canónico, las migraciones SQL y el contrato
OpenAPI son independientes del lenguaje. Reescribir un módulo en Spring Boot y
ponerlo detrás del mismo contrato es viable; reescribir todo, costoso.

### Cuándo revisar

Si el equipo de desarrollo es mayoritariamente Java; si la integración con ARCA
resulta desproporcionadamente difícil en Node; o si el volumen exige garantías
transaccionales que Node no dé cómodamente.

---

## ADR-002 — Drizzle ORM en lugar de un ORM con motor binario

**Estado:** Aceptada · 2026-08-25

### Contexto

La primera implementación usó **Prisma**, la opción más habitual con NestJS. El
esquema completo llegó a estar escrito en Prisma. Al generar el cliente, tanto el
entorno de desarrollo como el de construcción fallaron: Prisma descarga su motor
de consultas desde `binaries.prisma.sh`, un host ajeno al registro de npm, y ese
host estaba bloqueado por la política de red de ambos entornos.

El síntoma fue de entorno, pero expuso una propiedad del diseño: **el ORM
introducía una dependencia de red en tiempo de instalación sobre un host que no
es el registro de paquetes**. Eso es una superficie de falla en CI, en imágenes
Docker y en cualquier red restringida, y este proyecto va a integrarse con
organismos públicos, donde las redes restringidas son la norma.

### Decisión

Drizzle ORM.

| Criterio | Drizzle | Prisma | TypeORM |
|---|---|---|---|
| Dependencias externas al instalar | Ninguna | Motor binario | Ninguna |
| Migraciones | SQL plano, legible y versionable | SQL generado | TypeScript |
| SQL crudo y CTE recursivas | De primera clase | `$queryRaw` | Posible |
| Peso en runtime | Bajo | Motor binario | Medio |
| Tipado | Inferido del esquema | Generado | Decoradores |

Para este sistema pesa especialmente el soporte de SQL crudo: el motor de
trazabilidad se apoya en CTE recursivas sobre `lot_input`, y en Prisma habrían
sido `$queryRaw` de todos modos, perdiendo el tipado que justifica el ORM.

Que las migraciones sean **SQL plano** también importa: el esquema de la base es
un artefacto documental del proyecto, revisable por alguien que no lea TypeScript.

### Consecuencias

**A favor:** instalación reproducible en cualquier red; migraciones auditables;
menos memoria; el SQL complejo es ciudadano de primera.

**En contra:** ecosistema más chico y menos ejemplos; sin equivalente a Prisma
Studio con la misma madurez; el equipo probablemente conozca mejor Prisma o
TypeORM.

**Mitigación:** el acceso a datos está encapsulado en los servicios de dominio.
Los controladores y las reglas de negocio no conocen el ORM.

---

## ADR-003 — JWT propio en lugar de Keycloak para el MVP

**Estado:** Aceptada · 2026-08-25 · **Temporal**

### Contexto

El documento 03 recomienda **Keycloak** por OIDC, OAuth 2.0, SSO, MFA y
federación de identidades. Es la elección correcta para una plataforma que
aspira a ser infraestructura nacional. Para el MVP implica un servicio Docker
adicional en Render, con su propia base de datos: aproximadamente 14 USD/mes y
un componente más que administrar antes de tener un solo usuario real.

### Decisión

Módulo `identity` dentro del monolito, con JWT de acceso y refresh token opaco
rotativo, **diseñado para ser reemplazado**:

- El `JwtStrategy` es el único punto que valida credenciales y produce el
  `AuthenticatedUser` que consume todo el dominio.
- Los servicios reciben `AuthenticatedUser`, no un token: cambiar el emisor no
  los toca.
- Los roles del documento 03 se implementan tal cual, de modo que mapean uno a
  uno a roles de Keycloak.
- La autorización contextual por organización vive en `AccessControlService`,
  fuera del proveedor de identidad. Keycloak tampoco resolvería eso: es lógica
  de dominio.

Lo implementado en seguridad: bcrypt con 12 rondas, refresh opaco guardado
hasheado con HMAC y rotado en cada uso, revalidación del usuario en cada request
—un token válido no habilita una cuenta suspendida—, y respuesta uniforme en
tiempo y contenido ante credenciales inválidas para no permitir enumerar usuarios.

### Consecuencias

**A favor:** cero infraestructura adicional; el control de identidades queda en
el proyecto; menos piezas que operar durante la validación.

**En contra:** sin MFA, sin SSO, sin federación; la gestión de sesiones es
responsabilidad del equipo; hay criptografía propia que auditar.

**Deuda técnica reconocida.** La migración a OIDC está en la iteración 5.

### Cuándo migrar

Ante el primer requisito de MFA, de SSO con un organismo, o cuando haya más de
una aplicación cliente que compartir sesión.

---

## ADR-004 — Outbox transaccional en lugar de RabbitMQ para el MVP

**Estado:** Aceptada · 2026-08-25 · **Temporal**

### Contexto

El documento 03 propone **RabbitMQ** para el MVP y Kafka a escala, con un event
bus que desacople trazabilidad, auditoría, notificaciones y adaptadores de
organismos. El desacople es correcto y necesario. El broker, en un MVP sin
integraciones externas vivas, agrega un servicio más a operar.

Hay además un problema que el broker por sí solo no resuelve: **escribir en la
base y publicar en el broker no son atómicos**. Si el movimiento se guarda y la
publicación falla, el evento se pierde y la trazabilidad queda incompleta.

### Decisión

Patrón **outbox transaccional**. Los servicios publican en `traceability_event`
y `outbox_event` dentro de la misma transacción que la escritura de negocio. Un
despachador entrega y marca el resultado.

```
Servicio de dominio
   └── BEGIN
        ├── INSERT movement
        ├── INSERT traceability_event   (historial consultable)
        └── INSERT outbox_event         (entrega asincrónica)
       COMMIT
                │
                ▼
        OutboxDispatcher  ── FOR UPDATE SKIP LOCKED ──▶ handlers
                                                        ├── auditoría
                                                        ├── notificaciones
                                                        └── adaptadores SENASA/ARCA/SIFeGA
```

`FOR UPDATE SKIP LOCKED` permite correr varias instancias del web service sin
entregas duplicadas, algo necesario apenas Render escale horizontalmente. Los
fallos reintentan con backoff exponencial acotado y terminan en `FAILED` tras
`OUTBOX_MAX_ATTEMPTS`.

### Consecuencias

**A favor:** atomicidad real entre escritura y publicación; ningún evento se
pierde; los servicios de dominio ya están desacoplados del transporte;
`traceability_event` da el historial consultable que pide CU-19.

**En contra:** el polling agrega latencia (5–10 s configurables); no hay fan-out
a consumidores externos; a gran volumen la tabla necesitará archivado.

**Camino de migración:** reemplazar el cuerpo de `OutboxDispatcher` por un
publicador a RabbitMQ. **Ningún servicio de dominio cambia** — y conviene
conservar el outbox incluso entonces, porque es lo que garantiza la atomicidad
que el broker no da.

---

## ADR-005 — Reglas documentales como datos versionados

**Estado:** Aceptada · 2026-08-25

### Contexto

El documento 03 advierte explícitamente contra hardcodear la normativa y propone
reglas con `effective_from` / `effective_to`. Este ADR registra cómo se
implementó, porque la decisión tiene una consecuencia que conviene dejar escrita.

El caso concreto: SENASA informó la obligatoriedad del DT-e para el traslado de
material apícola melario desde apiarios hacia salas de extracción a partir del
**1 de agosto de 2026**. Un traslado del 15 de julio de 2026 **no** la requería.

### Decisión

Tabla `movement_rule` con criterios de coincidencia, exigencia documental,
vigencia, prioridad y referencia legal. Los criterios en `NULL` actúan como
comodín; gana la regla de menor `priority` y, ante empate, la de vigencia más
reciente.

**La consecuencia que importa: la evaluación usa la fecha del movimiento, no la
fecha de carga.** Un traslado histórico cargado hoy se evalúa con la norma que
regía entonces. Sin esto, cargar datos retroactivos generaría exigencias
documentales falsas y la auditoría reportaría huecos inexistentes.

El movimiento guarda `applied_rule_id`: queda registrado qué regla se aplicó y
por qué, aunque después se modifique.

### Consecuencias

**A favor:** un cambio normativo es un `INSERT`, no un deploy; el historial
normativo queda auditable; la decisión aplicada a cada movimiento es rastreable.

**En contra:** una regla mal cargada tiene el mismo efecto que un bug, sin pasar
por revisión de código. Falta definir quién carga y aprueba las reglas: hoy
requiere rol ADMIN y queda auditado, pero no hay flujo de aprobación.

---

## ADR-006 — CTE recursivas sobre PostgreSQL en lugar de un motor de grafos

**Estado:** Aceptada · 2026-08-25

### Contexto

La trazabilidad es un grafo. El documento 03 lo reconoce y recomienda para el MVP
`PostgreSQL + CTE recursivas + índices + eventos`, dejando Neo4j para cuando
exista una necesidad real. Este ADR confirma esa recomendación tras
implementarla, porque el resultado no era obvio de antemano.

### Lo que la implementación mostró

El grafo tiene una sola arista de profundidad desconocida: `lot_input`, cuando un
lote se compone de otros lotes (acopio, mezcla, fraccionamiento). El resto de las
relaciones —lote a extracción, extracción a movimiento, movimiento a apiario,
apiario a establecimiento, establecimiento a RENSPA, RENSPA a productor— son de
profundidad **fija y conocida**.

Es decir: hace falta recursión en un solo punto, no en todo el recorrido. Dos CTE
recursivas —ascendencia y descendencia de lotes— más consultas indexadas para el
resto resuelven el problema completo. Cada CTE corta ciclos con un array `path` y
limita la profundidad a 20 niveles.

Introducir Neo4j habría significado un segundo almacén que mantener sincronizado
con PostgreSQL —y esa sincronización sí es un problema difícil— para resolver una
recursión que PostgreSQL resuelve en una consulta.

### Consecuencias

**A favor:** un solo almacén, una sola transacción, una sola copia de la verdad;
las CTE son SQL estándar, auditable y portable.

**En contra:** las consultas recursivas son menos legibles que Cypher; el
rendimiento debe medirse con volumen real; una cadena de lotes muy profunda
—improbable en apicultura— degradaría.

**Cuándo revisar:** si las consultas de trazabilidad superan el segundo con
volumen productivo. El primer paso entonces no es Neo4j sino separar OLTP de
consulta con OpenSearch, como propone el documento 03 en su sección 42.

---

## ADR-007 — Sin API Gateway dedicado en el MVP

**Estado:** Aceptada · 2026-08-25

### Contexto

El documento 03 propone Kong, Traefik o NGINX, y aclara que para el MVP puede
usarse una arquitectura más simple si el volumen no lo justifica.

### Decisión

Las responsabilidades del gateway se cubren en la aplicación: TLS lo termina
Render; autenticación y autorización en guards globales; rate limiting con
`@nestjs/throttler`; CORS configurable por entorno; versionado por prefijo
`/api/v1`; `correlation_id` propagado por middleware a eventos y auditoría;
cabeceras de seguridad con Helmet.

### Consecuencias

**A favor:** un componente menos; el rate limiting conoce al usuario autenticado,
no solo la IP.

**En contra:** el rate limiting es por instancia —con varias instancias el límite
efectivo se multiplica, y corregirlo requiere Redis—; no hay WAF; sin gateway no
hay punto único para políticas cuando existan varios servicios.

**Cuándo incorporarlo:** al extraer el primer servicio del monolito, o ante el
primer requisito de WAF o de políticas centralizadas.

---

## ADR-008 — Multi-tenancy por organización en la capa de aplicación

**Estado:** Aceptada · 2026-08-25

### Contexto

El documento 03 propone `tenant_id` en las entidades, advirtiendo que no debe
impedir relaciones entre organizaciones: un movimiento conecta el RENSPA de un
tenant con el de otro.

### Decisión

Entidad `organization` como tenant. Las entidades operativas llevan
`organization_id` y todo filtrado pasa por `AccessControlService`, con tres
reglas:

1. Los roles operativos ven solo su organización.
2. ADMIN y AUDITOR tienen alcance global; AUDITOR y CONSULTA no escriben.
3. **Un movimiento es visible desde ambos extremos.** Origen y destino son
   organizaciones distintas colaborando sobre el mismo evento: si solo lo viera
   una, la otra no podría recibirlo ni cerrar su DT-e.

La regla 3 es la que hace que este modelo no sea aislamiento estricto, y es
deliberada: la trazabilidad es intrínsecamente entre organizaciones.

Un caso derivado: la **custodia física** de un tambor puede estar en una
organización distinta de la dueña del lote. Transferir un tambor lo puede hacer
la dueña del lote, quien lo custodia o la organización de destino.

### Consecuencias

**A favor:** aislamiento con relaciones entre tenants; una sola base que operar;
la lógica de alcance está centralizada en un servicio con pruebas propias.

**En contra:** el aislamiento depende de la aplicación —un servicio que olvide
aplicar el filtro abre una fuga—; no hay separación física de datos, que algunos
organismos podrían exigir.

**Mitigación pendiente:** evaluar Row Level Security de PostgreSQL como segunda
barrera, de modo que el aislamiento no dependa solo del código de aplicación.

---

## ADR-009 — Neon en lugar de la base PostgreSQL de Render

**Estado:** Aceptada · 2026-08-25

### Contexto

El primer despliegue usaba la base PostgreSQL gestionada de Render, declarada en
el mismo blueprint. Tenía la ventaja de la simplicidad: un solo proveedor y la
cadena de conexión inyectada automáticamente.

El problema era de continuidad. **La base gratuita de Render expira a los 30
días**, sin posibilidad de prórroga. Para un proyecto en fase de validación —
donde el ciclo entre demostraciones puede ser de semanas — eso significa perder
los datos de prueba justo cuando se los necesita para mostrar el sistema.

### Decisión

Neon como PostgreSQL gestionado, declarado fuera del blueprint.

| | Neon | Render PostgreSQL |
|---|---|---|
| Plan gratuito | Sin expiración | **Expira a los 30 días** |
| Inactividad | Suspende el cómputo, despierta al primer query | Siempre encendida |
| Ramas de base de datos | Sí, útil para el entorno de tests | No |
| Integración con el blueprint | Manual (la cadena se carga a mano) | Automática |
| Versión | PostgreSQL 18.6 al momento de escribir | PostgreSQL 16 |

Lo que se pierde es conveniencia: la cadena de conexión ya no se inyecta sola.
Eso resultó **una ventaja de seguridad**: `DATABASE_URL` quedó declarada como
`sync: false` en el blueprint, de modo que la credencial se carga en el panel de
Render y **nunca vive en el repositorio**.

### Consecuencias operativas

Neon suspende el cómputo por inactividad, así que la primera consulta tras un
rato despierta la instancia y tarda segundos. Se ajustaron en consecuencia:

- `connectionTimeoutMillis` a 20 s cuando la URL apunta a `neon.tech`.
- `keepAlive` en el pool, para que una conexión cortada del lado del proveedor
  no quede en el pool haciendo fallar el siguiente request.
- Detección de TLS por `neon.tech`, `render.com` o `sslmode=` en la URL, en vez
  de una condición atada a un proveedor.
- Aviso por log si se usa el endpoint directo en lugar del agrupado.

**En contra:** un proveedor más que administrar; la latencia de arranque afecta
al primer usuario después de un período de inactividad; el plan gratuito tiene
límites de cómputo mensual que hay que vigilar.

---

## ADR-010 — SPA con Vite en lugar de Next.js

**Estado:** Aceptada · 2026-08-25

### Contexto

El documento 03 recomienda **React + TypeScript + Next.js** para la web y una
PWA para el uso móvil. Al definirse que el MVP incluye modo offline real, esas
dos recomendaciones entran en tensión.

El apicultor carga datos parado en un apiario, donde puede no haber cobertura.
Eso convierte al modo offline en el requisito que ordena las demás decisiones.

### El argumento decisivo

**El renderizado del lado del servidor no sirve estando offline.** Es la ventaja
principal de Next.js y, justamente en el escenario que el MVP debe resolver, no
está disponible: sin red no hay servidor que renderice.

Una SPA precacheada por el service worker arranca desde el dispositivo, sin
pedirle nada a ningún servidor. Para una aplicación que debe abrir en el campo,
eso no es una optimización: es el requisito.

| | Vite + React (SPA) | Next.js |
|---|---|---|
| Arranque sin red | Completo, desde el precaché | Requiere configuración adicional y el SSR queda inerte |
| Service worker | `vite-plugin-pwa` sobre Workbox, directo | Más piezas para que conviva con el enrutador |
| Despliegue en Render | Static site: gratis y **no duerme** | Web service: duerme en el plan gratuito |
| SEO | Ninguno | Su punto fuerte |
| Tiempo de build | ~3 s | Bastante mayor |

El static site tiene además una consecuencia práctica: **no duerme**. La API
gratuita de Render sí, pero la aplicación abre al instante y muestra los datos
locales mientras el backend despierta.

### Decisión

Vite + React + TypeScript para la aplicación operativa.

Cuando llegue el **portal público de trazabilidad por QR** (CU-20), que sí
necesita SEO y compartir enlaces, corresponde un Next.js aparte. Son dos
aplicaciones con propósitos distintos: forzar una sola que sirva a medias para
ambos casos sería la peor de las opciones.

### Consecuencias

**A favor:** offline real desde la primera visita; despliegue estático gratuito
y sin arranque en frío; build muy rápido; menos superficie de configuración.

**En contra:** sin SEO ni compartir con vista previa; la carga inicial trae toda
la aplicación (~84 KB comprimidos, aceptable); si el portal QR se vuelve
prioritario habrá dos frontends que mantener.

---

## ADR-011 — Escrituras offline con cola e idempotencia de cliente

**Estado:** Aceptada · 2026-08-25

### Contexto

Que la aplicación **lea** sin conexión es relativamente simple: se cachea y
listo. Que **escriba** sin conexión es donde aparece el problema difícil.

El escenario concreto: el apicultor registra un movimiento sin señal. La
operación tiene que guardarse y enviarse después. Pero al reenviar surge la
pregunta que define todo el diseño: **¿y si el envío original sí llegó al
servidor y solo se perdió la respuesta?** Reintentar crearía un segundo
movimiento, y dos movimientos por una sola cosecha rompen la trazabilidad de la
peor manera: sin que nadie se dé cuenta.

### Decisión

Cola de escrituras en IndexedDB, con **la clave de idempotencia generada en el
cliente al encolar** y reutilizada en cada reintento.

```
Sin red
   └── enqueue{ método, ruta, cuerpo, idempotencyKey: crypto.randomUUID() }
                                          │
Vuelve la señal                           │ la MISMA clave en cada reintento
   └── flushOutbox() ─── POST /movements ─┘
                          Idempotency-Key: <clave original>
                                   │
                     El backend la reconoce y devuelve
                     la respuesta original en vez de crear otro movimiento.
```

Esto funciona porque el backend ya implementaba idempotencia (ADR original,
arquitectura §38). La decisión del cliente es **generar la clave al encolar y no
al enviar**: si se generara al enviar, cada reintento traería una clave distinta
y la protección desaparecería justo cuando hace falta.

### Las tres reglas de la cola

1. **Orden de llegada.** Un lote puede depender de un movimiento encolado antes;
   alterar el orden rompería la cadena.
2. **Un corte de red detiene el recorrido.** Seguir con el resto solo quemaría
   intentos cuando el problema es la conexión y no el contenido de cada
   operación.
3. **Un 4xx no se reintenta.** Es un error de validación o de permisos: el mismo
   pedido volvería a fallar igual. Queda marcado para revisión manual en lugar
   de consumir reintentos en silencio.

El algoritmo se extrajo del proveedor de React a `src/lib/outbox.ts` para poder
probarlo aislado. Es la pieza de la que depende que nada registrado en el campo
se pierda, y tiene sus propios tests: orden de envío, corte de red a mitad de
cola, rechazo del servidor y reutilización de la clave.

### Lo que deliberadamente NO se implementó

**Resolución de conflictos de edición concurrente.** El modelo es de eventos
casi append-only: se registran movimientos, extracciones, lotes y tambores, y
casi no hay edición del mismo registro por dos personas a la vez. Agregar
detección de conflictos habría sido complejidad pagada por adelantado para un
problema que este dominio casi no tiene.

**Si eso cambia** —por ejemplo, si aparece la edición colaborativa de un lote—
hará falta versionado optimista con `updated_at` y una interfaz de resolución.
No está hoy, y conviene que quede escrito que fue una decisión y no un olvido.

### Consecuencias

**A favor:** nada de lo registrado en el campo se pierde; los duplicados son
imposibles por construcción, no por convención; la cola es visible e
inspeccionable por el usuario en `/pending`.

**En contra:** los datos locales pueden quedar viejos mientras la cola espera;
una operación rechazada requiere intervención manual; la sesión se guarda en
`localStorage` para sobrevivir a una recarga sin red, con el riesgo de XSS que
eso implica.

---

## Decisiones que siguieron el documento 03 sin cambios

| Recomendación | Implementación |
|---|---|
| Monolito modular con límites de dominio claros | Nueve módulos con servicios independientes |
| PostgreSQL como almacén principal | PostgreSQL 16 |
| REST + OpenAPI | Contrato completo navegable en `/docs` |
| Modelo canónico propio, organismos vía adaptadores | Ningún campo copiado de SENASA, ARCA o SIFeGA |
| UUID internos, identificadores oficiales separados | Con `external_system` y `sync_status` |
| Auditoría independiente de las tablas operativas | Tabla `audit_event`, escritura que nunca hace fallar el negocio |
| Idempotencia en comandos | Cabecera `Idempotency-Key` con hash del cuerpo |
| Estados de sincronización externa | En RENAPA, RENSPA y DT-e |
| Contingencia ante organismos caídos | La operación se guarda en `PENDING_SYNC`; nunca se pierde |
| Correlation ID por request | Middleware que propaga a eventos y auditoría |
| Docker y CI/CD | Dockerfile multi-stage y GitHub Actions con PostgreSQL real |
| Objetos grandes fuera de PostgreSQL | `document` guarda metadatos, `object_key` y `hash` |
| PWA como estrategia móvil inicial | Aplicación instalable con Workbox, en lugar de app nativa |
| React + TypeScript en el frontend | Con Vite en lugar de Next.js (ver ADR-010) |
