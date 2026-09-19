# Especificación Técnica Interoperable: Generación de DT-e y Trazabilidad Apícola (Sistema ApiTrace)

**Destinatario:** Modelo de Inteligencia Artificial / Equipo de Desarrollo Informático  
**Proyecto:** Sistema ApiTrace (Gestión de DT-e y Trazabilidad desde Colmenas hasta Miel Porcionada)  
**Entidades Reguladoras:** ARCA (ex-AFIP) / SENASA (SIGSA - SITA)  
**Versión del Documento:** 1.0.0  
**Fecha de Emisión:** Marzo de 2026  

---

## 1. RESUMEN EJECUTIVO Y OBJETIVO DEL DOCUMENTO

Este documento constituye el **Manual Técnico de Especificación de Requerimientos y Diseño Arquitectónico** para la construcción del sistema **ApiTrace**. Su propósito es proporcionar directrices inequívocas, reglas de negocio rígidas, modelos de datos, flujos de integración gubernamental y especificaciones de API REST para que un motor de IA o un equipo de desarrollo implemente de forma automatizada la emisión de **Documentos de Tránsito electrónico (DT-e)** y la trazabilidad integral de la miel.

ApiTrace actúa como una pasarela intermedia (middleware / solución mobile-backend) que abstrae la complejidad burocrática de los sistemas estatales (ARCA/SENASA), garantizando:
1. La autenticación segura ante **ARCA** mediante **WSAA** (Web Service de Autenticación y Autorización).
2. La autogestión de trámites **DT-e (movimiento API-SEM)** en el sistema **SIGSA** de SENASA.
3. El cierre de trazabilidad en salas de extracción a través de **SITA** (Sistema de Trazabilidad Apícola).
4. El seguimiento continuo de la cadena de custodia alimentaria desde la colmena en el apiario de origen, pasando por la extracción en alzas melarias, el fraccionamiento en tambores y la entrega de miel porcionada al consumidor final con código QR.

---

## 2. ARQUITECTURA DE ECOSISTEMA GUBERNAMENTAL Y REGULATORIO

El sistema ApiTrace interactúa con un ecosistema multinivel de plataformas gubernamentales argentinas:

```
+-----------------------------------------------------------------------------------+
|                                 SISTEMA APITRACE                                  |
|         (Aplicación Mobile Apicultor / API Backend Laravel / Pasarela)            |
+-----------------------------------------+-----------------------------------------+
                                          |
          +-------------------------------+-------------------------------+
          |                                                               |
+---------v-----------------------+                             +---------v-----------------------+
|          ARCA (ex-AFIP)         |                             |          SENASA / ARCA          |
+---------------------------------+                             +---------------------------------+
| * WSAA: Autenticación (CMS/TA)  |                             | * SIGSA: Emisión de DT-e        |
| * ADMINREL: Delegación servicios|                             |   (Movimiento API-SEM)          |
| * WSASS: Homologación/Testing   |                             | * SITA: Cierre de DT-e y        |
| * Certificados Digitales (X509) |                             |   Trazabilidad Apícola          |
+---------------------------------+                             +---------------------------------+
```

### 2.1 Glosario de Organismos y Sistemas
* **ARCA (Agencia de Recaudación y Control Aduanero, ex-AFIP):** Organismo recaudador que gestiona la identidad digital (Clave Fiscal) y la autenticación mediante firma digital para todos los servicios web estatales.
* **SENASA (Servicio Nacional de Sanidad y Calidad Agroalimentaria):** Autoridad de aplicación sanitaria responsable de la inocuidad alimentaria y sanidad animal.
* **SIGSA (Sistema Integrado de Gestión de Sanidad Animal):** Plataforma creada bajo Res. 356/2008 de la ex-SAGPyA para la autogestión de DT-e las 24 horas.
* **SITA (Sistema de Trazabilidad Apícola):** Módulo dependiente de SENASA donde las salas de extracción reciben, verifican y cierran los DT-e, transformando las alzas melarias en stock de miel procesada.
* **RENAPA (Registro Nacional de Productores Apícolas):** Padrón obligatorio que identifica al apicultor y la localización geográfica de cada uno de sus apiarios.

---

## 3. MÓDULO DE AUTENTICACIÓN Y AUTORIZACIÓN VÍA ARCA (WSAA & ADMINREL)

Para que el sistema ApiTrace opere en nombre de un productor apícola o sala de extracción, debe establecer una conexión segura firmada digitalmente.

