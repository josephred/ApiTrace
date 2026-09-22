-- =============================================================================
-- diagnostico-pre-0002.sql
--
-- Consultas de SOLO LECTURA. Se corren contra la base real (Neon) ANTES de
-- desplegar la migracion backend/drizzle/0002_dte_reparacion.sql.
--
-- Para que sirve: 0002 corrige sola todo lo que se puede corregir sin decidir
-- nada (traduce estados, quita marcadores inventados, elimina borradores y
-- simulaciones duplicadas). Lo que necesita una decision humana la detiene con
-- un mensaje "0002_dte_reparacion: ... consulta Dn". Estas consultas muestran
-- esos casos ANTES del despliegue, para resolverlos con calma.
--
-- Como correrlas:
--   * Neon: Console > SQL Editor > elegir la base de ApiTrace > pegar UNA
--     consulta por vez (desde "-- Dn" hasta el punto y coma) > Run.
--   * psql: psql "$DATABASE_URL" -f docs/plan-dte/sql/diagnostico-pre-0002.sql
--
-- Resultado esperado para desplegar: D1 a D6 SIN FILAS. D0, D7 y D8 son
-- informativas (se leen, no bloquean).
--
-- No modifica nada. Las correcciones estan al final de cada bloque, comentadas,
-- con los valores a reemplazar entre <angulos>. Se corren a mano, una por una,
-- solo despues de decidir que hacer con cada caso.
--
-- Funciona en los tres puntos de partida posibles: base con 0000 y 0001
-- aplicadas por el migrador, base creada o sincronizada con drizzle-kit push,
-- y base que solo tiene 0000. Por eso lee algunas columnas con
-- to_jsonb(fila) ->> 'columna': si la columna no existe devuelve NULL en lugar
-- de fallar.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- D0. Punto de partida (informativa)
-- -----------------------------------------------------------------------------

-- D0a. Migraciones registradas. Esperado en produccion: 0000_init y
-- 0001_dte_api_sem. Si esta consulta falla con
-- 'relation "drizzle.__drizzle_migrations" does not exist', la base se creo con
-- drizzle-kit push: seguir docs/plan-dte/sql/registrar-migraciones-push.sql
-- antes de desplegar (si no, el migrador intenta crear todo de nuevo y falla).
SELECT id,
       created_at,
       CASE created_at
         WHEN 1787677742317 THEN '0000_init'
         WHEN 1787677842317 THEN '0001_dte_api_sem'
         WHEN 1789920000000 THEN '0002_dte_reparacion'
         ELSE 'desconocida: avisar antes de desplegar'
       END AS migracion
FROM drizzle.__drizzle_migrations
ORDER BY created_at;

-- D0b. Columnas que distinguen los puntos de partida.
--   movement_rule.origin_type          -> nombres de 0000 (migrador)
--   movement_rule.source_establishment_type -> base sincronizada con push
--   dte.load_date timestamp with time zone  -> 0001 aplicada
--   dte.load_date ausente                   -> solo 0000
SELECT table_name, column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (table_name, column_name) IN (
    ('movement_rule', 'origin_type'), ('movement_rule', 'source_establishment_type'),
    ('movement_rule', 'legal_reference'), ('movement_rule', 'legal_basis'),
    ('dte', 'status'), ('dte', 'load_date'), ('dte', 'issue_mode'), ('dte', 'declared_quantity'),
    ('apiary', 'renapa_code'), ('apiary', 'renapa_valid_to'),
    ('establishment', 'senasa_code'), ('establishment', 'senasa_valid_to')
  )
ORDER BY table_name, column_name;

-- D0c. Tablas que agrego 0001 (NULL = no existe todavia).
SELECT to_regclass('public.senasa_delegation') AS senasa_delegation,
       to_regclass('public.dte_status_history') AS dte_status_history;


