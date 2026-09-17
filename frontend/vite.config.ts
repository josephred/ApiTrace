import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      // Se precachea el app shell completo: la aplicacion arranca sin red desde
      // la primera visita. Las respuestas de la API NO se cachean aqui, sino en
      // IndexedDB (src/lib/db.ts), porque hace falta acceso estructurado a los
      // datos para mezclar lo cacheado con lo que espera en la cola de envio.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        // Nunca servir el shell cacheado para rutas de API.
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'ApiTrace - Trazabilidad Apicola',
        short_name: 'ApiTrace',
        description:
          'Registro y consulta de trazabilidad apicola. Funciona sin conexion y sincroniza al recuperar senal.',
        lang: 'es-AR',
        theme_color: '#c8871b',
        background_color: '#faf8f3',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        categories: ['business', 'productivity', 'utilities'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          { name: 'Movimientos', url: '/movements' },
          { name: 'Trazabilidad', url: '/trace' },
          { name: 'Pendientes de sincronizar', url: '/pending' },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      // En desarrollo se evita CORS enviando /api al backend local.
      //
      // La clave es una expresion regular y no el prefijo '/api' porque Vite
      // compara por prefijo: '/api' tambien capturaba '/apiaries', de modo que
      // recargar esa ruta devolvia una respuesta vacia en lugar de la
      // aplicacion. Exigir la barra deja fuera las rutas del enrutador.
      '^/api/': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  // El mismo proxy en `preview` permite probar el build de produccion, con su
  // service worker real, contra el backend local antes de desplegar.
  preview: {
    port: 4173,
    proxy: {
      '^/api/': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
});