```
+-----------+            +-------------------+            +------------+            +---------------------+
|  ApiTrace |            | OpenSSL Local CSR |            |  ARCA /    |            | ARCA WSAA           |
|  Backend  |            |  o Cliente Web    |            | AdminCert  |            | Auth Web Service    |
+-----+-----+            +---------+---------+            +-----+------+            +----------+----------+
      |                            |                            |                              |
      | 1. Genera Clave Privada    |                            |                              |
      |    y archivo CSR (.csr)    |                            |                              |
      |--------------------------->|                            |                              |
      |                            | 2. Sube CSR (.csr)         |                              |
      |                            |--------------------------->|                              |
      |                            | 3. Emite Certificado (.crt)|                              |
      |                            |<---------------------------|                              |
      | 4. Almacena Key + CRT      |                            |                              |
      |<---------------------------+                            |                              |
      |                                                                                        |
      | 5. Construye LoginTicketRequest (XML) firmado con PKCS#7 / CMS                         |
      |--------------------------------------------------------------------------------------->|
      | 6. Devuelve Access Ticket (TA: Token + Sign, Validez 12hs)                             |
      |<---------------------------------------------------------------------------------------|
```

### 3.1 Generación del Certificado Digital (X.509)
1. **Generación de Clave Privada y CSR (Certificate Signing Request):**
   * Se utiliza OpenSSL con algoritmo RSA (2048 bits mínimo).
   * El CSR se genera en formato PKCS#10.
   * El campo `serialNumber` del CSR debe incluir estrictamente el texto: `CUIT <numero_cuit_sin_guiones>`.
   * Ejemplo de Distinguished Name (DN): `C=ar, ST=Buenos Aires, L=Ciudad Autonoma, O=Empresa, OU=IT, SERIALNUMBER=CUIT 20123456789, CN=ApiTraceKey`.
2. **Obtención del Certificado en Entorno de Producción:**
   * Se ingresa al portal institucional de ARCA con Clave Fiscal Nivel 3.
   * Se accede al servicio **"Administración de Certificados Digitales"**.
   * Se crea un Alias (ej. `apitrace-prod`) y se sube el archivo `.csr`.
   * ARCA emite el certificado en formato `.crt` (PEM). El servidor ensambla el certificado `.crt` junto con la clave privada `.key` para formar la identidad criptográfica.
3. **Entorno de Testing / Homologación (WSASS):**
   * Para pruebas se utiliza la aplicación web **WSASS** (Autogestión de Certificados para Servicios Web en Homologación).
   * **REGLA TÉCNICA:** El servicio WSASS no es delegable; debe ser accedido por el desarrollador con su Clave Fiscal de **Persona Física** (nivel 2 o superior).
   * En el WSASS se asocia el certificado a la CUIT representada del apicultor o empresa de prueba.

### 3.2 Proceso de Autenticación con WSAA (Ticket de Acceso)
1. ApiTrace genera un archivo XML `LoginTicketRequest.xml` con el siguiente contenido estructurado:
   * `header/source`: DN del computador fiscal.
   * `header/destination`: `cn=wsaa,o=afip,c=ar,serialNumber=CUIT 33693450239`.
   * `header/uniqueId`: Entero único (timestamp unix).
   * `header/generationTime`: Fecha/hora actual en formato ISO 8601 (-4h offset).
   * `header/expirationTime`: Fecha/hora actual + 12 horas.
   * `service`: Servicio web de destino (`sigsa` o `ws_sr_padron_a13` / `sita`).
2. El XML se firma digitalmente creando un envoltorio **CMS / PKCS#7 (Cryptographic Message Syntax)** codificado en Base64 mediante la clave privada y el certificado `.crt`.
3. Se invoca al Web Service SOAP de WSAA (`https://wsaa.afip.gov.ar/ws/services/LoginCms` en producción o `https://wsaahomo.afip.gov.ar/ws/services/LoginCms` en homologación).
4. **Respuesta de WSAA:** Retorna un XML `LoginTicketResponse` que contiene:
   * `<token>`: Cadena alfanumérica de sesión.
   * `<sign>`: Firma digital de autenticación.
5. **Caché y Validez:**
   * El Ticket de Acceso (TA) tiene una vigencia por defecto de **12 horas**.
   * ApiTrace debe almacenar en caché el par `Token` + `Sign` asociado al CUIT y Servicio.
   * **REGLA CRÍTICA:** Un mismo Computador Fiscal no puede solicitar múltiples tickets activos simultáneos para el mismo webservice dentro del período de validez. Se debe reutilizar el TA activo hasta su expiración.