-- -----------------------------------------------------------------------------
-- D1. Estados del DT-e que 0002 no sabe traducir (esperado: SIN FILAS)
-- 0002 traduce DRAFT, ISSUED, APPROVED, CLOSED, REJECTED y CANCELLED y acepta
-- los estados oficiales (BORRADOR ... ELIMINADO). Cualquier otro valor detiene
-- la migracion.
-- -----------------------------------------------------------------------------

-- D1a. En la tabla dte.
SELECT d.id AS dte_id,
       d.number AS numero,
       d.status::text AS estado_actual
FROM dte AS d
WHERE CASE upper(trim(d.status::text))
        WHEN 'DRAFT' THEN 'BORRADOR' WHEN 'ISSUED' THEN 'EMITIDO' WHEN 'APPROVED' THEN 'EMITIDO'
        WHEN 'CLOSED' THEN 'CERRADO' WHEN 'REJECTED' THEN 'RECHAZADO' WHEN 'CANCELLED' THEN 'ANULADO'
        ELSE upper(trim(d.status::text))
      END NOT IN ('BORRADOR', 'SOLICITADO', 'EMITIDO', 'VIGENTE', 'CERRADO', 'VENCIDO',
                  'CADUCADO', 'SIN_ARRIBO', 'RECHAZADO', 'ANULADO', 'ELIMINADO');

-- D1b. En el historial (solo si D0c muestra dte_status_history).
SELECT h.id AS historial_id, h.dte_id, h.from_status::text AS desde, h.to_status::text AS hacia, h.source::text AS origen
FROM dte_status_history AS h
WHERE (h.from_status IS NOT NULL AND CASE upper(trim(h.from_status::text))
          WHEN 'DRAFT' THEN 'BORRADOR' WHEN 'ISSUED' THEN 'EMITIDO' WHEN 'APPROVED' THEN 'EMITIDO'
          WHEN 'CLOSED' THEN 'CERRADO' WHEN 'REJECTED' THEN 'RECHAZADO' WHEN 'CANCELLED' THEN 'ANULADO'
          ELSE upper(trim(h.from_status::text)) END
        NOT IN ('BORRADOR', 'SOLICITADO', 'EMITIDO', 'VIGENTE', 'CERRADO', 'VENCIDO',
                'CADUCADO', 'SIN_ARRIBO', 'RECHAZADO', 'ANULADO', 'ELIMINADO'))
   OR CASE upper(trim(h.to_status::text))
          WHEN 'DRAFT' THEN 'BORRADOR' WHEN 'ISSUED' THEN 'EMITIDO' WHEN 'APPROVED' THEN 'EMITIDO'
          WHEN 'CLOSED' THEN 'CERRADO' WHEN 'REJECTED' THEN 'RECHAZADO' WHEN 'CANCELLED' THEN 'ANULADO'
          ELSE upper(trim(h.to_status::text)) END
        NOT IN ('BORRADOR', 'SOLICITADO', 'EMITIDO', 'VIGENTE', 'CERRADO', 'VENCIDO',
                'CADUCADO', 'SIN_ARRIBO', 'RECHAZADO', 'ANULADO', 'ELIMINADO')
   OR CASE upper(trim(h.source::text))
          WHEN 'SISTEMA_CRON' THEN 'SISTEMA' WHEN 'CRON' THEN 'SISTEMA' WHEN 'SYSTEM' THEN 'SISTEMA'
          WHEN 'USER' THEN 'USUARIO' WHEN '' THEN 'USUARIO'
          ELSE upper(trim(h.source::text)) END
        NOT IN ('USUARIO', 'SISTEMA', 'SENASA');

-- Correccion D1 (a mano, despues de decidir el estado correcto de cada fila):
--   UPDATE dte SET status = '<ESTADO_OFICIAL>', updated_at = now() WHERE id = '<dte_id>';
--   UPDATE dte_status_history SET to_status = '<ESTADO_OFICIAL>' WHERE id = '<historial_id>';
--   UPDATE dte_status_history SET source = 'SISTEMA' WHERE id = '<historial_id>';


