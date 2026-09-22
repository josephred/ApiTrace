# T01 · Diagnóstico de la base real y resolución de bloqueos

**Objetivo:** dejar la base de producción en condiciones de recibir la migración
`0002_dte_reparacion`, resolviendo antes —con criterio humano— lo que la migración no puede
decidir sola.

## Precondiciones

- T00 cumplido (respaldo creado).
- `docs/plan-dte/sql/diagnostico-pre-0002.sql` disponible en el repositorio.

## Pasos

1. Abrir Neon → **SQL Editor** → seleccionar la base de producción.
2. Abrir `docs/plan-dte/sql/diagnostico-pre-0002.sql` y correr **una consulta por vez**
   (desde el comentario `-- Dn` hasta el punto y coma). Anotar el resultado de cada una.
   Alternativa por consola, con la cadena de conexión de producción:

   ```powershell
   psql "$env:DATABASE_URL" -f docs\plan-dte\sql\diagnostico-pre-0002.sql > diagnostico.txt
   ```

3. Interpretar:

   | Consulta | Resultado esperado | Si no |
   | :--- | :--- | :--- |
   | D0a | dos filas: `0000_init` y `0001_dte_api_sem` | Si da error `relation "drizzle.__drizzle_migrations" does not exist` → la base se creó con `push`: hacer **T07** antes de desplegar. Si hay una tercera fila desconocida, detener el plan y avisar. |
   | D0b / D0c | informativas | Anotar si `movement_rule` tiene `origin_type` (base del migrador) o `source_establishment_type` (base de `push`). |
   | D1 a D6 | **sin filas** | Con filas: aplicar la corrección que está comentada al final de ese bloque, decidiendo caso por caso, y volver a correr la consulta hasta que no devuelva filas. |
   | D7a | lista de DT-e que la migración va a marcar `ELIMINADO` | Revisar uno por uno que ninguno sea un DT-e real. Si alguno lo es, corregir su `issue_mode` o su número antes de migrar. |
   | D7b | conteos de lo que se corrige solo | Anotar los números: sirven para comprobar el resultado en T08. |
   | D8 | cuentas de demostración presentes | Anotar: es la entrada de T09. |

4. Cada corrección se hace **dentro de una transacción** y se vuelve a correr la consulta:

   ```sql
   BEGIN;
   -- (la corrección que indica el bloque Dn)
   COMMIT;
   ```

## Salida esperada

- D1, D2a, D3a, D3b, D4, D5a, D5b, D6a y D6b: `(0 rows)`.
- D7a con la lista revisada y aceptada.
- D0a con las migraciones registradas, o la confirmación de que hay que hacer T07.

## Verificación (gate)

- [ ] D1 a D6 sin filas.
- [ ] Lista de D7a revisada: ningún DT-e real va a quedar `ELIMINADO`.
- [ ] Anotado si hace falta T07.
- [ ] Anotados los conteos de D7b y las cuentas de D8.

## Qué NO hacer

- No borrar filas de `dte` para "limpiar": se marca `ELIMINADO` o `ANULADO` con motivo.
- No inventar el número ni el código de un DT-e para que pase la validación.
- No correr el diagnóstico sólo contra la base local: el que importa es el de producción.
- No seguir a T03 con bloqueos abiertos: la migración se va a detener igual, pero más tarde
  y con el despliegue a medio camino.