### 3.3 Delegación de Servicios vía ADMINREL (Administrador de Relaciones)
Si el sistema ApiTrace pertenece a una empresa brindadora de servicios de software (Tercero) que operará en nombre de múltiples apicultores:
1. El Apicultor (Dador / Representado) ingresa a ARCA con Clave Fiscal al servicio **"Administrador de Relaciones de Clave Fiscal"**.
2. Selecciona **"Nueva Relación"**, elige el servicio `SIGSA` o `Trazabilidad Apícola`, e ingresa la CUIT del Representante (Empresa de software o Computador Fiscal).
3. Se emite el Formulario **F3283/E (Constancia de Delegación)**.
4. El Representante ingresa a su propio Administrador de Relaciones, acepta la delegación y la asigna a su **Computador Fiscal** habilitado.
5. **REGLA DE SUBDELEGACIÓN:** Un servicio delegado como "Usuario Externo" no puede volver a delegarse en cadena a otra empresa; sólo se autoriza directamente a un Computador Fiscal de la firma receptora.

---

## 4. MÓDULO TÉCNICO DE GENERACIÓN Y CONTENIDO DEL DT-e (API-SEM)

El **Documento de Tránsito electrónico (DT-e)** es el documento oficial obligatorio que ampara el traslado de alzas melarias desde el apiario de producción hasta la sala de extracción.

```
+-----------------------------------------------------------------------------------+
|                        ESTRUCTURA DE DATOS DEL DT-e (API-SEM)                     |
+-----------------------------------------------------------------------------------+
| 1. ORIGEN (Apiario)          | RENAPA-Apiario (ej. B53999-2) - Estado: ACTIVO    |
| 2. DESTINO (Sala Extracción) | Código SEF (ej. SEF-B-20010)  - Estado: HABILITADO|
| 3. PRODUCTO DECLARADO        | Alzas Melarias (Código 24.45) - Unidad: Unidades   |
| 4. CANTIDAD DECLARADA (Qdecl)| Cantidad Holgada/Estimada (ej. Qdecl = 100)       |
| 5. FECHAS Y VIGENCIA         | Carga = Fecha Cosecha | Vencimiento = Carga + 2a4d |
| 6. LOGÍSTICA / TRANSPORTE    | Tipo Vehículo, Patente Chasis/Acoplado (Sin SENASA)|
+-----------------------------------------------------------------------------------+
```

### 4.1 Definición Parámetros de Entrada para el Trámite
Al generar un movimiento en SIGSA para apicultura, el sistema ApiTrace debe enviar de forma rígida los siguientes parámetros:

| Campo en Sistema Central | Valor Requerido / Regla de Negocio | Descripción Técnica |
| :--- | :--- | :--- |
| **Tipo de Movimiento** | `API-SEM` | Apiarios a Sala de Extracción de miel. |
| **Motivo de Tránsito** | `Extracción de miel` | Razón del movimiento de subproductos. |
| **Establecimiento Origen**| `RENAPA-Apiario` | Identificador alfanumérico formato `Letra-N°Renapa-N°Apiario` (ej. `B53999-2`). Debe poseer habilitación vigente en SENASA. |
| **Establecimiento Destino**| `Código de Sala` | Código de Sala de Extracción formato `SEF-Letra-N°` (ej. `SEF-B-20010`). La sala debe estar inscripta y habilitada. |
| **Producto** | `Alzas melarias` | Categoría de producto / subproducto apícola (Código interno 24.45). |
| **Cantidad Declarada ($Q_{declarada}$)** | Entero positivo elevado | Número estimado de alzas. **Ver Regla de Carga.** |
| **Unidad de Medida** | `Unidad/es` | Única unidad aceptada para alzas. |
| **Fecha de Carga** | `YYYY-MM-DD` | Fecha estimada de cosecha/carga ("Fecha de carga de animales" en interfaz SIGSA). |
| **Fecha de Vencimiento** | `YYYY-MM-DD` | Asignada por defecto a 2 días; ampliable hasta un máximo de **4 días posteriores** a la fecha de carga. |
| **Precintos** | `NULO / Vacío` | **NO debe completarse** para el movimiento API-SEM. |
| **Datos de Transporte** | Tipo y Patente | Tipo (Camión, Camioneta, Furgón), Patente chasis y acoplado. No requiere habilitación de transporte SENASA. |

### 4.2 Reglas Críticas de Negocio para la Generación