-- -----------------------------------------------------------------------------
-- D2. Delegaciones SENASA (solo si D0c muestra senasa_delegation)
-- -----------------------------------------------------------------------------

-- D2a. Servicio o estado desconocido (esperado: SIN FILAS).
SELECT sd.id AS delegacion_id, sd.producer_id, sd.service::text AS servicio, sd.status::text AS estado
FROM senasa_delegation AS sd
WHERE upper(trim(sd.service::text)) NOT IN ('SIGSA_DTE', 'SITA')
   OR upper(trim(sd.status::text)) NOT IN ('NO_INICIADA', 'PENDIENTE', 'ACEPTADA', 'REVOCADA', 'RECHAZADA');

-- Correccion D2a:
--   UPDATE senasa_delegation SET service = 'SIGSA_DTE' WHERE id = '<delegacion_id>';
--   UPDATE senasa_delegation SET status = 'NO_INICIADA' WHERE id = '<delegacion_id>';

-- D2b. (Informativa) Registros repetidos para el mismo titular y servicio.
-- 0002 conserva el ultimo actualizado y BORRA estos.
SELECT sd.id AS delegacion_que_se_borra, sd.producer_id, upper(trim(sd.service::text)) AS servicio,
       sd.status::text AS estado, sd.updated_at
FROM senasa_delegation AS sd
WHERE EXISTS (
  SELECT 1 FROM senasa_delegation AS newer
  WHERE newer.producer_id = sd.producer_id
    AND upper(trim(newer.service::text)) = upper(trim(sd.service::text))
    AND (newer.updated_at, newer.id) > (sd.updated_at, sd.id)
);


-- -----------------------------------------------------------------------------
-- D3. Registros oficiales de apiarios y salas
-- -----------------------------------------------------------------------------

-- D3a. Estado RENAPA / SENASA desconocido (esperado: SIN FILAS). 0002 traduce
-- vacio, SIN VERIFICAR, ACTIVO/A, HABILITADO/A, SUSPENDIDO/A, VENCIDO/A, BAJA y
-- DADO DE BAJA.
SELECT 'apiary' AS tabla, a.id, to_jsonb(a) ->> 'renapa_status' AS valor
FROM apiary AS a
WHERE CASE upper(trim(coalesce(to_jsonb(a) ->> 'renapa_status', '')))
        WHEN '' THEN 'PENDING_VERIFICATION' WHEN 'SIN VERIFICAR' THEN 'PENDING_VERIFICATION'
        WHEN 'ACTIVO' THEN 'ACTIVE' WHEN 'ACTIVA' THEN 'ACTIVE' WHEN 'HABILITADO' THEN 'ACTIVE' WHEN 'HABILITADA' THEN 'ACTIVE'
        WHEN 'SUSPENDIDO' THEN 'SUSPENDED' WHEN 'SUSPENDIDA' THEN 'SUSPENDED'
        WHEN 'VENCIDO' THEN 'EXPIRED' WHEN 'VENCIDA' THEN 'EXPIRED'
        WHEN 'BAJA' THEN 'CANCELLED' WHEN 'DADO DE BAJA' THEN 'CANCELLED'
        ELSE upper(trim(to_jsonb(a) ->> 'renapa_status'))
      END NOT IN ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'CANCELLED')
