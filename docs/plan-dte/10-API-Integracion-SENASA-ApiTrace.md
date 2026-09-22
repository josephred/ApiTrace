# 10 · API que ApiTrace necesita de SENASA para el DT-e apícola (API-SEM)

**Solicitante:** ApiTrace — plataforma de trazabilidad apícola (Argentina)
**Destinatarios:** SENASA — Dirección Nacional de Sanidad Animal (SIGSA / SITA) · ARCA (ex-AFIP), Administración de Certificados y Relaciones
**Versión:** 1.0 · **Fecha:** 2026-09-21
**Anexo técnico:** `openapi-apitrace-senasa.yaml` (OpenAPI 3.1)

---

## 1. Para qué es este documento

ApiTrace acompaña al productor apícola desde la colmena hasta el tambor de miel, y necesita
que el **Documento de Tránsito electrónico (DT-e, movimiento API-SEM)** forme parte de ese
recorrido sin que el productor tenga que salir del sistema y volver a cargar los mismos
datos en otra pantalla.

Hoy ApiTrace funciona **sin integración**: el productor emite el DT-e en SIGSA por
autogestión y en ApiTrace registra el número, el código de cierre y la vigencia. Funciona,
pero deja tres problemas que sólo la integración resuelve:

1. El número se transcribe a mano: un dígito mal copiado rompe la cadena documental.
2. ApiTrace no puede verificar que el apiario de origen y la sala de destino estén
   habilitados **antes** de que el camión cargue.
3. El cierre en sala se registra dos veces (en SITA y en ApiTrace), con el riesgo de que
   una quede sin la otra.

Este documento describe, operación por operación, **qué necesita ApiTrace** y con qué
formato. No presupone que SENASA tenga que construirlo tal cual: es la lista concreta de lo
que hay que resolver, para que la conversación técnica empiece con algo escrito.

Todo lo que aquí figura como **supuesto** está marcado con **(a confirmar)** y agrupado en
la sección 11.

---

## 2. Quién sería ApiTrace frente a SIGSA

| | |
| :--- | :--- |
| **Figura** | Tercero autorizado (proveedor de software) que opera **en nombre de cada productor**, con delegación explícita de éste |
| **Identidad digital** | Certificado X.509 propio, emitido por ARCA a nombre de la CUIT de la plataforma, asociado a un Computador Fiscal |
| **Delegación** | Cada productor delega el servicio de SIGSA en la CUIT de la plataforma (Administrador de Relaciones, Formulario F.3283/E) **(a confirmar: nombre exacto del servicio delegable)** |
| **Qué no hace** | ApiTrace no reemplaza al productor como titular del trámite ni asume su responsabilidad sanitaria: firma en su nombre y con su autorización, y deja registro de cada acción |
| **Trazabilidad que aporta** | Cada DT-e queda vinculado al apiario (RENAPA), al lote de extracción, a los tambores y al lote fraccionado, con historial de estados y auditoría por usuario |

---

## 3. Lo que pedimos, en una página

| # | Necesidad | Operación esperada | Sin esto… |
| :--- | :--- | :--- | :--- |
| 1 | **Acceso a homologación** | Certificado de prueba (WSASS), CUIT de prueba, apiario y sala de prueba habilitados | No se puede desarrollar ni validar nada |
| 2 | **Consulta de padrones** | Estado del apiario en RENAPA y de la sala de extracción | El DT-e se solicita a ciegas y el rechazo llega con el camión cargado |
| 3 | **Emisión del DT-e API-SEM** | Alta del trámite con los datos del movimiento; devuelve número, código de cierre y vigencia | Se sigue transcribiendo a mano |
| 4 | **Anulación / eliminación** | Anular el DT-e emitido (con arancel) o eliminar la solicitud (sin arancel) | La regla de exceso de carga (Qreal > Qdecl) no se puede resolver desde el sistema |
| 5 | **Cierre en sala (SITA)** | Cierre con código, fecha de arribo y alzas confirmadas; y declaración de "sin arribo" | El cierre queda desacoplado de la trazabilidad de la sala |
| 6 | **Consulta de estado** | Estado actual de un DT-e por número | No se detecta a tiempo un DT-e por vencer o vencido |
| 7 | **Representación imprimible** | El PDF oficial del DT-e | El productor tiene que ir a SIGSA a imprimirlo, y el chofer necesita el papel |
| 8 | **Aviso de cambios (deseable)** | Notificación a una URL nuestra cuando cambia el estado | Hay que consultar periódicamente, con más carga para SENASA |

