# T05 · Contenido de la landing y los manuales, y PDF (C4)

**Objetivo:** que lo publicado diga lo que el sistema hace hoy. Es el material que va a ver
SENASA y un productor antes de confiar en la plataforma.

**Cierra:** C-01 a C-12.

## Precondiciones

- T04 cumplido.
- Google Chrome instalado en `C:\Program Files\Google\Chrome\Application\chrome.exe`
  (lo exige `scripts/generate-manual-pdfs.js`).

## Pasos

```powershell
cd C:\github\ApiTrace
git apply --check docs\plan-dte\parches\04-contenido-landing-manuales.patch
git apply docs\plan-dte\parches\04-contenido-landing-manuales.patch
git status --short           # landing/index.html, README.md y 8 archivos de docs/manuales
```

Comprobar que no quedó ninguna de las afirmaciones sin respaldo:

```powershell
Select-String -Path landing\index.html, docs\manuales\*.md, README.md -Pattern "Homologada|Integración oficial|12 caracteres|criptográfic|AES-256|DTE_MAX_DAYS|WEIGHT_DISCREPANCY|HONEY_MAX_MOISTURE|SIMULATED|HOMOLOGATION|PRODUCTION|Contingencia Sanitaria|QR verificable|apitrace\.ar|apitrace\.test"
```

Regenerar los PDF y copiarlos al sitio:

```powershell
npm install                  # raíz: marked y puppeteer-core
npm run docs:pdf
Copy-Item docs\manuales\pdf\*.pdf landing\manuales\ -Force
Get-ChildItem landing\manuales\*.pdf | Select-Object Name, Length, LastWriteTime
```

## Salida esperada

- `Select-String` **sin ninguna coincidencia**. (Si aparece `apitrace.test` en algún manual
  que no tocó el parche, corregirlo a `@apitrace` a mano y anotarlo.)
- `npm run docs:pdf` imprime una línea por manual y termina con el manual maestro
  (`ApiTrace-Manual-Completo.pdf`).
- Los nueve PDF de `landing\manuales\` quedan con la fecha de hoy.

## Verificación (gate)

- [ ] Sin coincidencias en el `Select-String`.
- [ ] Nueve PDF regenerados en `docs\manuales\pdf\` y copiados a `landing\manuales\`.
- [ ] Abrir `landing\index.html` en el navegador: el bloque de cuentas de demostración
      muestra `productor@apitrace`, `sala@apitrace`, `acopio@apitrace`, `auditor@apitrace`,
      `laboratorio@apitrace` y `admin@apitrace`, y aclara que son de prueba.

## Qué NO hacer

- No "mejorar" el texto agregando funciones que todavía no existen (QR del frasco, firma
  criptográfica, homologación): el roadmap está en `08-Iteraciones-Futuras-y-Roadmap`.
- No dejar los PDF viejos en `landing\manuales\`: quedarían contradiciendo el Markdown.
- Las capturas dentro de los manuales siguen siendo las anteriores: se regeneran en T10, que
  es opcional y va después del despliegue.