UNION ALL
SELECT 'establishment', e.id, to_jsonb(e) ->> 'senasa_status'
FROM establishment AS e
WHERE CASE upper(trim(coalesce(to_jsonb(e) ->> 'senasa_status', '')))
        WHEN '' THEN 'PENDING_VERIFICATION' WHEN 'SIN VERIFICAR' THEN 'PENDING_VERIFICATION'
        WHEN 'ACTIVO' THEN 'ACTIVE' WHEN 'ACTIVA' THEN 'ACTIVE' WHEN 'HABILITADO' THEN 'ACTIVE' WHEN 'HABILITADA' THEN 'ACTIVE'
        WHEN 'SUSPENDIDO' THEN 'SUSPENDED' WHEN 'SUSPENDIDA' THEN 'SUSPENDED'
        WHEN 'VENCIDO' THEN 'EXPIRED' WHEN 'VENCIDA' THEN 'EXPIRED'
        WHEN 'BAJA' THEN 'CANCELLED' WHEN 'DADO DE BAJA' THEN 'CANCELLED'
        ELSE upper(trim(to_jsonb(e) ->> 'senasa_status'))
      END NOT IN ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'CANCELLED');

-- Correccion D3a:
--   UPDATE apiary SET renapa_status = 'PENDING_VERIFICATION' WHERE id = '<id>';
--   UPDATE establishment SET senasa_status = 'PENDING_VERIFICATION' WHERE id = '<id>';

-- D3b. Vencimientos de habilitacion que no son una fecha valida (esperado: SIN
-- FILAS). Se aceptan AAAA-MM-DD y DD/MM/AAAA; ademas la fecha tiene que existir
-- (31/02/2026 no existe).
WITH valores AS (
  SELECT 'apiary' AS tabla, a.id, trim(to_jsonb(a) ->> 'renapa_valid_to') AS valor FROM apiary AS a
  UNION ALL
  SELECT 'establishment', e.id, trim(to_jsonb(e) ->> 'senasa_valid_to') FROM establishment AS e
), partes AS (
  SELECT tabla, id, valor,
    CASE WHEN valor ~ '^\d{4}-\d{2}-\d{2}$' THEN substr(valor, 1, 4)::int
         WHEN valor ~ '^\d{2}/\d{2}/\d{4}$' THEN substr(valor, 7, 4)::int END AS anio,
    CASE WHEN valor ~ '^\d{4}-\d{2}-\d{2}$' THEN substr(valor, 6, 2)::int
         WHEN valor ~ '^\d{2}/\d{2}/\d{4}$' THEN substr(valor, 4, 2)::int END AS mes,
    CASE WHEN valor ~ '^\d{4}-\d{2}-\d{2}$' THEN substr(valor, 9, 2)::int
         WHEN valor ~ '^\d{2}/\d{2}/\d{4}$' THEN substr(valor, 1, 2)::int END AS dia
  FROM valores
  WHERE valor IS NOT NULL AND valor <> ''
)
SELECT tabla, id, valor
FROM partes
WHERE anio IS NULL
   OR anio < 1
   OR mes NOT BETWEEN 1 AND 12
   OR dia < 1
   OR dia > CASE WHEN mes BETWEEN 1 AND 12 AND anio >= 1
                 THEN extract(day FROM make_date(anio, mes, 1) + interval '1 month - 1 day')::int
                 ELSE 0 END;

-- Correccion D3b (fecha real de vencimiento, o NULL si no se conoce):
--   UPDATE apiary SET renapa_valid_to = '<AAAA-MM-DD>' WHERE id = '<id>';
--   UPDATE establishment SET senasa_valid_to = NULL WHERE id = '<id>';


-- -----------------------------------------------------------------------------
-- D4. Codigos oficiales repetidos (esperado: SIN FILAS)
-- Cada apiario tiene su RENAPA y cada sala su codigo SENASA. 0002 compara los
-- codigos en mayusculas y sin espacios.
-- -----------------------------------------------------------------------------
SELECT 'apiary.renapa_code' AS campo, codigo, count(*) AS repeticiones, string_agg(id::text, ', ') AS ids
FROM (
  SELECT a.id, NULLIF(upper(regexp_replace(coalesce(to_jsonb(a) ->> 'renapa_code', ''), '\s+', '', 'g')), '') AS codigo
  FROM apiary AS a
) AS s
WHERE codigo IS NOT NULL
GROUP BY codigo
HAVING count(*) > 1
UNION ALL
SELECT 'establishment.senasa_code', codigo, count(*), string_agg(id::text, ', ')
FROM (
  SELECT e.id, NULLIF(upper(regexp_replace(coalesce(to_jsonb(e) ->> 'senasa_code', ''), '\s+', '', 'g')), '') AS codigo
  FROM establishment AS e
) AS s
WHERE codigo IS NOT NULL
GROUP BY codigo
HAVING count(*) > 1;

