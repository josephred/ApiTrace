-- =============================================================================
-- cuentas-demo-produccion.sql
--
-- Desactiva las cuentas de demostracion en la base de PRODUCCION y revoca sus
-- sesiones. El seed las crea con la contrasena de SEED_PASSWORD (por defecto
-- ApiTrace2026!), que esta publicada en la landing y en los manuales: en
-- produccion cualquiera podria entrar como administrador.
--
-- ANTES de correrlo (si no, el script se detiene): crear una cuenta ADMIN
-- propia, con correo real y contrasena personal, y entrar con ella. La app no
-- tiene pantalla de usuarios: se hace con la API, siguiendo la tarea
-- "Cuentas de demostracion" del plan (docs/plan-dte/tareas/), que da los
-- comandos de PowerShell exactos.
--
-- Como correrlo: Neon > SQL Editor > pegar TODO el archivo > Run. Es una
-- transaccion.
--
-- Efecto: las cuentas quedan DISABLED (no se borran: su historial de auditoria
-- se conserva). Los tokens de acceso ya emitidos vencen solos (JWT_ACCESS_TTL,
-- 30 minutos por defecto); los refresh tokens se revocan ahora.
-- Para reactivarlas en un entorno de demostracion:
--   UPDATE app_user SET status = 'ACTIVE' WHERE email = '<correo>';
-- =============================================================================
BEGIN;

DO $$
DECLARE
  demo text[] := ARRAY[
    'admin@apitrace', 'productor@apitrace', 'sala@apitrace', 'acopio@apitrace',
    'auditor@apitrace', 'laboratorio@apitrace',
    'admin@apitrace.test', 'productor@apitrace.test', 'sala@apitrace.test', 'acopio@apitrace.test',
    'auditor@apitrace.test', 'laboratorio@apitrace.test'
  ];
  desactivadas integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM app_user AS u
    WHERE u.role = 'ADMIN' AND u.status = 'ACTIVE' AND NOT (u.email = ANY (demo))
  ) THEN
    RAISE EXCEPTION 'No hay ningun ADMIN activo fuera de las cuentas de demostracion. Crear y probar uno antes (ver encabezado de este archivo).';
  END IF;

  INSERT INTO audit_event (actor_email, action, entity_type, entity_id, before, after, source)
  SELECT current_user, 'USER_ROLE_UPDATED', 'user', u.id::text,
         jsonb_build_object('status', u.status), jsonb_build_object('status', 'DISABLED'), 'SQL'
  FROM app_user AS u
  WHERE u.email = ANY (demo) AND u.status <> 'DISABLED';

  UPDATE app_user SET status = 'DISABLED', updated_at = now()
  WHERE email = ANY (demo) AND status <> 'DISABLED';
  GET DIAGNOSTICS desactivadas = ROW_COUNT;

  UPDATE refresh_token SET revoked_at = now()
  WHERE revoked_at IS NULL
    AND user_id IN (SELECT id FROM app_user WHERE email = ANY (demo));

  RAISE NOTICE 'Cuentas de demostracion desactivadas: %', desactivadas;
END $$;

SELECT email, role, status
FROM app_user
WHERE email LIKE '%@apitrace' OR email LIKE '%@apitrace.test'
ORDER BY email;

COMMIT;
