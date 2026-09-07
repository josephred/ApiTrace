# 06 — Guía de Pantallas y Funcionalidades — ApiTrace

> Catálogo visual y funcional de la aplicación web instalable (PWA) de ApiTrace.
> Documenta **cada pantalla, cada acción y cada estado** de la interfaz, con capturas
> reales tomadas sobre la aplicación en ejecución con la base de datos de demostración.

| Campo | Valor |
|---|---|
| Documento | 06 — Guía de Pantallas y Funcionalidades |
| Versión | 1.0 |
| Fecha | 30 de agosto de 2026 |
| Estado | Vigente para el MVP descrito en `04-MVP-ApiTrace.md` |
| Alcance | Frontend `apitrace-web` (React 19 + Vite 6, PWA) sobre `apitrace-backend` (NestJS 11) |
| Documentos relacionados | `00-Documento_de_Vision`, `01-Mapa_del_Dominio`, `02-Casos_de_Uso`, `03-ArquitecturaTecnica`, `04-MVP-ApiTrace`, `05-ADR-Decisiones-Tecnicas` |

---

## Índice

1. [Propósito del documento](#1-propósito-del-documento)
2. [Cómo se generaron las capturas](#2-cómo-se-generaron-las-capturas)
3. [Mapa de navegación](#3-mapa-de-navegación)
4. [Convenciones de la interfaz](#4-convenciones-de-la-interfaz)
5. [Matriz de pantallas por rol](#5-matriz-de-pantallas-por-rol)
6. [Catálogo de pantallas](#6-catálogo-de-pantallas)
   - [6.1 Iniciar sesión](#61-iniciar-sesión--login)
   - [6.2 Panel](#62-panel--)
   - [6.3 Productores](#63-productores--producers)
   - [6.4 Establecimientos](#64-establecimientos--establishments)
   - [6.5 Apiarios](#65-apiarios--apiaries)
   - [6.6 Movimientos](#66-movimientos--movements)
   - [6.7 Detalle de movimiento](#67-detalle-de-movimiento--movementsid)
   - [6.8 Extracciones](#68-extracciones--extractions)
   - [6.9 Lotes](#69-lotes--lots)
   - [6.10 Detalle de lote](#610-detalle-de-lote--lotsid)
   - [6.11 Tambores](#611-tambores--drums)
   - [6.12 Trazabilidad](#612-trazabilidad--trace)
   - [6.13 Reglas documentales](#613-reglas-documentales--rules)
   - [6.14 Auditoría](#614-auditoría--audit)
   - [6.15 Pendientes de sincronizar](#615-pendientes-de-sincronizar--pending)
7. [Modo offline y sincronización](#7-modo-offline-y-sincronización)
8. [Comportamiento en móvil y PWA](#8-comportamiento-en-móvil-y-pwa)
9. [Flujo completo del circuito](#9-flujo-completo-del-circuito)
10. [Hallazgos, inconsistencias y mejoras propuestas](#10-hallazgos-inconsistencias-y-mejoras-propuestas)
11. [Dependencias técnicas y riesgos](#11-dependencias-técnicas-y-riesgos)
12. [Inventario de capturas](#12-inventario-de-capturas)

---

## 1. Propósito del documento

Los documentos 00 a 05 definen **qué** hace ApiTrace y **cómo está construido**. Este documento
cierra el circuito documental mostrando **cómo se ve y cómo se usa**: sirve como

- **manual de referencia** para quien opera el sistema (productor, sala, acopio, auditor);
- **especificación viva de la interfaz** para quien la desarrolla o la extiende;
- **material de demostración** ante SENASA, cámaras apícolas, compradores o inversores;
- **base de comparación** para detectar regresiones visuales entre versiones.

Cada pantalla se documenta con la misma estructura: ruta, propósito, roles habilitados,
elementos visibles, acciones disponibles, reglas de negocio que la gobiernan y los estados
alternativos (vacío, error, sin conexión).

---

## 2. Cómo se generaron las capturas

Las capturas **no son maquetas**: se tomaron ejecutando la aplicación real contra la API real
y una base PostgreSQL con el `seed` de demostración del repositorio, ampliado con datos que
permiten mostrar todos los estados del circuito.

| Elemento | Configuración |
|---|---|
| Frontend | `vite preview` sobre el build de producción (con service worker real) |
| Backend | `nest start` con la API en `/api/v1` |
| Base de datos | PostgreSQL 16 local, migraciones Drizzle + `db:seed` |
| Automatización | Playwright sobre Chromium, script determinista |
| Viewport escritorio | 1440 × 900 px |
| Viewport móvil | 390 × 844 px, `deviceScaleFactor` 2, user-agent Android |
| Idioma / zona | `es-AR`, `America/Argentina/Buenos_Aires` |
| Total de capturas | 88 (60 escritorio + 28 móvil) |

### Usuarios de demostración

Todos comparten la contraseña definida en `SEED_PASSWORD` (`ApiTrace2026!` por defecto).

| Correo | Rol | Organización | Puede escribir |
|---|---|---|---|
| `admin@apitrace.test` | ADMIN | — (sin organización) | Sí (ver hallazgo H-01) |
| `productor@apitrace.test` | PRODUCTOR | Apiarios del Sur | Sí |
| `sala@apitrace.test` | SALA | Sala San Andrés | Sí |
| `acopio@apitrace.test` | ACOPIADOR | Acopio Pampa | Sí |
| `auditor@apitrace.test` | AUDITOR | — | **No** (solo lectura) |
| `laboratorio@apitrace.test` | LABORATORIO | Laboratorio Mielab | Sí |

### Cadena de demostración

```
Maria Gonzalez (productor) → Predio Los Talas → API-001/002/003
   → MOV-2026-000001 (DT-e cerrado, recepción con diferencia)
      → EXT-2026-000001 → LOTE-2026-000001 → TAM-…001 / TAM-…002
         → MOV-2026-000002 → LOTE-2026-000002 (acopio)
Además: MOV-…003 borrador que exige DT-e, MOV-…004 despachado en tránsito,
MOV-…006 cancelado, LOTE-2026-000003 sin entradas declaradas (hueco de trazabilidad).
```

---

## 3. Mapa de navegación

```mermaid
flowchart TD
    L["/login<br/>Iniciar sesión"] -->|autenticado| P["/<br/>Panel"]

    subgraph TRZ["Trazabilidad"]
        P
        T["/trace<br/>Consultar trazabilidad"]
    end

    subgraph REG["Registros"]
        PR["/producers<br/>Productores"]
        ES["/establishments<br/>Establecimientos"]
        AP["/apiaries<br/>Apiarios"]
    end

    subgraph OPE["Operación"]
        MV["/movements<br/>Movimientos"]
        MVD["/movements/:id<br/>Detalle"]
        EX["/extractions<br/>Extracciones"]
        LO["/lots<br/>Lotes"]
        LOD["/lots/:id<br/>Detalle"]
        DR["/drums<br/>Tambores"]
    end

    subgraph CTL["Control"]
        RU["/rules<br/>Reglas documentales"]
        AU["/audit<br/>Auditoría"]
    end

    subgraph SYN["Sincronización"]
        PE["/pending<br/>Pendientes"]
    end

    P --> T & PR & ES & AP & MV & EX & LO & DR & RU & AU & PE
    MV --> MVD
    LO --> LOD
    MVD --> T
    LOD --> T
    AP --> T
    ES --> T
    DR --> T
```

El menú lateral agrupa las rutas en cinco secciones (**Trazabilidad, Registros, Operación,
Control, Sincronización**). El ítem *Pendientes* muestra un contador cuando hay operaciones
en cola, en tono ámbar si esperan envío y rojo si el servidor rechazó alguna.

---

## 4. Convenciones de la interfaz

### 4.1 Anatomía de la pantalla

| Zona | Contenido |
|---|---|
| Barra lateral | Marca, navegación agrupada, usuario y última sincronización |
| Barra superior | Menú hamburguesa (móvil), botón *Instalar aplicación*, indicador En línea/Offline, botón *Sincronizar*, *Salir* |
| Franja de estado | Aparece sobre la barra superior sólo cuando falta conexión o hay sincronización en curso |
| Encabezado de página | Título, texto explicativo del concepto de dominio y acción primaria |
| Cuerpo | Avisos (`Notice`), barra de filtros, tarjetas y tablas |

### 4.2 Colores de estado (`StatusBadge`)

| Tono | Estados |
|---|---|
| Verde (ok) | `ACTIVE`, `RECEIVED`, `CLOSED`, `APPROVED`, `COMPLETED`, `SYNCHRONIZED`, `ACCEPTED` |
| Ámbar (warn) | `DRAFT`, `PENDING`, `PENDING_VERIFICATION`, `PENDING_SYNC`, `PARTIALLY_RECEIVED`, `PARTIAL`, `IN_TRANSIT` |
| Rojo (danger) | `REJECTED`, `CANCELLED`, `BLOCKED`, `ERROR`, `FAILED` |
| Azul (info) | `DISPATCHED`, `ISSUED`, `OPEN`, `FILLED`, `IN_STOCK` |
| Gris (neutral) | Cualquier otro valor |

### 4.3 Tipos de aviso (`Notice`)

| Tono | Uso típico |
|---|---|
| Info (azul) | Explica una regla antes de actuar: evaluación normativa por fecha, falta de integración con SIGSA |
| Ok (verde) | Confirmación de una operación (`flash`) |
| Warn (ámbar) | Datos servidos desde caché local, lote sin entradas, documento exigido y faltante |
| Danger (rojo) | Error del servidor, operación rechazada, permisos insuficientes |

### 4.4 Patrón de formulario

Todas las altas y transiciones usan el mismo componente modal: título, aviso contextual
opcional, campos en dos columnas (los marcados con `*` son obligatorios), texto de ayuda bajo
el campo cuando la regla no es evidente, y pie con *Cancelar* / acción primaria. El error del
servidor se muestra **dentro del modal**, sin perder lo cargado.

---

## 5. Matriz de pantallas por rol

`canWrite` es verdadero para todos los roles excepto `AUDITOR` y `CONSULTA`; el rol `ADMIN`
además satisface cualquier verificación de rol específico.

| Pantalla | ADMIN | PRODUCTOR | SALA | ACOPIADOR | AUDITOR | LABORATORIO |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| Panel | ✔ | ✔ | ✔ | ✔ | ✔ (lectura) | ✔ |
| Trazabilidad | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Productores | ✔ | ✔ | ✔ | ✔ | Solo lectura | ✔ |
| Establecimientos | ✔ | ✔ | ✔ | ✔ | Solo lectura | ✔ |
| Apiarios | ✔ | ✔ | ✔ | ✔ | Solo lectura | ✔ |
| Movimientos | ✔ | ✔ | ✔ | ✔ | Solo lectura | ✔ |
| Extracciones | ✔ | ✔ | ✔ | ✔ | Solo lectura | ✔ |
| Lotes / Tambores | ✔ | ✔ | ✔ | ✔ | Solo lectura | ✔ |
| Reglas documentales | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| **Auditoría** | ✔ | ✖ (403) | ✖ | ✖ | ✔ | ✖ |
| Pendientes | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |

> El alcance de **datos** es adicional al de pantallas: cada usuario ve solamente las
> entidades de su organización. `ADMIN` y `AUDITOR` no tienen organización asignada y ven
> el conjunto completo.

---

## 6. Catálogo de pantallas

### 6.1 Iniciar sesión — `/login`

**Propósito.** Única pantalla accesible sin sesión. Obtiene el par de tokens JWT
(`accessToken` / `refreshToken`) contra `POST /api/v1/auth/login`.

**Regla clave.** Iniciar sesión **por primera vez exige conexión**; una vez iniciada, la
aplicación funciona sin señal. La pantalla distingue explícitamente el error de red
("Sin conexión con el servidor…") del error de credenciales.

| Elemento | Detalle |
|---|---|
| Correo electrónico | `type=email`, obligatorio, `autocomplete=username` |
| Contraseña | `type=password`, obligatoria, `autocomplete=current-password` |
| Entrar | Envía el formulario; muestra spinner mientras dura la llamada |
| Acceso rápido (modo dev) | Seis botones que autentican directamente cada rol de demostración |
| Pie | Recordatorio de que la app funciona sin conexión una vez autenticado |

![Iniciar sesión](docs/capturas/escritorio/01-acceso-login.png)

**Error de credenciales.** El mensaje del servidor se muestra en un aviso rojo sobre el
formulario, conservando el correo cargado.

![Credenciales inválidas](docs/capturas/escritorio/02-acceso-login-error.png)

**En móvil.** El mismo formulario ocupa el ancho completo; los seis accesos rápidos quedan en
dos columnas.

| Acceso (móvil) | Error (móvil) |
|---|---|
| ![Login móvil](docs/capturas/movil/01-acceso-login.png) | ![Error móvil](docs/capturas/movil/02-acceso-login-error.png) |

> **Riesgo de seguridad.** El bloque *Acceso rápido (modo dev)* expone usuarios y contraseña
> de demostración en la propia pantalla. Debe condicionarse a `import.meta.env.DEV` o a una
> variable de entorno antes de cualquier despliegue productivo (hallazgo **H-07**).

---

### 6.2 Panel — `/`

**Propósito.** Estado de la operación en una pantalla: cuatro indicadores, los últimos cinco
movimientos y los últimos cinco lotes, más el acceso directo a la consulta de trazabilidad.

| Indicador | Fuente | Significado |
|---|---|---|
| Movimientos | `GET /movements?pageSize=5` → `meta.total` | Traslados registrados en el ámbito del usuario |
| Lotes | `GET /lots?pageSize=5` → `meta.total` | Unidades lógicas de trazabilidad |
| Apiarios | `GET /apiaries?pageSize=1` → `meta.total` | Unidades productivas |
| Pendientes de enviar | Cola local (IndexedDB) | Operaciones sin sincronizar |

**Avisos condicionales.** Si los datos vienen de caché aparece un aviso ámbar con la antigüedad;
si hay operaciones rechazadas, un aviso rojo con enlace a `/pending`.

![Panel — ADMIN](docs/capturas/escritorio/10-panel-admin.png)

**El panel cambia con el rol**, porque el alcance de datos es por organización:

| Rol | Captura | Lectura |
|---|---|---|
| PRODUCTOR | ![Panel productor](docs/capturas/escritorio/12-panel-rol-productor.png) | Ve sus 4 movimientos y su predio |
| SALA | ![Panel sala](docs/capturas/escritorio/13-panel-rol-sala.png) | Ve lo que entra y sale de la sala de extracción |
| ACOPIADOR | ![Panel acopiador](docs/capturas/escritorio/14-panel-rol-acopiador.png) | Ve el acopio y sus lotes |
| AUDITOR | ![Panel auditor](docs/capturas/escritorio/15-panel-rol-auditor.png) | Ve todo, sin botones de alta |
| LABORATORIO | ![Panel laboratorio](docs/capturas/escritorio/16-panel-rol-laboratorio.png) | Sin datos propios: los contadores quedan en 0 (hallazgo **H-08**) |

**Estado vacío.** Cuando no hay movimientos ni lotes, las tarjetas muestran una explicación del
concepto y la acción para crear el primero, en lugar de una tabla vacía (visible en el panel del
rol LABORATORIO).

**En móvil.** Los indicadores se apilan de a dos y las tablas se recortan a las columnas
esenciales.

![Panel móvil](docs/capturas/movil/10-panel-admin.png)

---

### 6.3 Productores — `/producers`

**Propósito.** Registrar al **actor responsable de la actividad**. El RENAPA se administra como
entidad separada: un productor puede existir sin RENAPA vigente, y esa distinción es la que
permite que la trazabilidad informe el faltante en lugar de bloquear la carga.

| Columna | Contenido |
|---|---|
| Nombre | Razón social o nombre de la persona |
| Tipo | Física / Jurídica |
| CUIT | Identificador fiscal externo (no es la clave interna) |
| Ubicación | Localidad, provincia |
| Estado | `ACTIVE`, `SUSPENDED`, … |
| Acciones | *Asociar RENAPA* (sólo con permiso de escritura) |

**Filtro.** Búsqueda por nombre o CUIT (`?q=`), con spinner mientras responde la API.

![Productores](docs/capturas/escritorio/20-productores-listado.png)

**Alta de productor.** Modal con siete campos; sólo *Nombre o razón social* es obligatorio.
Los campos vacíos no se envían.

![Nuevo productor](docs/capturas/escritorio/21-productores-alta-formulario.png)

**Asociar RENAPA.** Modal separado que avisa, antes de cargar, que sin integración con SENASA
el registro queda en estado **pendiente de sincronización** y así lo reporta el motor de
trazabilidad.

![Asociar RENAPA](docs/capturas/escritorio/22-productores-asociar-renapa.png)

**Búsqueda sin resultados.** Estado vacío explicativo, no una tabla en blanco.

![Sin resultados](docs/capturas/escritorio/23-productores-busqueda-sin-resultados.png)

**Vista de solo lectura (AUDITOR).** Desaparecen *Nuevo productor* y *Asociar RENAPA*; la tabla
y los filtros se mantienen.

![Productores — auditor](docs/capturas/escritorio/24-productores-solo-lectura-auditor.png)

| Listado (móvil) | Alta (móvil) |
|---|---|
| ![Productores móvil](docs/capturas/movil/20-productores-listado.png) | ![Alta móvil](docs/capturas/movil/21-productores-alta-formulario.png) |

---

### 6.4 Establecimientos — `/establishments`

**Propósito.** Registrar la **unidad territorial**. El RENSPA identifica al predio junto con su
titular y no debe confundirse con el apiario, que es una unidad productiva dentro del
establecimiento.

**Tipos disponibles:** predio apícola (`APIARIO_BASE`), sala de extracción, acopio,
fraccionadora, depósito, laboratorio, otro.

| Columna | Contenido |
|---|---|
| Nombre / Tipo / Ubicación | Identificación del predio |
| RNE | Registro Nacional de Establecimiento (SIFeGA) |
| Estado | Estado del registro |
| Acciones | *Trazabilidad* (hacia adelante desde el establecimiento) y *Asociar RENSPA* |

![Establecimientos](docs/capturas/escritorio/30-establecimientos-listado.png)

**Alta de establecimiento.** Nueve campos; el productor responsable es **opcional** porque una
sala o un acopio pueden no tener productor asociado. Latitud y longitud se envían como número.

![Nuevo establecimiento](docs/capturas/escritorio/31-establecimientos-alta-formulario.png)

**Asociar RENSPA.** Exige número y titular; el texto de ayuda aclara que *el RENSPA identifica
al titular del predio, que puede no ser el apicultor*.

![Asociar RENSPA](docs/capturas/escritorio/32-establecimientos-asociar-renspa.png)

**Filtro por tipo.** Reduce el listado al tipo elegido (`?type=`).

![Filtro por tipo](docs/capturas/escritorio/33-establecimientos-filtro-por-tipo.png)

![Establecimientos móvil](docs/capturas/movil/30-establecimientos-listado.png)

---

### 6.5 Apiarios — `/apiaries`

**Propósito.** El apiario es la **unidad productiva** donde están las colmenas y el punto de
partida real de la trazabilidad hacia adelante. Pertenece siempre a un establecimiento de tipo
predio apícola.

| Columna | Contenido |
|---|---|
| Código | Identificador operativo (`API-001`) |
| Nombre / Establecimiento | Denominación y predio contenedor |
| Colmenas | Cantidad registrada |
| Coordenadas | Latitud y longitud con cuatro decimales |
| Acciones | *Colmenas* (alta y listado) y *¿Dónde terminó?* (trazabilidad hacia adelante) |

![Apiarios](docs/capturas/escritorio/40-apiarios-listado.png)

**Alta de apiario.** Incluye el botón **«Usar mi ubicación actual»**, que toma la posición del
dispositivo con `navigator.geolocation` (alta precisión, 10 s de tiempo límite): es lo natural
estando parado en el apiario.

![Nuevo apiario](docs/capturas/escritorio/41-apiarios-alta-formulario.png)

**Colmenas.** Modal con alta rápida (código y tipo) y listado de las colmenas del apiario. Sin
conexión, las altas se acumulan y el modal informa cuántas quedaron en cola.

![Colmenas](docs/capturas/escritorio/42-apiarios-colmenas.png)

| Listado (móvil) | Alta con geolocalización (móvil) |
|---|---|
| ![Apiarios móvil](docs/capturas/movil/40-apiarios-listado.png) | ![Alta apiario móvil](docs/capturas/movil/41-apiarios-alta-formulario.png) |

---

### 6.6 Movimientos — `/movements`

**Propósito.** El movimiento es el **evento de dominio** que conecta un origen con un destino.
El DT-e es un documento asociado al movimiento, no el movimiento en sí — la distinción es
deliberada y estructura todo el modelo.

| Columna | Contenido |
|---|---|
| Código | `MOV-2026-000001`, enlace al detalle |
| Material | Tipo de material trasladado |
| Cantidad | Valor y unidad |
| Programado | Fecha del traslado |
| Documento | *Exige DTE / REMITO* o *No exigido*, según la regla aplicada |
| Estado | `DRAFT`, `DISPATCHED`, `IN_TRANSIT`, `RECEIVED`, `PARTIALLY_RECEIVED`, `REJECTED`, `CANCELLED` |

![Movimientos](docs/capturas/escritorio/50-movimientos-listado.png)

**Alta de movimiento.** Doce campos. El aviso azul explica la regla central: *el sistema evalúa
la normativa vigente **a la fecha del traslado**, no a la de carga*.

| Campo | Notas |
|---|---|
| Tipo de movimiento | Material melario, miel a granel, producto fraccionado, material vivo, material inerte, otro |
| Material | Material melario, miel, cera, polen, propóleo, jalea real, núcleo, colmena, otro |
| Establecimiento de origen / destino | Obligatorios |
| Apiario de origen | Opcional, pero **es lo que permite responder de qué apiario vino la miel** |
| Fecha del traslado | Determina qué regla documental se aplica |
| Cantidad y unidad | KG, LITRO, ALZA, TAMBOR, COLMENA, UNIDAD |
| Conductor y documento | Datos del transporte |
| Observaciones | Texto libre |

![Nuevo movimiento](docs/capturas/escritorio/51-movimientos-alta-formulario.png)

**Errores de validación del servidor.** Se muestran dentro del modal, en rojo, sin perder lo
cargado. El ejemplo corresponde a una recepción con diferencia de cantidad y sin motivo.

![Error de validación](docs/capturas/escritorio/52-movimientos-error-de-validacion.png)

**Filtro por estado.**

![Filtro por estado](docs/capturas/escritorio/53-movimientos-filtro-por-estado.png)

| Listado (móvil) | Alta (móvil) |
|---|---|
| ![Movimientos móvil](docs/capturas/movil/50-movimientos-listado.png) | ![Alta movimiento móvil](docs/capturas/movil/51-movimientos-alta-formulario.png) |

---

### 6.7 Detalle de movimiento — `/movements/:id`

**Propósito.** Concentra el ciclo de vida completo de un traslado: datos, documento sanitario,
recepción e historial de eventos.

```mermaid
stateDiagram-v2
    [*] --> DRAFT: crear movimiento
    DRAFT --> DISPATCHED: despachar<br/>(requiere DT-e si la regla lo exige)
    DISPATCHED --> IN_TRANSIT
    DISPATCHED --> RECEIVED: recepción sin diferencia
    IN_TRANSIT --> RECEIVED
    DISPATCHED --> PARTIALLY_RECEIVED: recepción con diferencia<br/>+ motivo obligatorio
    IN_TRANSIT --> PARTIALLY_RECEIVED
    RECEIVED --> [*]: cierre del DT-e por el receptor
    PARTIALLY_RECEIVED --> [*]
    DRAFT --> CANCELLED: cancelar con motivo
    DISPATCHED --> CANCELLED
```

**Acciones según estado** (visibles sólo con permiso de escritura):

| Acción | Condición |
|---|---|
| Registrar DT-e | El movimiento aún no tiene documento |
| Despachar | Estado `DRAFT` |
| Registrar recepción | Estado `DISPATCHED` o `IN_TRANSIT` |
| Cerrar DT-e | DT-e `ISSUED`/`APPROVED` y movimiento `RECEIVED`/`PARTIALLY_RECEIVED` |
| Cancelar | Estado `DRAFT` o `DISPATCHED`, con motivo obligatorio |

**Borrador que exige documento.** Aviso ámbar: *requiere DTE y todavía no lo tiene. No podrá
despacharse hasta registrarlo.*

![Detalle borrador](docs/capturas/escritorio/54-movimiento-detalle-borrador.png)

**Registrar DT-e.** Si se omite el número, el documento queda en borrador hasta que SIGSA
asigne uno. El aviso deja constancia de que, sin integración, el DT-e queda pendiente de
sincronizar.

![Registrar DT-e](docs/capturas/escritorio/55-movimiento-registrar-dte.png)

**Despachar.**

![Despachar](docs/capturas/escritorio/56-movimiento-despachar.png)

**Registrar recepción.** El aviso recuerda la cantidad declarada en origen; si la recibida
difiere, el motivo pasa a ser obligatorio y el movimiento queda `PARTIALLY_RECEIVED` con la
marca *con diferencia*.

![Registrar recepción](docs/capturas/escritorio/57-movimiento-registrar-recepcion.png)

**Movimiento recibido con DT-e.** Muestra las dos tarjetas (movimiento y documento sanitario),
el bloque de recepción con la diferencia registrada y el historial de eventos de dominio.

![Detalle recibido](docs/capturas/escritorio/58-movimiento-detalle-recibido-con-dte.png)

**Cancelar** y **movimiento cancelado**:

| Cancelar | Resultado |
|---|---|
| ![Cancelar](docs/capturas/escritorio/59-movimiento-cancelar.png) | ![Cancelado](docs/capturas/escritorio/60-movimiento-detalle-cancelado.png) |

| Borrador (móvil) | Recibido (móvil) |
|---|---|
| ![Detalle borrador móvil](docs/capturas/movil/54-movimiento-detalle-borrador.png) | ![Detalle recibido móvil](docs/capturas/movil/58-movimiento-detalle-recibido-con-dte.png) |

---

### 6.8 Extracciones — `/extractions`

**Propósito.** La extracción **consume** los movimientos ya recibidos en la sala y los convierte
en miel loteada. Regla estructural: *un movimiento no puede alimentar dos extracciones
distintas* — el backend sólo ofrece los movimientos recibidos y no consumidos
(`GET /lots/available-inputs/:establishmentId`).

| Columna | Contenido |
|---|---|
| Código | `EXT-2026-000001` |
| Inicio | Fecha y hora de comienzo |
| Ingresado / Obtenido | Cantidades de entrada y de salida |
| Rendimiento | Porcentaje calculado en la interfaz (`obtenido / ingresado`) |
| Estado | `IN_PROGRESS`, `COMPLETED`, … |

![Extracciones](docs/capturas/escritorio/61-extracciones-listado.png)

**Nueva extracción.** Se elige la sala, se marcan con casilla los movimientos a procesar (el pie
suma los kilos seleccionados) y se cargan inicio, fin, miel obtenida y operario. La miel obtenida
**no puede superar lo ingresado**. Si la sala no tiene movimientos disponibles, el formulario lo
dice explícitamente en lugar de mostrar una lista vacía.

![Nueva extracción](docs/capturas/escritorio/62-extracciones-alta-formulario.png)

| Listado (móvil) | Alta (móvil) |
|---|---|
| ![Extracciones móvil](docs/capturas/movil/61-extracciones-listado.png) | ![Alta extracción móvil](docs/capturas/movil/62-extracciones-alta-formulario.png) |

---

### 6.9 Lotes — `/lots`

**Propósito.** El lote es la **unidad lógica de trazabilidad**: sus entradas definen de qué se
compone y son la arista que permite reconstruir el origen.

| Columna | Contenido |
|---|---|
| Código | `LOTE-2026-000001`, enlace al detalle |
| Tipo | De extracción, de acopio, de mezcla, de fraccionamiento |
| Producción | Fecha |
| Cantidad / Disponible | Total y remanente no consumido por otros lotes |
| Estado | `OPEN`, `CLOSED`, `BLOCKED`, `DISPATCHED`, `CONSUMED` |
| Acciones | *¿De dónde vino?* (trazabilidad hacia atrás) |

![Lotes](docs/capturas/escritorio/70-lotes-listado.png)

**Nuevo lote.** El aviso es explícito: *un lote sin origen declarado queda sin trazabilidad
hacia atrás, y el sistema lo reporta como hueco*. El origen puede ser **una extracción** (la
arista se agrega sola) **o otro lote**, en cuyo caso se indica cuánto se consume y se descuenta
de su disponibilidad. Ambos orígenes son mutuamente excluyentes en el formulario.

![Nuevo lote](docs/capturas/escritorio/71-lotes-alta-formulario.png)

![Lotes móvil](docs/capturas/movil/70-lotes-listado.png)

---

### 6.10 Detalle de lote — `/lots/:id`

**Propósito.** Composición, envasado y análisis de un lote, con acceso directo a la
trazabilidad en ambos sentidos.

| Indicador | Significado |
|---|---|
| Cantidad | Total del lote |
| Disponible | Lo no consumido por otros lotes |
| Tambores | Cantidad, peso neto envasado y **porcentaje del lote cubierto** |
| Humedad | Porcentaje declarado |

**Bloques.** *Composición* (entradas: movimiento, lote previo, extracción o carga manual, con
enlace a cada origen), *Tambores* (código, neto, precinto, estado) e *Historial* de eventos.

![Detalle de lote](docs/capturas/escritorio/72-lote-detalle.png)

**Registrar tambor.** El aviso informa cuántos kilos del lote quedan sin envasar; si están
cargados el bruto y la tara, el neto debe coincidir con su diferencia. El código se genera
automáticamente si se omite.

![Registrar tambor](docs/capturas/escritorio/73-lote-registrar-tambor.png)

**Registrar muestra.** Fecha de toma, responsable, análisis solicitado y observaciones
(`POST /samples`).

![Registrar muestra](docs/capturas/escritorio/74-lote-registrar-muestra.png)

**Lote sin entradas declaradas.** Aviso ámbar permanente: *su origen no puede reconstruirse; la
consulta de trazabilidad lo reportará como hueco*. Es el caso que el sistema **no oculta**.

![Lote sin origen](docs/capturas/escritorio/75-lote-detalle-sin-origen-declarado.png)

![Detalle de lote móvil](docs/capturas/movil/72-lote-detalle.png)

---

### 6.11 Tambores — `/drums`

**Propósito.** El tambor es la **unidad física** asociada a un lote. Cambiar su ubicación deja
rastro en el historial de inventario, de modo que la trazabilidad no se pierde al moverlo.

| Columna | Contenido |
|---|---|
| Código / Neto / Ubicación / Llenado / Estado | Identificación e inventario |
| Acciones | *Origen* (trazabilidad hacia atrás desde el tambor) y *Transferir* |

Estados: `FILLED`, `IN_STOCK`, `IN_TRANSIT`, `DISPATCHED`, `CONSUMED`, `EMPTY`.

![Tambores](docs/capturas/escritorio/80-tambores-listado.png)

**Transferir tambor.** Cambia el establecimiento donde está el tambor; el establecimiento actual
se excluye de las opciones. Un tambor `CONSUMED` no se puede transferir.

![Transferir tambor](docs/capturas/escritorio/81-tambores-transferir.png)

**Filtro por estado.**

![Filtro tambores](docs/capturas/escritorio/82-tambores-filtro-por-estado.png)

**Alta.** No se registran desde esta pantalla: se crean desde el detalle del lote, y el estado
vacío lo aclara.

![Tambores móvil](docs/capturas/movil/80-tambores-listado.png)

---

### 6.12 Trazabilidad — `/trace`

**Propósito.** La pantalla que justifica el sistema. Responde dos preguntas opuestas:

- **Hacia atrás — ¿de dónde vino?** Parte de un **lote** o un **tambor**.
- **Hacia adelante — ¿dónde terminó?** Parte de un **apiario**, **lote**, **productor**,
  **establecimiento** o **movimiento**.

| Endpoint | Consulta |
|---|---|
| `GET /lots/:id/trace/backward` | Hacia atrás desde lote |
| `GET /drums/:id/trace/backward` | Hacia atrás desde tambor |
| `GET /traceability/forward/:entityType/:id` | Hacia adelante desde cualquier origen |

**Pantalla inicial.** Sin punto de partida seleccionado, explica cómo elegirlo en lugar de
mostrar un grafo vacío.

![Trazabilidad inicial](docs/capturas/escritorio/90-trazabilidad-pantalla-inicial.png)

**Resultado.** Cuatro indicadores (nodos y relaciones, productores, apiarios y **estado de la
cadena**), el panel de huecos, el grafo y dos tarjetas de resumen: *Origen productivo* (productores,
RENAPA, RENSPA, establecimientos) y *Producto y documentación* (movimientos con su DT-e, lotes,
tambores).

El estado de la cadena tiene tres valores, y la distinción es deliberada:

| Valor | Condición |
|---|---|
| **Completa** (verde) | No se detectó ningún hueco |
| **Con observaciones** (ámbar) | Hay huecos, ninguno de severidad `ERROR` |
| **Con errores** (rojo) | Al menos un hueco con severidad `ERROR` |

> *"La trazabilidad real rara vez está completa. El sistema informa qué falta en lugar de
> presentar la cadena como si estuviera cerrada."*

![Trazabilidad hacia atrás](docs/capturas/escritorio/91-trazabilidad-hacia-atras-lote.png)

**El grafo.** Distribuye los nodos por tipo en columnas fijas — productor, RENAPA/RENSPA,
establecimiento, apiario, movimiento, DT-e/recepción, extracción, lote, tambor — de modo que la
lectura sea estable sin importar por dónde haya empezado la consulta. Incluye control de zoom,
*Ajustar al ancho*, leyenda por tipo y un punto que marca el nodo de partida.

**Detalle de nodo.** Al tocar un nodo se abre una ficha con sus atributos.

![Detalle de nodo](docs/capturas/escritorio/96-trazabilidad-detalle-de-nodo.png)

**Huecos detectados.** Cada hueco lleva código y severidad. Los observados en la demostración:

| Código | Severidad | Significado |
|---|---|---|
| `LOT_WITHOUT_INPUTS` | WARNING | El lote no declara entradas: su origen no puede reconstruirse |
| `DTE_PENDING_SYNC` | WARNING | El DT-e existe en ApiTrace pero no está sincronizado con SIGSA |
| `MISSING_REQUIRED_DOCUMENT` | **ERROR** | El movimiento requiere un documento y no lo tiene registrado |
| `RECEPTION_DISCREPANCY` | WARNING | La recepción registró una diferencia de cantidad |
| `ESTABLISHMENT_WITHOUT_RENSPA` | WARNING | El establecimiento no tiene RENSPA asociado |
| `PRODUCER_WITHOUT_RENAPA` | WARNING | El productor es titular de un predio apícola y no tiene RENAPA |
| `NO_DOWNSTREAM_LOT` | WARNING | Consulta hacia adelante que no llega a ningún lote |

`MISSING_REQUIRED_DOCUMENT` es el único de severidad `ERROR`: es el que hace que la cadena se
informe como **Con errores** en lugar de **Con observaciones**.

![Huecos detectados](docs/capturas/escritorio/92-trazabilidad-huecos-detectados.png)

**Hacia adelante.**

| Desde un apiario | Desde un productor |
|---|---|
| ![Hacia adelante apiario](docs/capturas/escritorio/93-trazabilidad-hacia-adelante-apiario.png) | ![Hacia adelante productor](docs/capturas/escritorio/94-trazabilidad-hacia-adelante-productor.png) |

**Hacia atrás desde un tambor** — el caso típico de una investigación sanitaria que arranca en
la unidad física hallada en el depósito:

![Hacia atrás tambor](docs/capturas/escritorio/95-trazabilidad-hacia-atras-tambor.png)

| Inicial (móvil) | Resultado (móvil) |
|---|---|
| ![Trazabilidad móvil](docs/capturas/movil/90-trazabilidad-pantalla-inicial.png) | ![Trazabilidad resultado móvil](docs/capturas/movil/91-trazabilidad-hacia-atras-lote.png) |

---

### 6.13 Reglas documentales — `/rules`

**Propósito.** Auditar **por qué** un movimiento exigió (o no) un documento, sin leer código.
Las reglas son **datos con vigencia**: un cambio normativo se carga, no se despliega.

**Cómo se elige la regla.** Se buscan todas las reglas activas y vigentes **a la fecha del
traslado** cuyos criterios coincidan; un criterio vacío actúa como comodín. Gana la de **menor
prioridad numérica** (la más específica) y, ante empate, la de vigencia más reciente. El
movimiento guarda cuál se le aplicó, así que la decisión queda auditable aunque después se
modifique la regla.

Reglas cargadas por el `seed`:

| Prioridad | Regla | Se aplica a | Exige | Vigencia |
|---:|---|---|---|---|
| 10 | DT-e obligatorio: material melario de apiario a sala de extracción | `MATERIAL_MELARIO`, desde `APIARIO_BASE` hacia `SALA_EXTRACCION` | **DTE** | 01/08/2026 → vigente |
| 100 | Documento de respaldo: miel a granel entre establecimientos | `MIEL_A_GRANEL`, cualquier origen y destino | **REMITO** | 01/01/2020 → vigente |
| 900 | Regla general: movimientos sin documento sanitario obligatorio | Cualquier traslado | Nada | 01/01/2020 → vigente |

Referencia legal de la primera regla: *SENASA — Optimización de controles de movimientos de
material apícola desde apiarios a salas de extracción (vigencia 01/08/2026). Gestión en SIGSA;
cierre por la sala.*

![Reglas documentales](docs/capturas/escritorio/100-reglas-documentales.png)

![Reglas móvil](docs/capturas/movil/100-reglas-documentales.png)

---

### 6.14 Auditoría — `/audit`

**Propósito.** Registro **independiente de las tablas operativas**: quién hizo qué, sobre qué
entidad y cuándo. Se escribe automáticamente y **nunca hace fallar la operación de negocio**.

| Columna | Contenido |
|---|---|
| Momento | Fecha y hora del evento |
| Actor | Correo del usuario, o *sistema* |
| Acción | `MOVEMENT_CREATED`, `MOVEMENT_DISPATCHED`, `LOT_CREATED`, … |
| Entidad | Tipo y primeros 8 caracteres del identificador |
| Origen | Fuente del evento (`source`) |

**Filtros.** Por tipo de entidad (`movement`, `lot`, `drum`, `producer`, `establishment`,
`apiary`, `dte`, `user`) y por acción (texto libre).

![Auditoría](docs/capturas/escritorio/101-auditoria-listado.png)

![Filtro de auditoría](docs/capturas/escritorio/102-auditoria-filtro-por-entidad.png)

**Permisos.** La consulta requiere rol **ADMIN** o **AUDITOR**. Con cualquier otro rol la
pantalla es accesible pero la API responde 403 y se muestra el aviso correspondiente.

| Sin permiso (PRODUCTOR) | Con rol AUDITOR |
|---|---|
| ![Auditoría sin permiso](docs/capturas/escritorio/103-auditoria-sin-permiso.png) | ![Auditoría auditor](docs/capturas/escritorio/104-auditoria-rol-auditor.png) |

![Auditoría móvil](docs/capturas/movil/101-auditoria-listado.png)

---

### 6.15 Pendientes de sincronizar — `/pending`

**Propósito.** Cola de operaciones registradas sin conexión. Cada una lleva su **clave de
idempotencia generada en el dispositivo**, así que reenviarlas nunca duplica un movimiento ni
un DT-e.

| Columna | Contenido |
|---|---|
| Operación | Método HTTP y etiqueta legible (*Apiario API-004*, *Movimiento Miel (600 KG)*) |
| Destino | Ruta de la API |
| Registrada | Fecha y hora de la carga local |
| Estado | *En espera* (ámbar), *Enviando* (azul), *Rechazada* (rojo) con número de intentos |
| Acciones | *Reintentar* (sólo si fue rechazada y hay conexión) y *Descartar* (pide confirmación) |

**Reglas de la cola**, explicadas en la propia pantalla:

1. Las operaciones se envían **en el orden en que se registraron**, porque un lote puede
   depender de un movimiento cargado antes.
2. Si se corta la conexión a mitad de la sincronización, el envío **se detiene ahí y retoma
   desde el mismo punto**: no se queman los intentos del resto de la cola por un problema de señal.
3. Una operación rechazada con error de validación (4xx) **deja de reintentarse sola** y queda
   para revisión: reintentarla sin corregirla daría el mismo resultado.

**Cola vacía:**

| Escritorio | Móvil |
|---|---|
| ![Cola vacía](docs/capturas/escritorio/110-pendientes-cola-vacia.png) | ![Cola vacía móvil](docs/capturas/movil/110-pendientes-cola-vacia.png) |

Los estados con operaciones se documentan en la sección siguiente.

---

## 7. Modo offline y sincronización

El modo offline no es un accesorio: es el requisito que define la arquitectura del frontend,
porque el registro ocurre en el campo, donde no hay señal.

```mermaid
flowchart LR
    A["Usuario registra<br/>una operación"] --> B{"¿Hay conexión?"}
    B -->|Sí| C["POST a la API<br/>con Idempotency-Key"]
    B -->|No| D["Cola en IndexedDB<br/>estado: En espera"]
    C --> E["Respuesta y<br/>recarga del listado"]
    D --> F["Vuelve la señal"]
    F --> G["Envío en orden<br/>de registro"]
    G --> H{"Respuesta"}
    H -->|2xx| I["Sale de la cola"]
    H -->|4xx| J["Rechazada:<br/>queda para revisión"]
    H -->|Error de red| K["Se detiene y retoma<br/>en el mismo punto"]
```

| Capa | Responsabilidad |
|---|---|
| Service worker (Workbox) | Precachea el *app shell*; la app arranca sin red desde la primera visita. **No** cachea la API |
| IndexedDB (`idb`) | Guarda las respuestas de la API de forma estructurada y la cola de envío |
| `Idempotency-Key` | Generada en el dispositivo por operación; el backend la respeta para evitar duplicados |

**Franja «Sin conexión».** Al perder señal aparece sobre la barra superior: *Trabajando con
datos locales. Lo que registres se enviará al recuperar señal.* El indicador pasa a **Offline**
y las pantallas que sirven datos de caché muestran su antigüedad.

![Barra sin conexión](docs/capturas/escritorio/111-offline-barra-sin-conexion.png)

**Alta encolada.** El formulario se completa normalmente y la confirmación cambia de tono:
*Sin conexión: el apiario quedó en la cola y se enviará al recuperar señal.*

![Operación encolada](docs/capturas/escritorio/112-offline-operacion-encolada.png)

**Cola con operaciones.**

![Cola con operaciones](docs/capturas/escritorio/113-pendientes-cola-con-operaciones.png)

**Operación rechazada.** Al volver la señal, la cola se envía en orden: la primera alta se
registra y desaparece; la segunda —un apiario con código repetido— recibe `409 · Ya existe un
apiario API-001 en ese establecimiento` y queda marcada como **Rechazada**, con el error
visible y los botones *Reintentar* y *Descartar*. El contador rojo del menú lateral refleja la
situación.

![Operación rechazada](docs/capturas/escritorio/114-pendientes-operacion-rechazada.png)

| Sin conexión (móvil) | Encolada (móvil) | Cola (móvil) | Rechazada (móvil) |
|---|---|---|---|
| ![Offline móvil](docs/capturas/movil/111-offline-barra-sin-conexion.png) | ![Encolada móvil](docs/capturas/movil/112-offline-operacion-encolada.png) | ![Cola móvil](docs/capturas/movil/113-pendientes-cola-con-operaciones.png) | ![Rechazada móvil](docs/capturas/movil/114-pendientes-operacion-rechazada.png) |

---

## 8. Comportamiento en móvil y PWA

**Navegación.** Por debajo del punto de corte, la barra lateral se convierte en cajón: el botón
hamburguesa la abre sobre un fondo oscurecido y se cierra sola al navegar.

![Menú móvil](docs/capturas/movil/11-navegacion-menu-movil.png)

**Adaptaciones observadas**

| Elemento | En móvil |
|---|---|
| Barra lateral | Cajón deslizante con backdrop y botón de cierre |
| Barra superior | Marca reducida; las etiquetas *En línea* / *Offline* se ocultan y queda el punto de color |
| Tablas | Desplazamiento horizontal dentro de su contenedor; el cuerpo de la página nunca se desplaza en horizontal |
| Indicadores | Se apilan de a dos |
| Modales | Ocupan el ancho disponible con desplazamiento vertical interno |
| Geolocalización | *Usar mi ubicación actual* cobra sentido pleno estando en el apiario |

**Instalación.** El manifiesto declara nombre, tema `#c8871b`, orientación vertical, íconos
192/512/512-maskable y tres accesos directos. El botón *Instalar aplicación* aparece sólo cuando
el navegador emite `beforeinstallprompt`; en iOS, donde ese evento no existe, se muestra la
instrucción manual *Compartir → «Agregar a inicio»*.

**Listo para trabajar sin conexión.** Tras precachear el *app shell*, el service worker avisa:

| Escritorio | Móvil |
|---|---|
| ![Aviso PWA](docs/capturas/escritorio/115-pwa-aviso-listo-offline.png) | ![Aviso PWA móvil](docs/capturas/movil/115-pwa-aviso-listo-offline.png) |

Cuando hay una versión nueva, el mismo aviso ofrece *Actualizar* (`registerType: 'prompt'`), de
modo que una actualización nunca interrumpe una carga en curso.

---

## 9. Flujo completo del circuito

Recorrido de punta a punta, con la pantalla y la captura que corresponde a cada paso.

```mermaid
sequenceDiagram
    autonumber
    actor P as Productor
    actor S as Sala de extracción
    actor A as Acopiador
    participant BT as ApiTrace

    P->>BT: Alta de productor, establecimiento y apiario
    Note over BT: Reglas: RENAPA y RENSPA se asocian aparte
    P->>BT: Nuevo movimiento (apiario → sala)
    BT-->>P: Regla vigente: exige DT-e
    P->>BT: Registrar DT-e y despachar
    S->>BT: Registrar recepción (con motivo si hay diferencia)
    S->>BT: Nueva extracción consumiendo el movimiento
    S->>BT: Crear lote con origen en la extracción
    S->>BT: Registrar tambores del lote
    S->>BT: Movimiento sala → acopio
    A->>BT: Recepción y lote de acopio
    A->>BT: Transferencia de tambores
    BT-->>A: Consulta de trazabilidad y huecos detectados
```

| # | Paso | Pantalla | Captura de referencia |
|---:|---|---|---|
| 1 | Alta de productor | `/producers` | `21-productores-alta-formulario` |
| 2 | Asociar RENAPA | `/producers` | `22-productores-asociar-renapa` |
| 3 | Alta de establecimiento | `/establishments` | `31-establecimientos-alta-formulario` |
| 4 | Asociar RENSPA | `/establishments` | `32-establecimientos-asociar-renspa` |
| 5 | Alta de apiario y colmenas | `/apiaries` | `41`, `42` |
| 6 | Nuevo movimiento | `/movements` | `51-movimientos-alta-formulario` |
| 7 | Registrar DT-e | `/movements/:id` | `55-movimiento-registrar-dte` |
| 8 | Despachar | `/movements/:id` | `56-movimiento-despachar` |
| 9 | Registrar recepción | `/movements/:id` | `57-movimiento-registrar-recepcion` |
| 10 | Nueva extracción | `/extractions` | `62-extracciones-alta-formulario` |
| 11 | Crear lote | `/lots` | `71-lotes-alta-formulario` |
| 12 | Registrar tambores | `/lots/:id` | `73-lote-registrar-tambor` |
| 13 | Registrar muestra | `/lots/:id` | `74-lote-registrar-muestra` |
| 14 | Transferir tambor | `/drums` | `81-tambores-transferir` |
| 15 | Consultar trazabilidad | `/trace` | `91`, `92`, `95` |
| 16 | Verificar auditoría | `/audit` | `101-auditoria-listado` |

---

## 10. Hallazgos, inconsistencias y mejoras propuestas

Todo lo listado se observó **durante la toma de capturas**, sobre la aplicación en ejecución.
La severidad se estima respecto del objetivo del MVP: registrar y consultar la cadena real.

| ID | Severidad | Hallazgo | Evidencia | Propuesta |
|---|---|---|---|---|
| **H-01** | 🔴 Alta | El usuario `ADMIN` **no tiene organización asignada**, y el backend responde `403 · El usuario no tiene una organizacion asignada; no puede operar sobre el dominio` al crear productores o establecimientos. El rol de mayor privilegio no puede dar de alta los registros base. | Alta de productor/establecimiento con `admin@apitrace.test` | Permitir a `ADMIN` operar sin organización (o exigir que elija una explícitamente en el alta), y cubrirlo con un test de integración |
| **H-02** | 🔴 Alta | El alta de movimiento sólo ofrece **los establecimientos de la organización del usuario**. Un productor ve únicamente su predio, por lo que **no puede seleccionar la sala como destino**: el circuito inter-organización no se puede registrar desde la interfaz. | `51-movimientos-alta-formulario` con rol PRODUCTOR (ambos selectores vacíos) | Exponer un endpoint de establecimientos "visibles como contraparte" (destinos válidos) o permitir búsqueda por RENSPA/RNE al elegir destino |
| **H-03** | 🟡 Media | El mensaje de error del servidor **filtra el nombre del campo de la API**: *"Indique `discrepancyNotes` para dejar constancia"*, cuando en pantalla el campo se llama *Motivo de la diferencia*. | `52-movimientos-error-de-validacion` | Mapear los nombres de campo del backend a las etiquetas de la interfaz, o redactar los mensajes en términos de negocio |
| **H-04** | 🟡 Media | El panel de detalle de nodo del grafo muestra **las claves de atributo en inglés** (*Status, Movement type, Quantity, Scheduled at*), a diferencia del resto de la aplicación. | `96-trazabilidad-detalle-de-nodo` | Diccionario de etiquetas por tipo de nodo en `TraceGraph`, reutilizando `humanize` |
| **H-05** | 🟡 Media | Los `StatusBadge` muestran **el enum crudo** (`PARTIALLY_RECEIVED`, `IN_STOCK`, `PENDING_SYNC`) mientras las demás columnas usan `humanize`. Inconsistencia visible en todos los listados. | `50`, `58`, `80` | Aplicar `humanize` dentro de `StatusBadge` o un diccionario de estados en español |
| **H-06** | 🟡 Media | La validación nativa del navegador aparece **en inglés** (*"Please select an item in the list"*) al enviar un formulario incompleto. | Alta de apiario sin establecimiento seleccionado | Validar en el cliente antes de enviar y mostrar el error con el componente `Notice`, evitando el mensaje nativo |
| **H-07** | 🔴 Alta | La pantalla de acceso expone el bloque **«Acceso rápido (modo dev)»** con los seis usuarios y la contraseña de demostración. | `01-acceso-login` | Condicionar el bloque a `import.meta.env.DEV` o a `VITE_DEMO_LOGIN=true`, y desactivarlo en el build productivo |
| **H-08** | 🟡 Media | El rol **LABORATORIO** ve todos los indicadores en cero y no tiene pantalla propia: las muestras se registran desde el detalle del lote, sin bandeja de trabajo ni carga de resultados. | `16-panel-rol-laboratorio` | Agregar `/samples` con bandeja de muestras pendientes, carga de resultados y adjuntos |
| **H-09** | 🟢 Baja | El manifiesto PWA declara el acceso directo **`/movements/new`**, ruta que no existe en el enrutador: cae en el comodín y redirige al panel. | `vite.config.ts` vs. `App.tsx` | Crear la ruta o cambiar el acceso directo a `/movements` |
| **H-10** | 🟡 Media | **No hay edición ni corrección** de registros ya cargados: la interfaz sólo permite altas y transiciones de estado. En trazabilidad, la corrección auditada es un requisito, no un extra. | Todas las pantallas de registro | Definir el caso de uso "corrección auditada" (quién, con qué motivo, qué queda en `audit_event`) e implementarlo antes de producción |
| **H-11** | 🟢 Baja | Los listados piden un `pageSize` fijo (50 o 100) y **no exponen paginación**: con volumen real la tabla se corta en silencio. | Todos los listados | Paginación o carga incremental usando `meta.total`, que la API ya devuelve |
| **H-12** | 🟢 Baja | En trazabilidad, cuando el punto de partida es productor, establecimiento o movimiento, **hay que pegar el UUID a mano**; sólo lote y apiario ofrecen desplegable. | `90-trazabilidad-pantalla-inicial` | Selector con búsqueda para todos los tipos de entidad |
| **H-13** | 🟢 Baja | Los tambores **no se pueden crear** desde `/drums`; sólo desde el detalle del lote. El estado vacío lo aclara, pero el usuario que llega por el menú queda sin acción. | `80-tambores-listado` | Botón *Registrar tambor* con selector de lote, o enlace directo al lote correspondiente |
| **H-14** | 🟢 Baja | Los códigos internos de estado (`OPEN`, `FILLED`) y los códigos de hueco (`DTE_PENDING_SYNC`) se muestran al usuario final sin glosario en la interfaz. | `91`, `92` | Tooltip o leyenda con la definición de cada código, reutilizando este documento como fuente |

### Mejoras sugeridas más allá de los defectos

| Prioridad | Mejora | Motivo |
|---|---|---|
| Alta | **Lectura de QR/código de barras** en tambores y movimientos | En el depósito se identifica el tambor por precinto; tipearlo es la principal fuente de error |
| Alta | **Ficha pública de trazabilidad** por lote o tambor (enlace o QR sin sesión) | Es el argumento comercial ante el comprador o exportador |
| Media | **Adjuntar fotos** al movimiento, a la recepción y a la muestra | La prueba fotográfica del precinto o de la diferencia sostiene la constancia |
| Media | **Exportar** la consulta de trazabilidad a PDF | Un auditor pide un documento, no una pantalla |
| Media | **Panel de excepciones**: movimientos que exigen documento y no lo tienen, lotes sin entradas, DT-e sin sincronizar | Hoy los huecos sólo se ven al consultar una cadena concreta |
| Baja | Traducción de estados y de las claves del grafo (H-04, H-05) | Coherencia de idioma en toda la interfaz |
| Baja | Confirmación antes de cancelar un movimiento | Es una acción destructiva y hoy sólo pide el motivo |

---

## 11. Dependencias técnicas y riesgos

### 11.1 Dependencias de la interfaz

| Componente | Versión | Rol | Riesgo asociado |
|---|---|---|---|
| React | 19.1 | Interfaz | Bajo |
| React Router | 7.5 | Enrutamiento | Bajo |
| Vite | 6.2 | Build y servidor de desarrollo | Bajo |
| `vite-plugin-pwa` / Workbox | 1.0 | Service worker y manifiesto | Medio: el precacheo del *app shell* es la base del modo offline |
| `idb` | 8.0 | Caché estructurada y cola de envío | **Alto**: si el navegador purga IndexedDB se pierden operaciones no sincronizadas |
| Node | ≥ 22 | Entorno de build | Bajo |

### 11.2 Dependencias de la API

| Componente | Versión | Rol |
|---|---|---|
| NestJS | 11 | Monolito modular |
| Drizzle ORM + `pg` | 0.44 / 8.16 | Acceso a PostgreSQL |
| PostgreSQL (Neon) | 16 | Persistencia |
| `@nestjs/jwt` + Passport | 11 / 0.7 | Autenticación |
| `@nestjs/throttler` | 6.4 | Límite de tasa |
| `@nestjs/swagger` | 11 | Documentación OpenAPI (`/docs`) |
| Outbox de eventos | propio | Publicación de eventos de dominio |

### 11.3 Integraciones externas pendientes

| Integración | Estado hoy | Impacto en la interfaz |
|---|---|---|
| **SENASA / RENAPA** | No integrado | El RENAPA se carga a mano y queda *Pendiente de verificación*; el motor lo reporta como hueco |
| **RENSPA** | No integrado | Ídem, con el titular declarado en el formulario |
| **SIGSA / DT-e** | No integrado | El DT-e se registra en ApiTrace con `syncStatus = PENDING_SYNC`; aparece un aviso azul en el detalle y un hueco `DTE_PENDING_SYNC` en la trazabilidad |
| **SIFeGA / RNE** | No integrado | El RNE es un campo de texto del establecimiento |
| **Laboratorios** | No integrado | Las muestras se registran, pero no hay carga de resultados (H-08) |

### 11.4 Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación propuesta |
|---|---|---|---|
| Pérdida de operaciones en cola por limpieza del almacenamiento del navegador | Media | **Alto** | Solicitar almacenamiento persistente (`navigator.storage.persist()`), avisar cuando la cola supere N operaciones y ofrecer exportarla |
| El circuito inter-organización no se puede registrar desde la interfaz (H-02) | **Alta** | **Alto** | Resolver antes de cualquier piloto con usuarios reales |
| Exposición de credenciales de demostración en producción (H-07) | Media | Alto | Compilación condicional |
| Cambios normativos (fechas de vigencia, tipos de documento) | Alta | Medio | Ya mitigado: las reglas son datos con vigencia, no código |
| Arranque en frío del plan gratuito (Render/Neon) | Alta | Bajo | Documentar la demora inicial; usar el endpoint agrupado de Neon y `DATABASE_CONNECTION_TIMEOUT_MS` |
| Divergencia entre esta guía y la interfaz al evolucionar | Alta | Medio | El script de captura es determinista: regenerar las capturas en cada versión y versionar el documento |
| Datos personales de productores (CUIT, contacto, geolocalización) | Media | Alto | Política de retención, control de acceso por organización (ya implementado) y registro de auditoría (ya implementado) |

---

## 12. Inventario de capturas

Las imágenes viven en `docs/capturas/escritorio/` y `docs/capturas/movil/`, con el mismo
nombre de archivo en ambos tamaños. En total: **60** de escritorio y **28** de móvil.

| Archivo | Pantalla | Ruta | Qué muestra | Escritorio | Móvil |
|---|---|---|---|:--:|:--:|
| `01-acceso-login` | Iniciar sesión | `/login` | Formulario de acceso con los accesos rápidos de demostración | ✔ | ✔ |
| `02-acceso-login-error` | Iniciar sesión | `/login` | Error de credenciales inválidas | ✔ | ✔ |
| `10-panel-admin` | Panel | `/` | Vista del rol ADMIN, con el conjunto completo de datos | ✔ | ✔ |
| `12-panel-rol-productor` | Panel | `/` | Vista del rol PRODUCTOR | ✔ | — |
| `13-panel-rol-sala` | Panel | `/` | Vista del rol SALA | ✔ | — |
| `14-panel-rol-acopiador` | Panel | `/` | Vista del rol ACOPIADOR | ✔ | — |
| `15-panel-rol-auditor` | Panel | `/` | Vista del rol AUDITOR (solo lectura) | ✔ | — |
| `16-panel-rol-laboratorio` | Panel | `/` | Vista del rol LABORATORIO, con estados vacíos | ✔ | — |
| `20-productores-listado` | Productores | `/producers` | Listado con búsqueda y acciones | ✔ | ✔ |
| `21-productores-alta-formulario` | Productores | `/producers` | Modal de alta de productor | ✔ | ✔ |
| `22-productores-asociar-renapa` | Productores | `/producers` | Modal de asociación de RENAPA | ✔ | — |
| `23-productores-busqueda-sin-resultados` | Productores | `/producers` | Estado vacío tras una búsqueda sin coincidencias | ✔ | — |
| `24-productores-solo-lectura-auditor` | Productores | `/producers` | Vista de solo lectura del rol AUDITOR | ✔ | — |
| `30-establecimientos-listado` | Establecimientos | `/establishments` | Listado con filtro por tipo | ✔ | ✔ |
| `31-establecimientos-alta-formulario` | Establecimientos | `/establishments` | Modal de alta de establecimiento | ✔ | — |
| `32-establecimientos-asociar-renspa` | Establecimientos | `/establishments` | Modal de asociación de RENSPA | ✔ | — |
| `33-establecimientos-filtro-por-tipo` | Establecimientos | `/establishments` | Filtro aplicado por tipo de establecimiento | ✔ | — |
| `40-apiarios-listado` | Apiarios | `/apiaries` | Listado con colmenas y coordenadas | ✔ | ✔ |
| `41-apiarios-alta-formulario` | Apiarios | `/apiaries` | Modal de alta con captura de ubicación | ✔ | ✔ |
| `42-apiarios-colmenas` | Apiarios | `/apiaries` | Modal de alta y listado de colmenas | ✔ | — |
| `50-movimientos-listado` | Movimientos | `/movements` | Listado con exigencia documental y estado | ✔ | ✔ |
| `51-movimientos-alta-formulario` | Movimientos | `/movements` | Modal de alta de movimiento completo | ✔ | ✔ |
| `52-movimientos-error-de-validacion` | Movimientos | `/movements/:id` | Error de validación devuelto por el servidor | ✔ | — |
| `53-movimientos-filtro-por-estado` | Movimientos | `/movements` | Filtro por estado (cancelados) | ✔ | — |
| `54-movimiento-detalle-borrador` | Detalle de movimiento | `/movements/:id` | Borrador que exige DT-e y aún no lo tiene | ✔ | ✔ |
| `55-movimiento-registrar-dte` | Detalle de movimiento | `/movements/:id` | Modal de registro de DT-e | ✔ | — |
| `56-movimiento-despachar` | Detalle de movimiento | `/movements/:id` | Modal de despacho | ✔ | — |
| `57-movimiento-registrar-recepcion` | Detalle de movimiento | `/movements/:id` | Modal de recepción con diferencia y motivo | ✔ | — |
| `58-movimiento-detalle-recibido-con-dte` | Detalle de movimiento | `/movements/:id` | Movimiento recibido, DT-e e historial de eventos | ✔ | ✔ |
| `59-movimiento-cancelar` | Detalle de movimiento | `/movements/:id` | Modal de cancelación con motivo obligatorio | ✔ | — |
| `60-movimiento-detalle-cancelado` | Detalle de movimiento | `/movements/:id` | Movimiento cancelado | ✔ | — |
| `61-extracciones-listado` | Extracciones | `/extractions` | Listado con rendimiento calculado | ✔ | ✔ |
| `62-extracciones-alta-formulario` | Extracciones | `/extractions` | Modal de alta consumiendo movimientos recibidos | ✔ | ✔ |
| `70-lotes-listado` | Lotes | `/lots` | Listado con cantidad y disponible | ✔ | ✔ |
| `71-lotes-alta-formulario` | Lotes | `/lots` | Modal de alta con selección de origen | ✔ | — |
| `72-lote-detalle` | Detalle de lote | `/lots/:id` | Composición, tambores e historial | ✔ | ✔ |
| `73-lote-registrar-tambor` | Detalle de lote | `/lots/:id` | Modal de registro de tambor | ✔ | — |
| `74-lote-registrar-muestra` | Detalle de lote | `/lots/:id` | Modal de registro de muestra de laboratorio | ✔ | — |
| `75-lote-detalle-sin-origen-declarado` | Detalle de lote | `/lots/:id` | Lote sin entradas: hueco de trazabilidad | ✔ | — |
| `80-tambores-listado` | Tambores | `/drums` | Listado con ubicación y estado | ✔ | ✔ |
| `81-tambores-transferir` | Tambores | `/drums` | Modal de transferencia entre establecimientos | ✔ | — |
| `82-tambores-filtro-por-estado` | Tambores | `/drums` | Filtro por estado del tambor | ✔ | — |
| `90-trazabilidad-pantalla-inicial` | Trazabilidad | `/trace` | Selección del sentido y del punto de partida | ✔ | ✔ |
| `91-trazabilidad-hacia-atras-lote` | Trazabilidad | `/trace/backward/lot/:id` | Cadena hacia atrás desde un lote de acopio | ✔ | ✔ |
| `92-trazabilidad-huecos-detectados` | Trazabilidad | `/trace/backward/lot/:id` | Cadena con huecos detectados | ✔ | — |
| `93-trazabilidad-hacia-adelante-apiario` | Trazabilidad | `/trace/forward/apiary/:id` | Cadena hacia adelante desde un apiario | ✔ | — |
| `94-trazabilidad-hacia-adelante-productor` | Trazabilidad | `/trace/forward/producer/:id` | Cadena hacia adelante desde un productor | ✔ | — |
| `95-trazabilidad-hacia-atras-tambor` | Trazabilidad | `/trace/backward/drum/:id` | Cadena hacia atrás desde un tambor | ✔ | — |
| `96-trazabilidad-detalle-de-nodo` | Trazabilidad | `/trace/backward/lot/:id` | Ficha de atributos de un nodo del grafo | ✔ | — |
| `100-reglas-documentales` | Reglas documentales | `/rules` | Reglas vigentes y criterio de selección | ✔ | ✔ |
| `101-auditoria-listado` | Auditoría | `/audit` | Eventos de auditoría con filtros | ✔ | ✔ |
| `102-auditoria-filtro-por-entidad` | Auditoría | `/audit` | Filtro por tipo de entidad | ✔ | — |
| `103-auditoria-sin-permiso` | Auditoría | `/audit` | Acceso denegado con rol sin permiso | ✔ | — |
| `104-auditoria-rol-auditor` | Auditoría | `/audit` | Vista completa con rol AUDITOR | ✔ | — |
| `110-pendientes-cola-vacia` | Pendientes | `/pending` | Cola vacía | ✔ | ✔ |
| `111-offline-barra-sin-conexion` | Offline | `/` | Franja «Sin conexión» e indicador Offline | ✔ | ✔ |
| `112-offline-operacion-encolada` | Offline | `/apiaries` | Alta registrada sin conexión y encolada | ✔ | ✔ |
| `113-pendientes-cola-con-operaciones` | Pendientes | `/pending` | Dos operaciones en espera de envío | ✔ | ✔ |
| `114-pendientes-operacion-rechazada` | Pendientes | `/pending` | Operación rechazada por el servidor (409) | ✔ | ✔ |
| `115-pwa-aviso-listo-offline` | PWA | `/login` | Aviso de aplicación lista para usarse sin conexión | ✔ | ✔ |

### Cómo regenerar las capturas

1. Levantar PostgreSQL y aplicar migraciones y `seed` (`npm run db:migrate && npm run db:seed` en `backend/`).
2. Iniciar la API (`npm run start`) y servir el build del frontend (`npm run build && npm run preview`).
3. Ejecutar el guion de captura de Playwright para cada viewport (escritorio y móvil).
4. Reemplazar el contenido de `docs/capturas/` y revisar este documento si cambió alguna pantalla.

> Al regenerar, conservar los mismos nombres de archivo: los enlaces de este documento dependen de ellos.

---

*Documento generado a partir de la aplicación en ejecución. Ante cualquier diferencia entre esta*
*guía y el comportamiento observado, vale el comportamiento: este documento debe corregirse.*