-- Correccion D4 (dejar el codigo en el registro que corresponde; en el otro,
-- el codigo real o NULL hasta verificarlo):
--   UPDATE apiary SET renapa_code = NULL, renapa_status = 'PENDING_VERIFICATION' WHERE id = '<id>';
--   UPDATE establishment SET senasa_code = NULL, senasa_status = 'PENDING_VERIFICATION' WHERE id = '<id>';


-- -----------------------------------------------------------------------------
-- D5. Datos del DT-e fuera de formato
-- -----------------------------------------------------------------------------

-- D5a. Codigos o patentes mas largos que el formato oficial (esperado: SIN
-- FILAS). Limites: codigo de cierre 20, patentes 15 (sin espacios, puntos ni
-- guiones).
SELECT d.id AS dte_id, d.number AS numero,
       to_jsonb(d) ->> 'verification_code' AS codigo_de_cierre,
       to_jsonb(d) ->> 'transport_plate' AS patente,
       to_jsonb(d) ->> 'transport_trailer_plate' AS patente_acoplado
FROM dte AS d
WHERE length(NULLIF(to_jsonb(d) ->> 'verification_code', 'VER-0000')) > 20
   OR length(upper(regexp_replace(coalesce(to_jsonb(d) ->> 'transport_plate', ''), '[\s.\-_]', '', 'g'))) > 15
   OR length(upper(regexp_replace(coalesce(to_jsonb(d) ->> 'transport_trailer_plate', ''), '[\s.\-_]', '', 'g'))) > 15;

-- Correccion D5a (el dato tal como figura en el DT-e oficial):
--   UPDATE dte SET verification_code = '<codigo>' WHERE id = '<dte_id>';
--   UPDATE dte SET transport_plate = '<patente>' WHERE id = '<dte_id>';

-- D5b. Fechas de carga o vencimiento del DT-e que no son una fecha valida
-- (esperado: SIN FILAS). Solo puede pasar si la base se sincronizo con
-- drizzle-kit push, donde esas fechas quedaron como texto.
WITH valores AS (
  SELECT d.id, 'load_date' AS campo, trim(to_jsonb(d) ->> 'load_date') AS valor FROM dte AS d
  UNION ALL
  SELECT d.id, 'expiry_date', trim(to_jsonb(d) ->> 'expiry_date') FROM dte AS d
), partes AS (
  SELECT id, campo, valor,
    CASE WHEN valor ~ '^\d{4}-\d{2}-\d{2}' THEN substr(valor, 1, 4)::int END AS anio,
    CASE WHEN valor ~ '^\d{4}-\d{2}-\d{2}' THEN substr(valor, 6, 2)::int END AS mes,
    CASE WHEN valor ~ '^\d{4}-\d{2}-\d{2}' THEN substr(valor, 9, 2)::int END AS dia
  FROM valores
  WHERE valor IS NOT NULL AND valor <> ''
)
SELECT id AS dte_id, campo, valor
FROM partes
WHERE anio IS NULL
   OR anio < 1
   OR mes NOT BETWEEN 1 AND 12
   OR dia < 1
   OR dia > CASE WHEN mes BETWEEN 1 AND 12 AND anio >= 1
                 THEN extract(day FROM make_date(anio, mes, 1) + interval '1 month - 1 day')::int
                 ELSE 0 END;