---

## 4. Autenticación y delegación

Lo que entendemos del circuito, para confirmar:

```
ApiTrace                      ARCA (WSAA)                     SENASA (SIGSA / SITA)
   │                               │                                   │
   │ 1. CMS firmado (LoginTicketRequest, servicio = sigsa)             │
   │──────────────────────────────>│                                   │
   │ 2. Token + Sign (validez 12 h)│                                   │
   │<──────────────────────────────│                                   │
   │                                                                   │
   │ 3. Operación del trámite, con Token + Sign + CUIT representada    │
   │──────────────────────────────────────────────────────────────────>│
   │ 4. Resultado del trámite (número de DT-e, código de cierre, …)    │
   │<──────────────────────────────────────────────────────────────────│
```

| Punto | Lo que haremos | A confirmar |
| :--- | :--- | :--- |
| Certificado | RSA 2048, CSR con `SERIALNUMBER=CUIT <cuit>`; alias por ambiente | Si SENASA exige un alias o un DN particular |
| Ticket de acceso | Uno por CUIT representada y servicio, en caché hasta su expiración (12 h), sin pedir tickets simultáneos | Nombre exacto del `service` en WSAA: ¿`sigsa`? ¿otro para SITA? |
| Firma | CMS/PKCS#7 en Base64, `generationTime` con offset **−03:00** (hora oficial argentina) | Que el offset esperado sea −03:00 y no −04:00 (la especificación pública que tomamos como base dice −04:00; la hora argentina no tiene horario de verano desde 2009) |
| Delegación | El productor delega el servicio en la CUIT de la plataforma y nosotros la aceptamos y la asignamos al Computador Fiscal | Nombre del servicio delegable, si admite subdelegación y cómo se consulta el estado de la delegación por API |
| Transporte | HTTPS, TLS 1.2+ | Si el servicio es REST/JSON o SOAP/XML (ver §6.1) |

---

## 5. Datos del trámite que ApiTrace enviaría

Tomados de la especificación del movimiento API-SEM. ApiTrace ya guarda exactamente estos
valores, con estos nombres, en su modelo interno:

| Campo | Valor | Origen en ApiTrace |
| :--- | :--- | :--- |
| Tipo de movimiento | `API-SEM` | Constante |
| Motivo de tránsito | `Extracción de miel` | Constante |
| Establecimiento origen | RENAPA del apiario, formato `Letra-Renapa-Apiario` (ej. `B53999-2`) | Ficha del apiario |
| Establecimiento destino | Código de sala, formato `SEF-Letra-Número` (ej. `SEF-B-20010`) | Ficha del establecimiento |
| Producto | Código `24.45`, `Alzas melarias` | Constante |
| Unidad | `UNIDAD` | Constante |
| Cantidad declarada | Entero, sobreestimado por el productor | Asistente del DT-e |
| Fecha de carga | `YYYY-MM-DD` (día calendario argentino) | Asistente del DT-e |
| Fecha de vencimiento | `YYYY-MM-DD`, carga + 2 a 4 días | Asistente del DT-e |
| Precintos | No se envían | — |
| Transporte | Tipo de vehículo (`CAMION`, `CAMIONETA`, `FURGON`, `UTILITARIO`, `OTRO`) y patente de chasis y acoplado | Asistente del DT-e |
| CUIT del titular | CUIT del productor representado | Ficha del productor |
| Referencia propia | UUID del DT-e en ApiTrace, para idempotencia | Generado |

---

## 6. Operaciones requeridas

### 6.1 Convenciones