1. **REGLA DE SOBREESTIMACIÓN DE ALZAS DECLARADAS ($Q_{declarada}$):**
   * En el campo, el apicultor no conoce con exactitud el número exacto de alzas a cosechar hasta finalizar la jornada.
   * **Instrucción de Sistema:** ApiTrace debe requerir una cantidad estimada y **sobreestimar el valor $Q_{declarada}$** (ej. si el apicultor estima 50 alzas, declarar 80 o 100).
   * **Fundamento Legal:** La sala de extracción en destino sólo puede confirmar una cantidad real $Q_{real} \le Q_{declarada}$. Si $Q_{real} > Q_{declarada}$, el sistema rechaza el cierre y el trámite debe ser anulado.
   * **Tipos de Alzas:** El sistema no distingue entre alzas enteras, medias alzas o 3/4 alzas; todas se computan homogéneamente como "Unidades".

2. **REGLA DE VERIFICACIÓN DE REQUISITOS PREVIOS:**
   * Tanto el RENAPA de origen como la Sala de Extracción de destino deben estar en estado **"ACTIVO / HABILITADO"**.
   * Si cualquiera de los dos presenta suspensión o vencimiento, la API de SIGSA bloquea la emisión. ApiTrace debe validar previamente estos estados mediante los padrones de SENASA antes de enviar la solicitud.

3. **ANTICIPACIÓN DE EMISIÓN:**
   * El DT-e puede emitirse digitalmente por autogestión hasta con **4 días de anticipación** a la fecha de carga declarada (o hasta 7 días si se gestiona presencialmente en Oficina Local SENASA).

---

## 5. MÁQUINA DE ESTADOS DEL DT-e Y REGLAS DE TRÁNSITO

El DT-e posee un ciclo de vida estricto basado en timestamps y acciones de los actores.

```
+--------------+      Fecha Carga      +--------------+     Cierre en Sala     +--------------+
|   EMITIDO    | --------------------> |   VIGENTE    | ---------------------> |   CERRADO    |
| (No Transita)|                       | (Apto Ruta)  |                        | (Stock SITA) |
+------+-------+                       +------+-------+                        +--------------+
       |                                      |
       | Cancela s/mov                        | Transcurridos 2 a 4 días sin cierre
       v                                      v
+--------------+                       +--------------+     + 4 días más       +--------------+
| ANULADO /    |                       |   VENCIDO    | ---------------------> |  CADUCADO    |
| ELIMINADO    |                       | (No Transita)|                        | (Bloqueo CUIT|
+--------------+                       +--------------+                        +--------------+
```

### 5.1 Matriz de Estados y Definiciones Operativas

| Estado del DT-e | Ventana Temporal / Condición | Permite Transitar | Implicancia Operativa |
| :--- | :--- | :--- | :--- |
| **EMITIDO** | Desde la creación hasta el día previo a la `Fecha de Carga` (máx 4 días antes). | **NO** | Documento registrado pero inactivo. El camión no puede circular. |
| **VIGENTE** | Desde las 00:00 hs de la `Fecha de Carga` hasta las 23:59 hs de la `Fecha de Vencimiento` (2 a 4 días transcurridos). | **SÍ (ÚNICO)** | **Único estado válido para transitar en ruta.** Debe llevarse la representación gráfica **IMPRESA**. |
| **CERRADO** | La Sala de Extracción registró la recepción en SITA e ingresó la cantidad real de alzas $Q_{real}$. | **NO** (Carga recibida) | Trámite finalizado exitosamente. Alzas integradas al stock de la sala. |
| **VENCIDO** | Expiró la `Fecha de Vencimiento` sin que la sala haya realizado el cierre. Se dispone de un periodo de gracia de 4 días. | **NO** | Alerta crítica. El documento está fuera de plazo pero aún permite cierre extemporáneo. |
| **CADUCADO** | Pasaron 4 días posteriores a la fecha de vencimiento sin cerrarse. | **NO** | **Sanción administrativa.** El productor queda **bloqueado e inhabilitado** en SIGSA para emitir nuevos DT-e. |
| **SIN ARRIBO**| La sala de extracción declara explícitamente en SITA que la carga nunca llegó a la planta. | **NO** | Genera sumario administrativo e inspección sobre la trazabilidad. |
| **ANULADO** | El usuario cancela el DT-e emitido habiendo abonado el arancel antes de transitar. | **NO** | Se invalida el número de DT-e. |
| **ELIMINADO**| El usuario cancela el DT-e emitido sin haber abonado arancel antes de transitar. | **NO** | Se borra el borrador/solicitud. |

### 5.2 Regla de Exceso de Carga y Anulación Obligatoria
* **Escenario:** El apicultor declaró $Q_{declarada} = 50$ alzas en el DT-e. Al cosechar en el campo y llegar a la sala de extracción, se descargan físicamente $Q_{real} = 60$ alzas.
* **Resultado del Sistema:** SITA **rechaza automáticamente** la carga del cierre por superar el límite declarado ($Q_{real} > Q_{declarada}$).
* **Procedimiento Obligatorio:**
  1. No se permite realizar la descarga ni el inicio de extracción de ese lote.
  2. El apicultor/gestor debe ingresar inmediatamente a ApiTrace / SIGSA y **ANULAR el DT-e actual**.
  3. Emitir un **NUEVO DT-e** corrigiendo la cantidad declarada a $Q_{declarada} \ge 60$ alzas.
  4. La sala de extracción procede a consultar y cerrar el nuevo DT-e.

