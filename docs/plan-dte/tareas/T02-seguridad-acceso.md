# T02 · Cerrar la puerta de la autenticación (C1)

**Objetivo:** que la única llave de una cuenta sea su contraseña guardada, y que el correo
escrito identifique una sola cuenta.

**Cierra:** S-01 (crítico), S-02, S-04.

## Precondiciones

- T00 cumplido.

## Pasos

```powershell
cd C:\github\ApiTrace
git apply --check docs\plan-dte\parches\01-seguridad-acceso.patch
git apply docs\plan-dte\parches\01-seguridad-acceso.patch
git status --short
```

Si `git apply --check` falla, descomprimir el zip de referencia y copiar los tres archivos:

```powershell
Expand-Archive docs\plan-dte\referencia-dte.zip -DestinationPath docs\plan-dte\referencia -Force
Copy-Item docs\plan-dte\referencia\backend\src\modules\identity\auth.service.ts backend\src\modules\identity\auth.service.ts -Force
Copy-Item docs\plan-dte\referencia\frontend\src\pages\LoginPage.tsx frontend\src\pages\LoginPage.tsx -Force
Copy-Item docs\plan-dte\referencia\frontend\.env.example frontend\.env.example -Force
Get-FileHash backend\src\modules\identity\auth.service.ts -Algorithm SHA256
```

Comprobar que no quedó nada de la puerta anterior y que compila:

```powershell
Select-String -Path backend\src\modules\identity\auth.service.ts -Pattern "isAcceptedDemoPassword|apigestion2026|123456"
cd backend
npx tsc --noEmit -p tsconfig.json
npm test
cd ..
```

## Salida esperada

- `git status --short` muestra exactamente tres archivos modificados:
  `backend/src/modules/identity/auth.service.ts`, `frontend/src/pages/LoginPage.tsx`,
  `frontend/.env.example`.
- `Select-String` **no** devuelve ninguna línea.
- `npx tsc --noEmit` no imprime nada; `npm test` pasa 43 pruebas.

## Verificación (gate)

- [ ] Tres archivos modificados, ni uno más.
- [ ] Ninguna coincidencia de `isAcceptedDemoPassword`.
- [ ] `tsc` limpio y unitarias en verde.

Comprobación funcional (más adelante, en T08, contra el entorno desplegado):
`POST /auth/login` con `{"email":"admin","password":"123456"}` debe responder **401**.

## Qué NO hacer

- No borrar el atajo del nombre corto (`admin`, `productor`): sigue siendo útil y ahora
  sólo se usa cuando lo escrito no tiene `@`.
- No cambiar las contraseñas de las cuentas de demostración en esta tarea: eso es T09.
- No tocar `render.yaml` todavía (viene en T03/T06).
