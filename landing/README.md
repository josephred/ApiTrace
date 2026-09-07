# Despliegue de la Landing Page de ApiTrace en Vercel (100% Gratis)

Esta carpeta contiene la landing page promocional estática de **ApiTrace**, optimizada para carga ultrarrápida, diseño responsive y SEO.

---

## Opción 1: Despliegue desde el Panel Web de Vercel (Recomendada)

1. Ingresa a [vercel.com](https://vercel.com) e inicia sesión con tu cuenta de **GitHub**.
2. Haz clic en el botón **"Add New..."** > **"Project"**.
3. Selecciona el repositorio **`ApiTrace`** y haz clic en **Import**.
4. En la configuración del proyecto:
   - **Root Directory:** Haz clic en *Edit* y selecciona la carpeta **`landing`**.
   - **Framework Preset:** Déjalo en *Other* (o *Static*).
5. Haz clic en **Deploy**.
6. ¡Listo! En unos 15 segundos tendrás tu URL pública gratuita (ej. `apitrace.vercel.app`).

---

## Opción 2: Despliegue mediante Vercel CLI (Línea de comandos)

Si tienes `vercel` instalado en tu terminal:

```bash
cd landing
npx vercel
```

Sigue las preguntas interactivas y se desplegará al instante.