---

## 6. MÓDULO DE RECEPCIÓN Y CIERRE EN SALA DE EXTRACCIÓN (SITA)

Una vez que el transporte arriba a la sala de extracción con el DT-e impreso, se ejecuta la recepción y cierre en la plataforma **SITA (Sistema de Trazabilidad Apícola)** de SENASA.

```
+-----------------------------------------------------------------------------------+
|               PROCEDIMIENTO DE CIERRE DE DT-e EN SALA (SITA)                      |
+-----------------------------------------------------------------------------------+
| 1. CONSULTA DT-e     | Ingresa N° DT-e completo (ej. 022440451-4) +              |
|                      | Código de Cierre / Verificador impreso en el documento.   |
| 2. VERIFICACIÓN      | Valida CUIT Origen, RENAPA, Sala Destino y Estado VIGENTE. |
| 3. DECLARACIÓN ARRIBO| Ingresa Fecha de Arribo real y Alzas Confirmadas (Qreal).  |
|                      | REGLA: Qreal debe ser STRICTAMENTE <= Qdeclarada.          |
| 4. CONFIRMACIÓN      | Presiona "Cerrar DT-e". Estado cambia a CERRADO.           |
| 5. LIBERACIÓN        | Sistema habilita el botón "Iniciar Extracción" en SITA.   |
+-----------------------------------------------------------------------------------+
```

### 6.1 Datos Requeridos para la Invocación de Cierre
Para realizar el cierre del DT-e, el operador de la sala requiere los datos del documento impreso:
1. **Número completo de DT-e:** Incluye prefijo de oficina y correlativo con dígito verificador (ej. `022440451-4`).
2. **Código de Cierre (Código Verificador):** Clave alfanumérica única impresa en la parte inferior del documento impreso de control (ej. `790112`).
3. **Fecha de Arribo:** Día efectivo de recepción de la carga en la planta.
4. **Alzas Confirmadas ($Q_{real}$):** Conteo físico real de alzas melarias recibidas.

### 6.2 Habilitación del Proceso de Extracción
* Al confirmarse el cierre con éxito:
  * El estado del DT-e en SIGSA pasa a **CERRADO**.
  * El sistema emite la confirmación: `"Éxito - Registro guardado correctamente"`.
  * Se habilita en la plataforma el botón **"Iniciar Extracción"**.
  * Las alzas ingresadas quedan formalmente vinculadas en SITA al código de la Sala de Extracción, permitiendo la generación del **Lote de Extracción** y la asignación de tambores de miel.

---

## 7. MODELO DE TRAZABILIDAD INTEGRAL (COLMENA -> PORCIONADO)

El sistema ApiTrace extiende la trazabilidad desde el origen de la materia prima hasta el producto final disponible para el consumidor.

```
  +-----------------------+
  | APIARIO / COLMENA     |  * Marcado Fuego/Fresado de alzas con N° RENAPA.
  | (RENAPA B53999-2)     |  * Registro de cosecha por colmena/lote en App.
  +-----------+-----------+
              |
              | DT-e API-SEM (Movimiento en tránsito - Estado VIGENTE)
              v
  +-----------------------+
  | SALA DE EXTRACCIÓN    |  * Cierre DT-e en SITA con Código de Cierre + Qreal.
  | (SEF-B-20010)         |  * Iniciar Extracción -> Asignación Lote de Extracción.
  +-----------+-----------+
              |
              | Lote de Extracción
              v
  +-----------------------+
  | TAMBORES DE MIEL      |  * Código de Tambor / Código de Barras Único SENASA.
  | (Homogeneizado/Acopio)|  * Análisis de Laboratorio (Humedad, Color, Inocuidad).
  +-----------+-----------+
              |
              | Lote de Fraccionamiento
              v
  +-----------------------+
  | MIEL FRACCIONADA /    |  * Envases fraccionados / Porcionados con Código QR.
  | PORCIONADA (CONSUMO)  |  * Escaneo QR -> Árbol de Trazabilidad Completo.
  +-----------------------+
```

### 7.1 Cadena de Custodia y Reglas de Trazabilidad
1. **Identificación Física de Origen:**
   * Las alzas melarias deben estar identificadas físicamente en el campo mediante grabado a fuego, fresado o tinta indeleble con el número de **RENAPA** del apicultor.
