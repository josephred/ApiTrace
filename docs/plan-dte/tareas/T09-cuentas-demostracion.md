# T09 · Cuentas de demostración y acceso rápido

**Objetivo:** tomar y aplicar la decisión sobre las cuentas de demostración, que hoy tienen
una contraseña publicada en la landing.

**Cierra:** S-03, S-04.

## Precondiciones

- T08 cumplido (el sistema desplegado funciona).
- Lista de cuentas de D8 (T01).

## Paso 1 (siempre): una cuenta de administrador propia

Sin esto, cualquier cambio en las cuentas de demostración puede dejar la plataforma sin
administrador. La aplicación no tiene pantalla de usuarios, así que se hace por API:

```powershell
$api = "https://apitrace-api.onrender.com/api/v1"

# Entrar con la cuenta de demostración que todavía es ADMIN.
$login = Invoke-RestMethod -Method Post "$api/auth/login" -ContentType "application/json" `
         -Body '{"email":"admin@apitrace","password":"ApiTrace2026!"}'
$h = @{ Authorization = "Bearer $($login.accessToken)" }

# Crear la cuenta propia (contraseña de 10 caracteres o más).
Invoke-RestMethod -Method Post "$api/auth/register" -Headers $h -ContentType "application/json" -Body (@{
  email='tu.correo@dominio.com'; password='<contraseña personal>';
  fullName='Nombre Apellido'; role='ADMIN' } | ConvertTo-Json)

# Comprobar que entra.
Invoke-RestMethod -Method Post "$api/auth/login" -ContentType "application/json" -Body (@{
  email='tu.correo@dominio.com'; password='<contraseña personal>' } | ConvertTo-Json)
```

## Paso 2: elegir qué es esta instancia

| | **A · Sigue siendo demostración pública** | **B · Pasa a tener datos reales** |
| :--- | :--- | :--- |
| Cuentas de demostración | Quedan activas | Se desactivan |
| `VITE_DEMO_ACCESS` | `true` | `false` |
| Datos | Sólo ficticios | Reales, de productores |
| Qué hay que aceptar | Cualquiera que lea la landing entra con rol completo y puede crear, emitir y cerrar DT-e de prueba | Hay que mantener un entorno de demostración aparte si se lo quiere seguir mostrando |

La decisión del 19/09 (commit `ea10a7d`) fue **A**, y así quedó `render.yaml`
(`VITE_DEMO_ACCESS = true`). Es consistente mientras la base sea de prueba. En el momento en
que se cargue el primer productor real, hay que pasar a **B**.

## Paso 3A: si sigue siendo demostración

```powershell
# Sólo confirmar que la variable está en true y que la base no tiene datos reales.
```

- Verificar en Render → `apitrace-web` → Environment: `VITE_DEMO_ACCESS = true`.
- Dejar escrito en la landing y en el README que es un entorno de prueba (ya lo dice el
  parche C4).
- Anotar en el panel de Neon el nombre de la base como `demo`, para no confundirla después.

## Paso 3B: si pasa a tener datos reales

1. Neon → SQL Editor → pegar **todo** `docs/plan-dte/sql/cuentas-demo-produccion.sql` →
   ejecutar. El script se detiene solo si no existe un ADMIN propio activo.
2. Render → `apitrace-web` → Environment → `VITE_DEMO_ACCESS = false` → **Manual Deploy**
   (la variable se compila en el bundle: reiniciar no alcanza).
3. Quitar el bloque de cuentas de la landing (o dejarlo apuntando al entorno de demostración
   separado, si se crea uno).
4. Comprobar:

```powershell
try { Invoke-RestMethod -Method Post "$api/auth/login" -ContentType "application/json" `
      -Body '{"email":"admin@apitrace","password":"ApiTrace2026!"}' } catch { $_.Exception.Response.StatusCode.value__ }   # 401
```

## Salida esperada

- Paso 1: la cuenta propia entra y devuelve `accessToken` con `role = ADMIN`.
- Paso 3B: el script imprime las cuentas en estado `DISABLED` y el login de demostración
  responde 401.

## Verificación (gate)

- [ ] Existe una cuenta ADMIN propia, con contraseña personal, probada.
- [ ] La decisión (A o B) está tomada, aplicada y anotada.
- [ ] Si es B: las cuentas quedaron `DISABLED`, los refresh tokens revocados y el sitio
      reconstruido con `VITE_DEMO_ACCESS = false`.

## Qué NO hacer

- No desactivar las cuentas de demostración antes de tener la propia probada.
- No borrar los usuarios (`DELETE FROM app_user`): rompe el historial de auditoría. Se
  desactivan.
- No dejar la instancia en el estado A con datos reales cargados.