| Aspecto | Propuesta de ApiTrace | Por qué |
| :--- | :--- | :--- |
| Estilo | REST sobre HTTPS con JSON | Es lo que consume un backend moderno sin capa intermedia; **si el servicio es SOAP, ApiTrace lo adapta**: lo que no puede faltar es el contrato (WSDL o esquema) |
| Base | `https://<host>/api-sem/v1` en producción y `https://<host-homologacion>/api-sem/v1` | Ambientes separados por host, mismo contrato |
| Autenticación | `Authorization: SENASA token="…", sign="…"` más `X-Cuit-Representada` | Reutiliza el ticket de WSAA sin ponerlo en la URL |
| Idempotencia | `Idempotency-Key` con el UUID del DT-e en ApiTrace; repetir la misma clave devuelve el mismo resultado | Una reintentada por corte de red no debe emitir dos DT-e (ni cobrar dos aranceles) |
| Errores | HTTP 4xx/5xx + cuerpo `{ "codigo": "...", "mensaje": "...", "detalle": { ... } }` | ApiTrace necesita **distinguir rechazo definitivo de falla técnica** (ver §7) |
| Trazabilidad | `X-Correlation-Id` de ida y vuelta | Para poder reclamar un caso puntual con un identificador común |
| Límites | Documentar límite de llamadas por minuto y por CUIT | Para dimensionar la cola de reintentos |

### 6.2 Padrones: verificar antes de emitir

```http
GET /padrones/renapa/apiarios/{codigo}
GET /padrones/salas-extraccion/{codigo}
```

Respuesta esperada (200):

```json
{
  "codigo": "B53999-2",
  "estado": "ACTIVO",
  "vigenteHasta": "2027-03-15",
  "cuitTitular": "20123456789",
  "denominacion": "El Totoral - Loma Alta",
  "provincia": "Buenos Aires"
}
```

- `estado`: `ACTIVO`, `SUSPENDIDO`, `VENCIDO`, `DADO_DE_BAJA`, `NO_ENCONTRADO`.
- Si no existe: **404** con `codigo: "PADRON_NO_ENCONTRADO"`.
- Uso en ApiTrace: la pantalla de comprobaciones previas bloquea la emisión y le dice al
  productor exactamente qué registro tiene que regularizar, antes de cargar el camión.
- Frecuencia estimada: una consulta por DT-e preparado, más una verificación diaria de los
  apiarios activos de cada productor (**a confirmar** si esto último es aceptable o si
  conviene un padrón descargable).

### 6.3 Emisión y anulación del DT-e

```http
POST /dte/api-sem
```

```json
{
  "referenciaExterna": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "cuitTitular": "20123456789",
  "origen":  { "tipo": "RENAPA_APIARIO", "codigo": "B53999-2" },
  "destino": { "tipo": "SALA_EXTRACCION", "codigo": "SEF-B-20010" },
  "producto": { "codigo": "24.45", "descripcion": "Alzas melarias", "unidad": "UNIDAD", "cantidadDeclarada": 100 },
  "motivoTransito": "Extracción de miel",
  "fechaCarga": "2026-11-12",
  "fechaVencimiento": "2026-11-14",
  "transporte": { "tipo": "CAMION", "patenteChasis": "AF123BC", "patenteAcoplado": null }
}
```

Respuesta esperada (201):

```json
{
  "numero": "022440451-4",
  "codigoCierre": "790112",
  "estado": "EMITIDO",
  "fechaEmision": "2026-11-10T09:12:00-03:00",
  "vigenteDesde": "2026-11-12",
  "vigenteHasta": "2026-11-14",
  "arancel": { "importe": 0, "moneda": "ARS", "estado": "NO_APLICA" },
  "representacionUrl": "https://.../dte/022440451-4/representacion"
}
```

Necesitamos saber, además:

- Si la emisión es **sincrónica** o si devuelve un identificador de trámite a consultar
  (ApiTrace está preparado para las dos: tiene una cola con reintentos y estado
  `SOLICITADO`).
- Cómo se informa el **arancel** y en qué momento se considera pagado.
- Si el número se puede pedir con **anticipación** (hasta 4 días antes de la fecha de carga,
  según la especificación) y si eso cambia el estado inicial.

```http
POST /dte/{numero}/anulacion
```

```json
{ "motivo": "Exceso de carga: se contaron 60 alzas y se declararon 50", "arancelPagado": true }
```

