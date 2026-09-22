# T10 · Capturas, PDF finales y cierre (opcional)

**Objetivo:** que los manuales muestren las pantallas que el usuario va a ver de verdad, y
dejar el trabajo cerrado en el repositorio.

## Precondiciones

- T08 cumplido y la aplicación desplegada funcionando.

## Pasos

Las capturas de `docs/capturas/` se tomaron antes de estos cambios: el DT-e, Configuración y
el panel se ven distintos ahora. El script las regenera contra un entorno local:

```powershell
cd C:\github\ApiTrace\backend
# Base local con datos de demostración (NUNCA producción).
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/apitrace_dev"
npm run db:migrate
npm run db:seed
npm run start:dev        # dejar corriendo en esta terminal
```

En otra terminal:

```powershell
cd C:\github\ApiTrace\frontend
npm run dev              # dejar corriendo
```

En una tercera:

```powershell
cd C:\github\ApiTrace\frontend
node capturas.mjs        # revisar arriba del archivo qué URL y qué usuarios usa
cd ..
npm run docs:pdf
Copy-Item docs\manuales\pdf\*.pdf landing\manuales\ -Force
```

Cierre:

```powershell
git add -A
git commit -m "docs: capturas y PDF regenerados con el DT-e corregido"
git push origin main
```

## Salida esperada

- `docs/capturas/escritorio/` y `docs/capturas/movil/` con fecha de hoy.
- Los nueve PDF regenerados en `docs/manuales/pdf/` y copiados a `landing/manuales/`.

## Verificación (gate)

- [ ] Abrir `docs/manuales/pdf/01-manual-productor.pdf`: las capturas del DT-e coinciden con
      la aplicación desplegada.
- [ ] `git status` limpio y `main` empujado.

## Qué NO hacer

- No apuntar `capturas.mjs` ni el seed a la base de producción.
- No subir el `.zip` de capturas (`docs/capturas-apitrace.zip`) si ya no corresponde al
  contenido de la carpeta: conviene regenerarlo o borrarlo.