2. **Transformación en Sala de Extracción:**
   * El cierre del DT-e convierte el número de alzas $Q_{real}$ en un volumen equivalente de miel cruda expresado en kilogramos.
   * El sistema asocia el conjunto de DT-e cerrados al ID del **Lote de Extracción**.
3. **Fraccionamiento y Llenado de Tambores:**
   * Cada tambor de miel (200 litros / ~300 kg) se etiqueta con un identificador único (QR / Barcode) enlazado al Lote de Extracción y a los RENAPAs de origen.
4. **Fraccionamiento Secundario y Miel Porcionada:**
   * Al procesar los tambores para su fraccionamiento en frascos, sachets o porciones individuales, ApiTrace genera un **Lote de Fraccionamiento Final**.
   * Cada producto porcionado contiene un **Código QR dinámico** que permite al consumidor final o inspector sanitario escanear el envase y visualizar el árbol completo de trazabilidad:
     * RENAPA y ubicación del apiario de origen.
     * Número de DT-e y fecha de tránsito.
     * Sala de extracción certificada y fecha de procesamiento.
     * Número de Tambor y análisis de inocuidad.

---

## 8. ESPECIFICACIÓN DE INGENIERÍA DE SOFTWARE PARA APITRACE

### 8.1 Modelo de Datos Relacional (Base de Datos / DDL)

A continuación se define el esquema ER simplificado en MySQL / PostgreSQL para implementar en la base de datos central de ApiTrace:

```sql
-- Tabla de Productores Apícolas
CREATE TABLE productores (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    cuit VARCHAR(11) NOT NULL UNIQUE,
    renapa_numero VARCHAR(50) NOT NULL UNIQUE,
    razon_social VARCHAR(150) NOT NULL,
    email VARCHAR(100) NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabla de Apiarios
CREATE TABLE apiarios (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    productor_id BIGINT UNSIGNED NOT NULL,
    codigo_apiario VARCHAR(50) NOT NULL, -- Formato Letra-Renapa-Apiario (ej. B53999-2)
    alias_fantasia VARCHAR(100) NOT NULL, -- Ej. "El Totoral - Lote Norte"
    latitud DECIMAL(10, 8),
    longitud DECIMAL(11, 8),
    vigente_hasta DATE NOT NULL,
    estado_habilitacion VARCHAR(20) DEFAULT 'ACTIVO',
    FOREIGN KEY (productor_id) REFERENCES productores(id) ON DELETE CASCADE,
    UNIQUE KEY uk_apiario (productor_id, codigo_apiario)
);

-- Tabla de Salas de Extracción
CREATE TABLE salas_extraccion (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    codigo_sala VARCHAR(50) NOT NULL UNIQUE, -- Formato SEF-Letra-N° (ej. SEF-B-20010)
    denominacion VARCHAR(150) NOT NULL,
    cuit_titular VARCHAR(11) NOT NULL,
    provincia VARCHAR(50) NOT NULL,
    localidad VARCHAR(100) NOT NULL,
    estado_habilitacion VARCHAR(20) DEFAULT 'HABILITADO'
);

-- Tabla de Certificados Digitales (ARCA)
CREATE TABLE certificados_digitales (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    productor_id BIGINT UNSIGNED NOT NULL,
    alias VARCHAR(50) NOT NULL,
    certificate_pem TEXT NOT NULL,
    private_key_encrypted TEXT NOT NULL, -- Cifrado AES-256-CBC
    expira_at DATETIME NOT NULL,
    FOREIGN KEY (productor_id) REFERENCES productores(id) ON DELETE CASCADE
);

-- Tabla de Trámites DT-e
CREATE TABLE tramites_dte (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid_local VARCHAR(36) NOT NULL UNIQUE, -- Id único local para sincronización offline
    productor_id BIGINT UNSIGNED NOT NULL,
    apiario_id BIGINT UNSIGNED NOT NULL,
    sala_id BIGINT UNSIGNED NOT NULL,
    tipo_movimiento VARCHAR(20) DEFAULT 'API-SEM',
    motivo_transito VARCHAR(50) DEFAULT 'Extracción de miel',
    producto_codigo VARCHAR(20) DEFAULT '24.45', -- Alzas Melarias
    cantidad_alzas_declaradas INT UNSIGNED NOT NULL,
    cantidad_alzas_reales INT UNSIGNED NULL, -- Completado al cerrar en SITA
    fecha_carga DATETIME NOT NULL,
    fecha_vencimiento DATETIME NOT NULL,
    numero_dte VARCHAR(50) NULL, -- Retornado por SIGSA (ej. 022440451-4)
    codigo_verificador VARCHAR(20) NULL, -- Código de cierre impreso
    estado VARCHAR(20) DEFAULT 'EMITIDO', -- EMITIDO, VIGENTE, CERRADO, VENCIDO, CADUCADO, ANULADO
    transporte_tipo VARCHAR(50),
    transporte_patente_chasis VARCHAR(15),
    transporte_patente_acoplado VARCHAR(15),
    pdf_path VARCHAR(255) NULL,
    FOREIGN KEY (productor_id) REFERENCES productores(id),
    FOREIGN KEY (apiario_id) REFERENCES apiarios(id),
    FOREIGN KEY (sala_id) REFERENCES salas_extraccion(id)
);

-- Historial de Estados del DT-e (Auditoría Sanitara)
CREATE TABLE tramites_estados_log (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tramite_id BIGINT UNSIGNED NOT NULL,
    estado_anterior VARCHAR(20),
    estado_nuevo VARCHAR(20) NOT NULL,
    motivo_cambio VARCHAR(255),
    usuario_accion VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tramite_id) REFERENCES tramites_dte(id) ON DELETE CASCADE
);

-- Tabla de Lotes de Extracción y Trazabilidad de Miel
CREATE TABLE lotes_extraccion (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sala_id BIGINT UNSIGNED NOT NULL,
    codigo_lote VARCHAR(50) NOT NULL UNIQUE,
    fecha_inicio_extraccion DATETIME NOT NULL,
    fecha_fin_extraccion DATETIME NULL,
    kilos_totales_obtenidos DECIMAL(10,2) DEFAULT 0.00,
    FOREIGN KEY (sala_id) REFERENCES salas_extraccion(id)
);

-- Relación N:M entre DT-e y Lote de Extracción
CREATE TABLE lote_dte_vinculacion (
    lote_id BIGINT UNSIGNED NOT NULL,
    tramite_id BIGINT UNSIGNED NOT NULL,
    alzas_procesadas INT UNSIGNED NOT NULL,
    PRIMARY KEY (lote_id, tramite_id),
    FOREIGN KEY (lote_id) REFERENCES lotes_extraccion(id),
    FOREIGN KEY (tramite_id) REFERENCES tramites_dte(id)
);

-- Tabla de Tambores de Miel
CREATE TABLE tambores_miel (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    lote_id BIGINT UNSIGNED NOT NULL,
    codigo_tambor_qr VARCHAR(100) NOT NULL UNIQUE,
    peso_bruto DECIMAL(6,2) NOT NULL,
    peso_tara DECIMAL(5,2) NOT NULL,
    peso_neto DECIMAL(6,2) NOT NULL,
    grado_humedad DECIMAL(4,2),
    color_mm_pfund INT,
    FOREIGN KEY (lote_id) REFERENCES lotes_extraccion(id)
);

-- Tabla de Fraccionamiento y Miel Porcionada
CREATE TABLE lotes_porcionado (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    codigo_lote_porcionado VARCHAR(50) NOT NULL UNIQUE,
    fecha_empaque DATE NOT NULL,
    presentacion_gramos INT NOT NULL, -- ej. 250g, 500g, 1000g
    unidades_producidas INT NOT NULL
);

CREATE TABLE porcionado_tambor_vinculo (
    lote_porcionado_id BIGINT UNSIGNED NOT NULL,
    tambor_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (lote_porcionado_id, tambor_id),
    FOREIGN KEY (lote_porcionado_id) REFERENCES lotes_porcionado(id),
    FOREIGN KEY (tambor_id) REFERENCES tambores_miel(id)
);
```

### 8.2 Endpoints REST de la API de ApiTrace

#### Endpoint 1: Crear Solicitud / Emitir DT-e (Sincronización Mobile -> Backend -> SIGSA)
* **HTTP Method:** `POST`
* **Ruta:** `/api/v1/tramites/dte`
* **Headers:** `Authorization: Bearer <JWT_TOKEN>`, `Content-Type: application/json`
* **Request Payload Example:**
```json
{
  "uuid_local": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "productor_id": 15,
  "apiario_id": 42,
  "sala_id": 8,
  "cantidad_alzas_declaradas": 80,
  "fecha_carga": "2026-03-20 07:00:00",
  "fecha_vencimiento": "2026-03-22 23:59:59",
  "transporte": {
    "tipo": "Camioneta",
    "patente_chasis": "AA123BC",
    "patente_acoplado": "NO"
  }
}
```
* **Response Payload Example (201 Created):**
```json
{
  "status": "success",
  "message": "Trámite registrado y despachado a la cola de emisión gubernamental",
  "data": {
    "tramite_id": 1024,
    "uuid_local": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "estado_actual": "EMITIDO",
    "proceso_asincrono_job_id": "job_sigsa_884920"
  }
}
```