- `arancelPagado: true` → **ANULADO**; `false` → **ELIMINADO** (solicitud sin arancel).
- Respuesta 200 con el estado resultante; 409 si el DT-e ya transitó o ya está cerrado.

### 6.4 Cierre en sala y sin arribo (SITA)

```http
POST /sita/dte/{numero}/cierre
```

```json
{ "codigoCierre": "790112", "fechaArribo": "2026-11-12", "alzasConfirmadas": 65 }
```

- 200: `{ "numero": "...", "estado": "CERRADO", "habilitaExtraccion": true }`
- 422 con `codigo: "EXCESO_CANTIDAD_DECLARADA"` si `alzasConfirmadas > cantidadDeclarada`,
  incluyendo ambos valores en `detalle` (ApiTrace ya aplica esta regla antes de llamar, y
  necesita el mismo error para el caso de discrepancia).
- 403 si la sala que cierra no es la del DT-e.

```http
POST /sita/dte/{numero}/sin-arribo
```

```json
{ "motivo": "La carga no llegó a la planta", "fecha": "2026-11-16" }
```

### 6.5 Consulta de estado y representación imprimible

```http
GET /dte/{numero}
GET /dte/{numero}/representacion       →  application/pdf
```

La representación imprimible es importante: la normativa exige llevar el DT-e **impreso**
en la cabina. Si ApiTrace puede descargarla, el productor imprime desde el mismo sistema en
el que cargó los datos, y el chofer no viaja sin el papel.

### 6.6 Aviso de cambios (deseable, no imprescindible)

```http
POST <url configurada por ApiTrace>
```

```json
{ "numero": "022440451-4", "estadoAnterior": "VIGENTE", "estado": "CERRADO", "ocurridoEn": "2026-11-12T18:40:00-03:00" }
```

Con firma o secreto compartido para verificar el origen. Si no existe, ApiTrace consulta
`GET /dte/{numero}` con una frecuencia acordada: es más carga para SENASA, no menos.

---

## 7. Errores: lo que ApiTrace necesita distinguir

El sistema trata de manera distinta un rechazo definitivo de una falla técnica: el primero
se le muestra al productor con el motivo; el segundo se reintenta solo.

| Situación | Esperamos | ApiTrace hace |
| :--- | :--- | :--- |
| Dato inválido (formato, campo faltante) | 400, `codigo` específico | Muestra el error en el campo y no reintenta |
| Origen o destino no habilitado | 422, `codigo: "ORIGEN_NO_HABILITADO"` / `"DESTINO_NO_HABILITADO"` | Muestra qué registro regularizar; no reintenta |
| Titular bloqueado (DT-e caducado) | 422, `codigo: "TITULAR_BLOQUEADO"` | Lo informa en el panel del productor; no reintenta |
| Cantidad confirmada mayor a la declarada | 422, `codigo: "EXCESO_CANTIDAD_DECLARADA"` | Guía al usuario a anular y emitir de nuevo |
| Delegación inexistente o revocada | 403, `codigo: "DELEGACION_INVALIDA"` | Pide al productor rehacer la delegación; no reintenta |
| Ticket vencido | 401, `codigo: "TICKET_VENCIDO"` | Renueva el ticket y reintenta una vez |
| Servicio no disponible / tiempo de espera | 503 o 504 | Reintenta con espera creciente, sin duplicar (idempotencia) |
| Número inexistente | 404 | Informa y no reintenta |

---

## 8. Homologación: qué necesitamos para probar

1. Certificado de prueba por WSASS, asociado a una CUIT de prueba **(a confirmar el
   procedimiento para un tercero autorizado)**.
2. Un **apiario de prueba** con RENAPA habilitado y una **sala de prueba** con código SEF
   habilitado, en el ambiente de homologación.
3. Confirmación de que en homologación **no** se generan aranceles ni documentos con
   validez.
4. Contrato técnico: OpenAPI, WSDL o el documento que corresponda, y ejemplos de
   respuestas, incluidos los errores.
5. Un contacto técnico y una vía para reportar diferencias entre lo documentado y lo que
   responde el servicio.

Con eso, ApiTrace implementa el adaptador `sigsa` (hoy escrito como esqueleto, con las
operaciones ya nombradas una por una) y puede correr sus pruebas de extremo a extremo sin
tocar producción.

