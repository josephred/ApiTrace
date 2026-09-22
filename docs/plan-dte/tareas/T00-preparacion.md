# T00 · Preparar la rama de trabajo y el respaldo de la base

**Objetivo:** dejar el repositorio y la base en un punto al que se pueda volver, y registrar
el estado de partida.

## Precondiciones

- Repositorio en `C:\github\ApiTrace`, sin cambios sin guardar.
- Acceso a la consola de Neon (la base de producción) y a la de Render.
- Node 22 y npm instalados (`node -v`, `npm -v`).

## Pasos

```powershell
cd C:\github\ApiTrace

# 1. Estado de partida: anotar el commit y que no haya cambios pendientes.
git log --oneline -1
git status --short

# 2. Rama de trabajo.
git checkout -b correccion/dte

# 3. Dependencias (sin cambios de paquetes en todo el plan: no debe modificar los lock).
cd backend;  npm install;  cd ..
cd frontend; npm install;  cd ..
git status --short          # debe seguir vacío

# 4. Estado de partida de las pruebas, para comparar al final.
cd backend
npm run build
npm test
cd ..
cd frontend
npm run build
npx vitest run
cd ..
```

**Respaldo de la base (en la consola de Neon, no por comando):**

1. Abrir el proyecto de ApiTrace en Neon → **Branches** → **New branch**.
2. Nombre: `respaldo-pre-0002-2026-09-21`. Origen: la rama de producción, punto `now`.
3. Anotar la cadena de conexión de esa rama: sirve para probar la migración contra una
   copia real de los datos (T03) y para volver atrás si algo sale muy mal.

## Salida esperada

- `git log --oneline -1` imprime `bdd2a5b …` (si imprime otro commit, ver §6 del plan 11).
- `git status --short` queda vacío después de los `npm install`.
- Los `npm run build` terminan sin errores. Las pruebas de partida pueden fallar: hay que
  **anotar cuántas y cuáles**, porque es el punto de comparación.
- En Neon aparece la rama `respaldo-pre-0002-2026-09-21`.

## Verificación (gate)

- [ ] Rama `correccion/dte` creada y `git status` limpio.
- [ ] Respaldo de la base creado y su cadena de conexión guardada.
- [ ] Resultado de las pruebas de partida anotado (número de pruebas que pasan y que fallan).

## Qué NO hacer

- No correr `npm run db:push` ni `db:migrate` contra producción todavía.
- No actualizar dependencias ni tocar `package-lock.json`.
- No trabajar sobre `main`.