#### Endpoint 2: Cierre de DT-e en Sala de Extracción (Integración SITA)
* **HTTP Method:** `POST`
* **Ruta:** `/api/v1/sita/dtes/cierre`
* **Headers:** `Authorization: Bearer <JWT_TOKEN>`, `Content-Type: application/json`
* **Request Payload Example:**
```json
{
  "numero_dte": "022440451-4",
  "codigo_cierre": "790112",
  "fecha_arribo": "2026-03-20 18:30:00",
  "alzas_confirmadas_real": 65
}
```
* **Response Payload Example (200 OK):**
```json
{
  "status": "success",
  "message": "Éxito-Registro guardado correctamente. DT-e Cerrado.",
  "data": {
    "numero_dte": "022440451-4",
    "estado": "CERRADO",
    "alzas_recibidas": 65,
    "habilitado_iniciar_extraccion": true
  }
}
```
* **Response Payload Example (422 Unprocessable Entity - Regla de Carga Excedida):**
```json
{
  "status": "error",
  "error_code": "EXCESO_CANTIDAD_DECLARADA",
  "message": "Error: La cantidad real de alzas (85) supera la cantidad declarada en el DT-e (50). Debe anular el DT-e actual y generar uno nuevo antes de proceder a la descarga.",
  "data": {
    "cantidad_declarada": 50,
    "cantidad_intentada": 85
  }
}
```

#### Endpoint 3: Consulta Pública de Trazabilidad para Miel Porcionada (Consumidor QR)
* **HTTP Method:** `GET`
* **Ruta:** `/api/v1/trazabilidad/publica/porcionado/{codigo_qr}`
* **Response Payload Example (200 OK):**
```json
{
  "producto": "Miel Orgánica Multifloral Porcionada 250g",
  "lote_porcionado": "POR-2026-0091",
  "fecha_envasado": "2026-03-25",
  "origen_apicola": {
    "productor": "Apícola El Sol S.A.",
    "renapa": "B53999",
    "apiario_origen": "El Totoral - Loma Alta (B53999-2)",
    "provincia": "Buenos Aires",
    "pais": "Argentina"
  },
  "cadena_custodia": {
    "dte_numero": "022440451-4",
    "fecha_cosecha": "2026-03-20",
    "sala_extraccion": "SEF-B-20010 - Planta San Miguel",
    "lote_extraccion": "EXT-2026-044",
    "tambor_identificador": "TAMB-88391-2026",
    "analisis_calidad": {
      "humedad_porcentaje": 17.2,
      "color_pfund_mm": 34,
      "estado_inocuidad": "CONFORME / CERTIFICADO SENASA"
    }
  }
}
```

---

## 9. CHECKLIST DE VALIDACIÓN PARA EL MODELO DE IA / DESARROLLADOR

Al implementar el módulo informático de **ApiTrace**, la IA o desarrollador debe verificar el cumplimiento del siguiente checklist de pruebas de integración:

- [ ] **Firma Criptográfica WSAA:** Verificar que la fecha de generación del CMS firmada utilice un offset UTC correcto (-04:00) y que los tickets de acceso se almacenen en caché por 12 horas.
- [ ] **Validación de Origen/Destino:** Verificar que previo al envío a SIGSA se consulte el estado del RENAPA y el código SEF de la Sala de Extracción.
- [ ] **Regla $Q_{declarada} \ge Q_{real}$:** Asegurar que en la interfaz mobile exista un microcopy explícito sugiriendo sobredimensionar las alzas declaradas para evitar anulaciones en planta.
- [ ] **Semáforo de Tránsito:** Prohibir el inicio del viaje si el DT-e se encuentra en estado `EMITIDO` y cambiar a verde brillante únicamente cuando pase a `VIGENTE`.
- [ ] **Impresión Física:** Recordar al usuario la obligatoriedad de imprimir el papel físico del DT-e para llevarlo en la cabina del vehículo de carga.
- [ ] **Cierre en SITA:** Confirmar que la sala de extracción ingrese el código de cierre alfanumérico y la fecha de arribo para liberar la opción de iniciar extracción.
- [ ] **Mapeo de QR Porcionado:** Asegurar que la tabla relacional conecte sin interrupciones la CUIT del apicultor, el número de RENAPA, el ID del DT-e, el Lote de Extracción y el Código QR impreso en el producto fraccionado.
