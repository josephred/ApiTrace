# T04 · Pantallas del DT-e (C3)

**Objetivo:** que las pantallas hablen el mismo idioma que el servidor corregido y que
Configuración sólo ofrezca lo que de verdad hace algo.

**Cierra:** A-01 en la interfaz, C-11.

## Precondiciones

- T03 cumplido (el frontend consume la API corregida).

## Pasos

```powershell
cd C:\github\ApiTrace
git apply --check docs\plan-dte\parches\03-frontend-dte.patch
git apply docs\plan-dte\parches\03-frontend-dte.patch
git status --short | Measure-Object -Line      # 26 archivos

cd frontend
npm run build                                  # tsc --noEmit && vite build
npx vitest run                                 # 21 pruebas
cd ..
```

Prueba a mano, con el backend local corriendo (`cd backend; npm run start:dev`) y
`npm run dev` en `frontend/`:

1. Entrar como `productor` (contraseña del seed) → **DT-e** → **Nuevo DT-e**.
2. En el paso de comprobaciones previas, con un apiario sin RENAPA cargado, la pantalla
   debe decir que falta el RENAPA y no dejar seguir sin decisión explícita.
3. Emitir a mano con un número y un código: el detalle muestra el número, la vigencia y el
   semáforo; el código de cierre aparece porque el usuario es el emisor.
4. Entrar como `sala`: el mismo DT-e se ve, pero **sin** el código de cierre.
5. **Configuración**: sólo tema, ayudas, patente habitual y el canal de emisión de solo
   lectura. Ninguna opción que no haga nada.

## Salida esperada

- `npm run build`: `✓ built in …`, sin errores de TypeScript.
- `npx vitest run`: `Tests 21 passed (21)`.
- El archivo `frontend/src/components/TransitSemaphoreBadge.tsx` queda **eliminado** (el
  semáforo vive en el vocabulario compartido).

## Verificación (gate)

- [ ] Build y pruebas del frontend en verde.
- [ ] El recorrido de 5 pasos se cumple tal como está descrito.

## Qué NO hacer

- No volver a agregar preferencias de "tolerancias", "alertas de vencimiento" o
  "frecuencia de sincronización": no existen en el servidor.
- No mostrar el código de cierre a la sala ni al acopiador: lo trae el chofer en el papel.
- No cambiar `frontend/src/lib/config.ts` (ya está como lo dejó el commit `bdd2a5b`).
