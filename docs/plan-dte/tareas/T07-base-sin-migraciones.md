# T07 · Base sin historial de migraciones (condicional)

**Objetivo:** que el migrador aplique sólo `0002` en una base que se creó con
`drizzle-kit push`.

**Se hace SÓLO si** la consulta D0a de T01 falló con
`relation "drizzle.__drizzle_migrations" does not exist`.

## Precondiciones

- T01 cumplido, con ese error confirmado.
- Respaldo de T00 creado.

## Pasos

1. Neon → **SQL Editor** → base de producción.
2. Pegar **todo** el archivo `docs/plan-dte/sql/registrar-migraciones-push.sql` y ejecutar.
3. Volver a correr la consulta D0a del diagnóstico.

## Salida esperada

- El script termina con `COMMIT` y devuelve dos filas: `0000_init` y `0001_dte_api_sem`.
- D0a ahora devuelve esas dos filas.

Si el script se detiene con
`drizzle.__drizzle_migrations ya tiene filas: la base usa el migrador`, esta tarea no
correspondía: la base sí tiene historial. No forzar nada; volver a T01 y revisar D0a.

## Verificación (gate)

- [ ] D0a devuelve exactamente dos filas, con `created_at` `1787677742317` y `1787677842317`.
- [ ] La base sigue teniendo sus datos (`SELECT count(*) FROM dte;` igual que antes).

## Qué NO hacer

- No correr este script en una base que ya tiene historial de migraciones.
- No insertar a mano una fila para `0002`: eso haría que la reparación **no** se aplique
  y el sistema quedaría con el esquema viejo y el código nuevo.
- No borrar el esquema `drizzle` para "empezar de cero".