-- Correccion D5b (la fecha que figura en el DT-e oficial, AAAA-MM-DD):
--   UPDATE dte SET load_date = '<AAAA-MM-DD>' WHERE id = '<dte_id>';


-- -----------------------------------------------------------------------------
-- D6. Unicidad del DT-e (esperado: SIN FILAS)
-- -----------------------------------------------------------------------------

-- D6a. Movimientos que seguirian con mas de un DT-e "en juego" (cualquier
-- estado salvo ANULADO, ELIMINADO y RECHAZADO) DESPUES de la limpieza
-- automatica de 0002. La limpieza elimina los borradores sin numero y los
-- DT-e SIMULADOS que compiten con otro DT-e del mismo movimiento (ver D7a).
-- Lo que queda aca son DT-e con numero real: decide una persona.
WITH m AS (
  SELECT d.id, d.movement_id, d.number AS numero, d.created_at,
    CASE upper(trim(d.status::text))
      WHEN 'DRAFT' THEN 'BORRADOR' WHEN 'ISSUED' THEN 'EMITIDO' WHEN 'APPROVED' THEN 'EMITIDO'
      WHEN 'CLOSED' THEN 'CERRADO' WHEN 'REJECTED' THEN 'RECHAZADO'
      WHEN 'CANCELLED' THEN CASE WHEN d.number IS NULL THEN 'ELIMINADO' ELSE 'ANULADO' END
      ELSE upper(trim(d.status::text))
    END AS estado,
    CASE
      WHEN d.external_id LIKE 'SIGSA-SIM-%' OR d.external_id LIKE 'SIM-%' THEN 'SIMULADO'
      WHEN upper(trim(to_jsonb(d) ->> 'issue_mode')) IN ('MANUAL', 'SIMULADO', 'SIGSA') THEN upper(trim(to_jsonb(d) ->> 'issue_mode'))
      ELSE 'MANUAL'
    END AS canal
  FROM dte AS d
), en_juego AS (
  SELECT * FROM m WHERE estado NOT IN ('ANULADO', 'ELIMINADO', 'RECHAZADO')
), limpieza_automatica AS (
  SELECT x.id FROM en_juego AS x
  WHERE ((x.numero IS NULL AND x.estado IN ('BORRADOR', 'SOLICITADO')) OR x.canal = 'SIMULADO')
    AND EXISTS (
      SELECT 1 FROM en_juego AS o
      WHERE o.movement_id = x.movement_id AND o.id <> x.id
        AND ((o.numero IS NOT NULL AND o.canal <> 'SIMULADO') OR (o.created_at, o.id) > (x.created_at, x.id))
    )
), quedan AS (
  SELECT * FROM en_juego WHERE id NOT IN (SELECT id FROM limpieza_automatica)
)
SELECT mv.code AS movimiento, q.movement_id, q.id AS dte_id, q.numero, q.estado AS estado_tras_0002,
       q.canal, q.created_at
FROM quedan AS q
JOIN movement AS mv ON mv.id = q.movement_id
WHERE q.movement_id IN (SELECT movement_id FROM quedan GROUP BY movement_id HAVING count(*) > 1)
ORDER BY mv.code, q.created_at;

-- D6b. Numeros de DT-e API-SEM repetidos, en cualquier estado. API-SEM = DT-e
-- con fecha de carga.
SELECT d.number AS numero, count(*) AS repeticiones, string_agg(d.id::text, ', ' ORDER BY d.created_at) AS ids
FROM dte AS d
WHERE d.number IS NOT NULL
  AND to_jsonb(d) ->> 'load_date' IS NOT NULL
GROUP BY d.number
HAVING count(*) > 1;