---

## 9. Seguridad, datos y registros

| Tema | Cómo lo maneja ApiTrace |
| :--- | :--- |
| Certificados y claves privadas | Almacenadas cifradas, fuera del repositorio, con acceso restringido al servicio |
| Datos personales | Se guardan los mínimos del trámite (CUIT, razón social, registros); Ley 25.326 |
| Registro de cada llamada | Fecha, operación, CUIT representada, correlación y resultado, sin guardar credenciales |
| Auditoría interna | Cada acción de usuario queda en el libro de auditoría, con usuario, IP y detalle del cambio |
| Conservación | La historia del DT-e y su vínculo con lotes y tambores se conservan para respaldar exportaciones y fiscalizaciones |
| Ambientes | Homologación y producción con credenciales y bases separadas |

---

## 10. Qué gana SENASA con esta integración

- **Datos de origen normalizados**: cada DT-e llega con el RENAPA del apiario y el código
  de la sala verificados contra el padrón el mismo día de la carga.
- **Menos trámites anulados**: la regla de sobreestimación y la verificación previa reducen
  las anulaciones por exceso de carga, que hoy obligan a rehacer el trámite con el camión
  parado.
- **Cierres en término**: el sistema le avisa a la sala y al productor antes de que el DT-e
  venza, lo que reduce los DT-e caducados y los bloqueos que traen.
- **Trazabilidad hacia adelante**: SENASA puede pedirle a ApiTrace, para un DT-e cerrado,
  el lote de extracción, los tambores y el lote fraccionado que salieron de esa carga.

---

## 11. Supuestos a confirmar y checklist para la reunión

Los supuestos vienen de documentación pública y de la especificación interna del proyecto:
**ninguno está confirmado por SENASA**.

| # | Supuesto | Pregunta para la reunión |
| :--- | :--- | :--- |
| 1 | La autenticación es WSAA de ARCA con certificado X.509 | ¿Es WSAA? ¿Cuál es el nombre del `service` para SIGSA y para SITA? |
| 2 | El servicio delegable se llama "SIGSA" o "Trazabilidad Apícola" y se delega con F.3283/E | ¿Cuál es el nombre exacto y admite delegación a un tercero? ¿Se puede consultar el estado por API? |
| 3 | Existe (o puede existir) una API para el movimiento API-SEM | ¿Existe hoy? ¿REST o SOAP? ¿Hay contrato disponible? |
| 4 | Los padrones de RENAPA y salas se pueden consultar por código | ¿Hay servicio de consulta? ¿O un padrón descargable? |
| 5 | El cierre en sala se puede hacer por API con el código de cierre | ¿SITA expone el cierre? ¿Y la declaración de sin arribo? |
| 6 | El DT-e tiene representación imprimible descargable | ¿Se puede obtener el PDF por API? |
| 7 | La vigencia es de 2 a 4 días y la anticipación de hasta 4 | ¿Se confirma? ¿Cambió con alguna resolución posterior? |
| 8 | Tras el vencimiento hay 4 días de gracia y luego el titular queda bloqueado | ¿Se confirma el plazo y el efecto? |
| 9 | El código de cierre es alfanumérico de hasta 20 caracteres | ¿Cuál es el formato real y cómo se valida? |
| 10 | El número de DT-e tiene prefijo de oficina y dígito verificador (`022440451-4`) | ¿Se confirma el formato? ¿Hay algoritmo de verificación publicado? |
| 11 | El arancel se abona al emitir y la anulación con arancel pagado da `ANULADO` | ¿Cómo se informa el arancel por API? |
| 12 | Hay ambiente de homologación disponible para terceros | ¿Cómo se solicita el acceso y cuánto demora? |
| 13 | La hora oficial para las firmas es −03:00 | ¿Se confirma? |
| 14 | Se puede recibir aviso de cambios de estado en una URL nuestra | ¿Existe o está previsto? |

**Para llevar a la reunión:** este documento, el anexo `openapi-apitrace-senasa.yaml`, y la
demostración del circuito completo en ApiTrace en modo manual (borrador, emisión,
semáforo de tránsito, cierre en sala con código y trazabilidad hasta el tambor).
