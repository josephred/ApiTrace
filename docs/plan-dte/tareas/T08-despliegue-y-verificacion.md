# T08 · Desplegar y verificar en el aire

**Objetivo:** que el código corregido y la migración lleguen a producción, y comprobar con
llamadas reales que el DT-e quedó bien.

## Precondiciones

- T02 a T06 cumplidos (y T07 si correspondía).
- Respaldo de T00 disponible.

## Pasos

```powershell
cd C:\github\ApiTrace
git add -A
git commit -m "fix(dte): modelo API-SEM, migracion de reparacion, seguridad de acceso y contenido"
git checkout main
git merge --no-ff correccion/dte
git push origin main
```

Render despliega solo (`autoDeploy`). En el log del servicio `apitrace-api` hay que ver, en
este orden:

```
[migrate] Aplicando migraciones desde /opt/render/project/src/backend/drizzle
[migrate] Migraciones aplicadas correctamente.
[Bootstrap] ApiTrace API escuchando en el puerto 10000 (prefijo /api/v1)
```

**Si aparece** `cause: error: 0002_dte_reparacion: …`: la migración se revirtió sola y el
servicio anterior sigue en el aire. Leer qué consulta indica (`D1`…`D6`), volver a T01,
resolver, y volver a desplegar. No hay que restaurar nada.

Verificación por API (reemplazar la contraseña por la real):

```powershell
$api = "https://apitrace-api.onrender.com/api/v1"

# 1. Salud y versión.
Invoke-RestMethod "$api/../health"

# 2. La puerta cerrada (S-01): debe dar 401.
try { Invoke-RestMethod -Method Post "$api/auth/login" -ContentType "application/json" `
      -Body '{"email":"admin","password":"123456"}' } catch { $_.Exception.Response.StatusCode.value__ }

# 3. Entrar de verdad.
$login = Invoke-RestMethod -Method Post "$api/auth/login" -ContentType "application/json" `
         -Body '{"email":"productor@apitrace","password":"<contraseña real>"}'
$h = @{ Authorization = "Bearer $($login.accessToken)" }

# 4. Listado de DT-e y canal de emisión.
(Invoke-RestMethod "$api/dte?pageSize=50" -Headers $h).data |
  Select-Object number, status, issueMode, loadDate, movementTypeCode | Format-Table
Invoke-RestMethod "$api/dte/integration" -Headers $h

# 5. D-01 cerrado: crear un movimiento tiene que responder 201.
$apiario = (Invoke-RestMethod "$api/apiaries?pageSize=5" -Headers $h).data[0]
$sala = (Invoke-RestMethod "$api/establishments?pageSize=50" -Headers $h).data |
        Where-Object { $_.type -eq 'SALA_EXTRACCION' } | Select-Object -First 1
$mov = Invoke-RestMethod -Method Post "$api/movements" -Headers $h -ContentType "application/json" -Body (@{
  movementType='MATERIAL_MELARIO'; materialType='MATERIAL_MELARIO';
  originEstablishmentId=$apiario.establishmentId; originApiaryId=$apiario.id;
  destinationEstablishmentId=$sala.id; scheduledAt=(Get-Date).ToString("o");
  quantity=50; unit='ALZA' } | ConvertTo-Json)
$mov.code

# 6. Borrador y emisión manual con un número de prueba.
$hoy = (Get-Date).AddHours(-3).ToString("yyyy-MM-dd")
$dte = Invoke-RestMethod -Method Post "$api/dte" -Headers $h -ContentType "application/json" -Body (@{
  movementId=$mov.id; declaredQuantity=50; loadDate=$hoy;
  transport=@{ type='CAMION'; plate='AB123CD' } } | ConvertTo-Json -Depth 4)
$dte.status                       # BORRADOR
Invoke-RestMethod -Method Post "$api/dte/$($dte.id)/issue" -Headers $h -ContentType "application/json" `
  -Body '{"number":"022440451-4","verificationCode":"790112"}' |
  Select-Object status, number, issueMode, movementTypeCode, productCode, unit, originCode
```

Verificación en la base (Neon SQL Editor):

```sql
-- Migraciones aplicadas: tres filas.
SELECT id, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at;

-- Marcadores inventados: cero.
SELECT count(*) FROM dte WHERE verification_code = 'VER-0000' OR transport_plate = 'AAA000';

-- Un DT-e en juego por movimiento: cero filas.
SELECT movement_id FROM dte WHERE status NOT IN ('ANULADO','ELIMINADO','RECHAZADO')
GROUP BY movement_id HAVING count(*) > 1;

-- Códigos del trámite en los DT-e API-SEM.
SELECT DISTINCT movement_type_code, transit_reason, product_code, unit
FROM dte WHERE load_date IS NOT NULL;
```

Borrar el movimiento de prueba **no** hace falta: se puede anular el DT-e emitido
(`POST /dte/{id}/void` con motivo "prueba de despliegue") y cancelar el movimiento, lo que
deja el rastro correcto en el historial.

## Salida esperada

- Paso 2: `401`.
- Paso 5: un código `MOV-2026-0000xx` (y **no** un error 500).
- Paso 6: `BORRADOR` y luego `EMITIDO` con `movementTypeCode = API-SEM`,
  `productCode = 24.45`, `unit = UNIDAD` y `originCode` igual al RENAPA del apiario (o
  vacío si ese apiario todavía no lo tiene cargado).
- En la base: tres migraciones, cero marcadores, cero movimientos con más de un DT-e, y la
  última consulta devuelve una sola fila:
  `API-SEM | Extracción de miel | 24.45 | UNIDAD`.

## Verificación (gate)

- [ ] Log del deploy con `Migraciones aplicadas correctamente`.
- [ ] Login con contraseña genérica → 401.
- [ ] `POST /movements` → 201.
- [ ] Emisión manual con los códigos del trámite correctos.
- [ ] Las cuatro consultas SQL con el resultado esperado.
- [ ] La aplicación web abre, entra y muestra el listado de DT-e.

## Qué NO hacer

- No correr `npm run db:seed` contra producción: crearía la cadena de demostración
  encima de los datos reales.
- No forzar un redeploy con "Clear build cache" para "arreglar" un error de migración: el
  problema no es el caché.
- No dejar el movimiento de prueba en estado dispuesto para despachar sin anularlo.
