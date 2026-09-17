# ApiTrace

Plataforma de trazabilidad apícola argentina. Permite reconstruir la historia de
un producto apícola desde su origen productivo hasta sus etapas posteriores, y
responder dos preguntas sobre datos reales:

> ¿De qué apiario, de qué RENSPA y de qué productor vino la miel de este tambor?

> ¿Dónde terminó la producción de este apiario?

El proyecto se llama **ApiTrace**. Algunos identificadores todavía llevan el
nombre anterior, `ApiTrace`, porque cambiarlos tiene consecuencias fuera de la
documentación: los usuarios y la contraseña del seed, el dominio de los correos
de prueba, los nombres de dos documentos, y los servicios de Render
(`apitrace-api`, `apitrace-web`), cuyo renombrado cambiaría sus URL. Están
citados tal como son para que lo que dice este README siga siendo cierto.

---

## Estado

| Componente | Estado |
|---|---|
| **Backend** (API REST) | Construido y verificado — 39 tests e2e contra PostgreSQL real, 17 unitarios |
| **Frontend** (web instalable con modo offline) | Construido y verificado — 15 tests de la capa offline, prueba de navegador de punta a punta |
| **Base de datos** | Neon (PostgreSQL gestionado — hoy 18.6) |
| **Despliegue** | Render — blueprint en `render.yaml` |
| Integración SENASA/SIGSA, ARCA, SIFeGA | Preparada, no implementada (iteraciones 2 y 3) |

---

## Estructura del repositorio

```
ApiTrace/
├── 00-Documento_de_Vision...md          Problema, usuarios y objetivos
├── 01-Mapa_del_Dominio...md             Modelo conceptual y reglas de modelado
├── 02-Casos_de_Uso...md                 Análisis funcional por caso de uso
├── 03-ArquitecturaTecnica...md          Arquitectura de referencia
├── 04-MVP-ApiTrace.md                   Alcance, modelo de datos, contrato, riesgos
├── 05-ADR-Decisiones-Tecnicas.md        Decisiones que se apartan del doc 03
├── 06-Guia-de-Pantallas-ApiTrace.md     Catálogo visual y funcional v2.0 de pantallas y capturas
├── 07-Rediseno-UX-UI-ApiTrace.md        Diagnóstico, arquitectura UX/UI y sistema de componentes
├── 08-Iteraciones-Futuras-y-Roadmap...  Hoja de ruta tecnológica, integraciones oficiales e IoT
├── backend/                             API REST · NestJS + Drizzle + PostgreSQL
├── frontend/                            Web instalable (PWA) · React 19 + Vite 6
├── landing/                             Landing page estática promocional y SEO
├── render.yaml                          Blueprint de despliegue en Render
└── .github/workflows/ci.yml             Build y tests de ambos proyectos
```

---

## Arranque rápido

```bash
# 1. Backend
cd backend
cp .env.example .env       # pegar la cadena de Neon y generar los secretos JWT
npm install
npm run db:migrate
npm run db:seed            # carga la cadena de demostración completa
npm run start:dev          # API en :3000 · OpenAPI en /docs

# 2. Frontend (en otra terminal)
cd frontend
npm install
npm run dev                # aplicación en :5173
```

Usuarios del seed — contraseña `ApiTrace2026!`:

| Correo | Rol |
|---|---|
| `admin@apitrace.test` | ADMIN — ve todas las organizaciones |
| `productor@apitrace.test` | PRODUCTOR |
| `sala@apitrace.test` | SALA |
| `acopio@apitrace.test` | ACOPIADOR |
| `auditor@apitrace.test` | AUDITOR — solo lectura, alcance global |

---

## Las cinco separaciones que el modelo no negocia

El mapa del dominio fija reglas que la implementación respeta en el esquema, en
la API y en las pruebas:

| Se separa | De | Por qué importa |
|---|---|---|
| Productor | RENAPA | Un productor puede existir sin RENAPA vigente |
| RENAPA | RENSPA | Registran cosas distintas: la actividad y el par titular-predio |
| RENSPA | Apiario | El RENSPA identifica el predio; el apiario es una unidad dentro de él |
| **Movimiento** | **DT-e** | El movimiento es del dominio; el DT-e es un documento que puede cambiar |
| Lote | Tambor | El lote es lógico, el tambor físico; se validan entre sí pero no son lo mismo |

---

## Tres decisiones que conviene conocer

**La normativa es dato, no código.** La tabla `movement_rule` define qué
traslados exigen documento, con vigencia. La obligatoriedad del DT-e para
material melario apiario → sala rige desde el 01/08/2026, y la evaluación usa
**la fecha del traslado, no la de carga**: un movimiento del 15/07/2026 cargado
hoy no exige DT-e, porque entonces la norma no regía. Un cambio normativo es un
`INSERT`, no un despliegue.

**La trazabilidad informa lo que falta.** Cada consulta devuelve `gaps`: lote sin
origen, movimiento sin el documento exigido, DT-e sin sincronizar con SIGSA,
recepción con diferencia de cantidad. En operación real la cadena rara vez está
completa, y presentarla como cerrada sería peor que no mostrarla.

**El campo no tiene señal.** La aplicación web es instalable y funciona sin
conexión: las lecturas salen del almacenamiento local con aviso de antigüedad, y
las escrituras entran en una cola con clave de idempotencia generada en el
dispositivo, de modo que reenviarlas nunca duplica un movimiento.

---

## Documentación

| Documento | Para qué |
|---|---|
| `04-MVP-ApiTrace.md` | Alcance cerrado, modelo de datos, máquinas de estado, contrato y riesgos |
| `05-ADR-Decisiones-Tecnicas.md` | Por qué la implementación se aparta del documento 03 donde lo hace |
| `backend/README.md` | Operación de la API: comandos, arquitectura interna, despliegue |
| `frontend/README.md` | Cómo funciona el modo offline y la instalación en dispositivo |
