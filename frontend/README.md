# ApiTrace Web

Aplicación web instalable (PWA) de ApiTrace. React + TypeScript sobre Vite,
pensada para funcionar **sin conexión** en el campo y sincronizar sola al
recuperar señal.

---

## Puesta en marcha local

Requiere el backend corriendo en `http://localhost:3000`.

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

En desarrollo, Vite envía `/api` al backend local, así que no hay que configurar
CORS ni `VITE_API_URL`.

Para probar el build de producción **con su service worker real**:

```bash
npm run build
npm run preview      # http://localhost:4173, con el mismo proxy hacia /api
```

El service worker solo se registra en el build de producción: en `dev` está
deshabilitado a propósito, porque un service worker cacheando durante el
desarrollo produce recargas que muestran código viejo.

---

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm run build` | Verificación de tipos + build de producción + PWA |
| `npm run preview` | Sirve el build con proxy hacia la API local |
| `npm test` | Tests de la capa offline (cola, caché, idempotencia) |
| `npm run typecheck` | Solo verificación de tipos |

---

## Cómo funciona el modo offline

Tres piezas, cada una resolviendo un problema distinto:

**1. El service worker precachea la aplicación.** Workbox guarda el HTML, el JS
y el CSS en la primera visita. Así la aplicación **abre** sin red — que es la
diferencia entre una web común y una instalable.

**2. Las lecturas se guardan en IndexedDB, no en el caché del service worker.**
La estrategia es *red primero con respaldo local*: se prefiere el servidor,
porque la trazabilidad debe reflejar el estado real, y el caché es la red de
seguridad. Cuando una respuesta sale del almacenamiento local, la interfaz lo
dice con la antigüedad del dato en lugar de presentarlo como fresco.

Se usa IndexedDB y no el caché de respuestas HTTP porque hace falta acceso
estructurado a los datos: un caché de respuestas no permite mezclar lo guardado
con lo que espera en la cola de envío.

**3. Las escrituras van a una cola con clave de idempotencia.** Cuando no hay
red, la operación se guarda en IndexedDB junto con una `Idempotency-Key`
generada en el dispositivo. Al reenviarla se usa **exactamente la misma clave**,
así que si el envío original sí llegó al servidor y solo se perdió la respuesta,
el reintento no crea un segundo movimiento. El backend reconoce la clave y
devuelve la respuesta original.

### Reglas de la cola

- **Se envía en orden de llegada.** Un lote puede depender de un movimiento
  encolado antes; alterar el orden rompería la cadena.
- **Un corte de red detiene el recorrido.** Seguir con el resto solo quemaría
  intentos cuando el problema es la conexión y no el contenido.
- **Un 4xx no se reintenta.** Es un error de validación o de permisos: el mismo
  pedido volvería a fallar igual, así que queda marcado para revisión manual en
  `/pending` en lugar de consumir reintentos en silencio.

El algoritmo vive en `src/lib/outbox.ts`, fuera de React, para poder probarlo
sin montar componentes. Es la pieza de la que depende que nada registrado en el
campo se pierda, y tiene sus propios tests.

### Qué pasa con la sesión

El token se guarda en `localStorage` y no solo en memoria, porque la aplicación
debe poder reabrirse sin red: si viviera solo en memoria, recargar la página en
el campo dejaría al usuario sin acceso ni siquiera a lo ya descargado. El riesgo
asumido es XSS, y se compensa con tokens de acceso cortos (30 minutos) y refresh
rotativo del lado del servidor.

**Iniciar sesión sí requiere conexión.** Una sesión ya iniciada sigue
funcionando offline; la primera autenticación no puede resolverse sin servidor.

---

## Instalación en el dispositivo

- **Android / escritorio:** el botón «Instalar aplicación» aparece en la barra
  superior cuando el navegador emite `beforeinstallprompt`.
- **iOS:** ese evento no existe, así que se muestra la instrucción manual
  (Compartir → «Agregar a inicio»), que es el único camino disponible.

Las actualizaciones se **ofrecen**, no se aplican solas: recargar sin avisar
mientras alguien completa un formulario de campo le haría perder lo cargado.

---

## Estructura

```
src/
├── lib/
│   ├── api.ts          Peticiones, refresh de sesión, caché y encolado
│   ├── db.ts           IndexedDB: caché de lecturas, cola de escrituras
│   ├── outbox.ts       Algoritmo de sincronización (probado aparte)
│   ├── auth.tsx        Sesión persistente
│   ├── sync.tsx        Estado de conexión y disparo de la sincronización
│   ├── useResource.ts  Lectura con respaldo local y aviso de dato viejo
│   └── types.ts        Contrato de la API
├── components/
│   ├── Layout.tsx      Navegación, indicadores de conexión y cola
│   ├── TraceGraph.tsx  Grafo de trazabilidad en SVG
│   ├── ui.tsx          Primitivas y formularios declarativos
│   ├── InstallPrompt.tsx
│   └── UpdatePrompt.tsx
└── pages/              Una por caso de uso del MVP
```

---

## Pantallas y casos de uso

| Ruta | Caso de uso |
|---|---|
| `/login` | CU-02 |
| `/` | Panel con estado de la operación |
| `/producers` | CU-04, CU-05 (RENAPA) |
| `/establishments` | CU-06 (RENSPA) |
| `/apiaries` | CU-07, CU-08 — con captura de coordenadas del dispositivo |
| `/movements` · `/movements/:id` | CU-09 a CU-12 |
| `/extractions` | CU-13 |
| `/lots` · `/lots/:id` | CU-14 a CU-16, CU-21 |
| `/drums` | CU-25 |
| `/trace` | CU-17, CU-18, CU-19 |
| `/rules` | Inspección de la normativa vigente |
| `/audit` | CU-34 |
| `/pending` | Cola de sincronización |

---

## Despliegue

Se despliega como **Static Site** en Render; el blueprint está en el
`render.yaml` de la raíz del repositorio. `VITE_API_URL` se inyecta desde el
servicio de la API, y una regla de reescritura devuelve el shell para cualquier
ruta — sin ella, recargar en `/movements` daría 404.

Las cabeceras de caché son deliberadas: los assets con hash se cachean para
siempre, y `sw.js` **nunca** se cachea. Si el service worker quedara cacheado,
los usuarios se clavarían en una versión vieja de la aplicación.
