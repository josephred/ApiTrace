# T06 · Variables de entorno del despliegue

**Objetivo:** que el servicio desplegado tenga el canal de emisión y el barrido de vigencia
configurados antes de que llegue el código nuevo.

## Precondiciones

- T03 cumplido (el `render.yaml` corregido ya está en la rama).

## Pasos

`render.yaml` sirve para servicios creados desde el *blueprint*. Para los servicios que ya
existen, hay que agregar las variables en el panel (**Dashboard → el servicio →
Environment**), porque Render no las toma solo:

**Servicio `apitrace-api`:**

| Clave | Valor | Para qué |
| :--- | :--- | :--- |
| `SENASA_MODE` | `manual` | El DT-e se emite en SIGSA y en ApiTrace se registra su número |
| `SENASA_ENV` | `homologacion` | Sólo aplica cuando el canal sea `sigsa` |
| `DTE_LIFECYCLE_ENABLED` | `true` | Barrido EMITIDO → VIGENTE → VENCIDO → CADUCADO |
| `DTE_LIFECYCLE_INTERVAL_MS` | `600000` | Cada 10 minutos |

**Servicio `apitrace-web`:**

| Clave | Valor | Para qué |
| :--- | :--- | :--- |
| `VITE_DEMO_ACCESS` | `true` o `false` | Muestra u oculta el acceso rápido de demostración. **El valor lo decide T09.** Si todavía no se decidió, poner `false`. |

Verificar que `DATABASE_URL` del servicio `apitrace-api` apunta a la base de producción
(la misma que se diagnosticó en T01) y **no** a la rama de respaldo.

## Salida esperada

- Las cuatro variables presentes en `apitrace-api` y una en `apitrace-web`.
- Render marca los servicios para redeploy (o avisa que hay cambios pendientes).

## Verificación (gate)

- [ ] Variables cargadas en los dos servicios.
- [ ] `DATABASE_URL` verificada contra la base de producción.
- [ ] Nada apunta a la rama de respaldo.

## Qué NO hacer

- No poner `SENASA_MODE=simulado` en la instancia con datos reales: generaría números
  `SIM-` sin validez que después hay que limpiar.
- No poner `SENASA_MODE=sigsa`: el adaptador es un esqueleto y responde que la integración
  no está disponible (por diseño, hasta tener el contrato de SENASA).
- No guardar secretos en `render.yaml`: van en el panel.