-- Correccion D6a. Para cada movimiento listado, decidir cual DT-e ampara el
-- traslado. El otro se resuelve con UNA de estas opciones, dentro de una
-- transaccion (reemplazar <dte_id>, <estado_actual> y el motivo):
--
--   Opcion 1: fue un error de carga (SENASA no emitio ese DT-e para este
--   traslado) -> ELIMINADO.
--     BEGIN;
--     UPDATE dte SET status = 'ELIMINADO', voided_at = now(),
--            void_reason = '<motivo, por ejemplo: numero cargado dos veces>', updated_at = now()
--      WHERE id = '<dte_id>';
--     INSERT INTO dte_status_history (dte_id, from_status, to_status, source, reason)
--     VALUES ('<dte_id>', '<estado_actual>', 'ELIMINADO', 'USUARIO', '<el mismo motivo>');
--     COMMIT;
--
--   Opcion 2: SENASA emitio el DT-e y fue anulado en SIGSA (con arancel) ->
--   ANULADO. Igual que la opcion 1 cambiando 'ELIMINADO' por 'ANULADO'.
--
--   Opcion 3: el DT-e es real y corresponde a OTRO traslado -> crear ese
--   movimiento en ApiTrace y reasignarlo:
--     UPDATE dte SET movement_id = '<id del movimiento correcto>', updated_at = now()
--      WHERE id = '<dte_id>';
--
-- Correccion D6b. Si el numero esta mal tipeado, corregirlo:
--     UPDATE dte SET number = '<numero correcto>', updated_at = now() WHERE id = '<dte_id>';
-- Si es el mismo DT-e cargado dos veces, conservar el registro mas completo y
-- en el otro guardar el numero en el motivo y dejarlo sin numero:
--     UPDATE dte SET status = 'ELIMINADO', voided_at = now(), updated_at = now(),
--            void_reason = 'Registro duplicado del DT-e <numero>', number = NULL
--      WHERE id = '<dte_id>';


-- -----------------------------------------------------------------------------
-- D7. Lo que 0002 va a cambiar sola (informativa)
-- -----------------------------------------------------------------------------

-- D7a. DT-e que 0002 pasa a ELIMINADO: borradores sin numero o simulaciones
-- que compiten con otro DT-e del mismo movimiento. Revisar que ninguno sea un
-- DT-e real (si lo es, corregir su canal o numero antes de desplegar).
WITH m AS (
  SELECT d.id, d.movement_id, d.number AS numero, d.created_at,
    CASE upper(trim(d.status::text))
      WHEN 'DRAFT' THEN 'BORRADOR' WHEN 'ISSUED' THEN 'EMITIDO' WHEN 'APPROVED' THEN 'EMITIDO'
      WHEN 'CLOSED' THEN 'CERRADO' WHEN 'REJECTED' THEN 'RECHAZADO'
      WHEN 'CANCELLED' THEN CASE WHEN d.number IS NULL THEN 'ELIMINADO' ELSE 'ANULADO' END
      ELSE upper(trim(d.status::text))
    END AS estado,
    CASE
      WHEN d.external_id LIKE 'SIGSA-SIM-%' OR d.external_id LIKE 'SIM-%' THEN 'SIMULADO'
      WHEN upper(trim(to_jsonb(d) ->> 'issue_mode')) IN ('MANUAL', 'SIMULADO', 'SIGSA') THEN upper(trim(to_jsonb(d) ->> 'issue_mode'))
      ELSE 'MANUAL'
    END AS canal
  FROM dte AS d
), en_juego AS (
  SELECT * FROM m WHERE estado NOT IN ('ANULADO', 'ELIMINADO', 'RECHAZADO')
)
SELECT mv.code AS movimiento, x.id AS dte_id, x.numero, x.estado, x.canal, x.created_at
FROM en_juego AS x
JOIN movement AS mv ON mv.id = x.movement_id
WHERE ((x.numero IS NULL AND x.estado IN ('BORRADOR', 'SOLICITADO')) OR x.canal = 'SIMULADO')
  AND EXISTS (
    SELECT 1 FROM en_juego AS o
    WHERE o.movement_id = x.movement_id AND o.id <> x.id
      AND ((o.numero IS NOT NULL AND o.canal <> 'SIMULADO') OR (o.created_at, o.id) > (x.created_at, x.id))
  )
ORDER BY mv.code, x.created_at;

-- D7b. Resumen de correcciones automaticas.
SELECT 'DT-e emitidos por el simulador (quedan marcados SIMULADO, sin PDF)' AS cambio,
       count(*) AS filas
FROM dte AS d
WHERE d.external_id LIKE 'SIGSA-SIM-%' OR d.external_id LIKE 'SIM-%'
UNION ALL
SELECT 'DT-e sin fecha de carga (quedan como documento registrado antes del modelo API-SEM)', count(*)
FROM dte AS d WHERE to_jsonb(d) ->> 'load_date' IS NULL
UNION ALL
SELECT 'Codigo de cierre inventado VER-0000 (se borra)', count(*)
FROM dte AS d WHERE to_jsonb(d) ->> 'verification_code' = 'VER-0000'
UNION ALL
SELECT 'Patente inventada AAA000, NO o SIN (se borra)', count(*)
FROM dte AS d
WHERE upper(regexp_replace(coalesce(to_jsonb(d) ->> 'transport_plate', ''), '[\s.\-_]', '', 'g')) IN ('AAA000', 'NO', 'SIN')
   OR upper(regexp_replace(coalesce(to_jsonb(d) ->> 'transport_trailer_plate', ''), '[\s.\-_]', '', 'g')) IN ('AAA000', 'NO', 'SIN')
UNION ALL
SELECT 'Tipo de transporte que no es un vehiculo (PROPIO, CONTRATADO...: se borra)', count(*)
FROM dte AS d
WHERE to_jsonb(d) ->> 'transport_type' IS NOT NULL
  AND upper(trim(to_jsonb(d) ->> 'transport_type')) NOT IN ('CAMION', 'CAMIONETA', 'FURGON', 'UTILITARIO', 'OTRO')
UNION ALL
SELECT 'Cantidades de alzas con decimales (se redondean)', count(*)
FROM dte AS d
WHERE (to_jsonb(d) ->> 'declared_quantity')::numeric % 1 <> 0
   OR (to_jsonb(d) ->> 'estimated_quantity')::numeric % 1 <> 0
   OR (to_jsonb(d) ->> 'confirmed_quantity')::numeric % 1 <> 0
UNION ALL
SELECT 'Numero cargado a mano marcado SYNCHRONIZED sin verificar en SIGSA (vuelve a PENDING_SYNC)', count(*)
FROM dte AS d
WHERE d.number IS NOT NULL AND d.external_id IS NULL
  AND d.sync_status::text = 'SYNCHRONIZED'
  AND upper(coalesce(to_jsonb(d) ->> 'issue_mode', 'MANUAL')) = 'MANUAL';


-- -----------------------------------------------------------------------------
-- D8. Cuentas de demostracion en la base (informativa, SEGURIDAD)
-- El seed crea estas cuentas con la contrasena de SEED_PASSWORD (por defecto
-- ApiTrace2026!), que esta publicada en la landing y en los manuales. En una
-- base de produccion no deben quedar activas. Ver
-- docs/plan-dte/sql/cuentas-demo-produccion.sql.
-- -----------------------------------------------------------------------------
SELECT u.id, u.email, u.role, u.status, u.last_login_at
FROM app_user AS u
WHERE u.email IN (
  'admin@apitrace', 'productor@apitrace', 'sala@apitrace', 'acopio@apitrace',
  'auditor@apitrace', 'laboratorio@apitrace',
  'admin@apitrace.test', 'productor@apitrace.test', 'sala@apitrace.test', 'acopio@apitrace.test',
  'auditor@apitrace.test', 'laboratorio@apitrace.test'
)
ORDER BY u.email;
