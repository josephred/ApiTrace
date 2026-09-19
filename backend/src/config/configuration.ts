export interface AppConfig {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
  corsOrigins: string[];
  database: {
    url: string;
    poolMax: number;
    ssl: boolean;
    isNeon: boolean;
    connectionTimeoutMs: number;
    idleTimeoutMs: number;
  };
  jwt: {
    accessSecret: string;
    accessTtl: string;
    refreshSecret: string;
    refreshTtlDays: number;
  };
  swagger: {
    enabled: boolean;
    path: string;
  };
  outbox: {
    enabled: boolean;
    intervalMs: number;
    batchSize: number;
    maxAttempts: number;
  };
  throttle: {
    ttlMs: number;
    limit: number;
  };
  senasa: {
    mode: 'MANUAL' | 'SIMULADO' | 'SIGSA';
    apiUrl: string;
    apiKey: string;
    timeoutMs: number;
  };
  dteLifecycle: {
    enabled: boolean;
    intervalMs: number;
  };
}

const toBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/** TLS obligatorio: proveedores gestionados o `sslmode` explicito en la URL. */
const requiresTls = (url: string): boolean =>
  /\bneon\.tech\b/.test(url) ||
  /\brender\.com\b/.test(url) ||
  /[?&]sslmode=(require|verify-ca|verify-full)\b/.test(url);

export const configuration = (): AppConfig => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const databaseUrl = process.env.DATABASE_URL ?? '';

  return {
    nodeEnv,
    port: toInt(process.env.PORT, 3000),
    apiPrefix: process.env.API_PREFIX ?? 'api/v1',
    corsOrigins: (process.env.CORS_ORIGINS ?? '*')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    database: {
      url: databaseUrl,
      poolMax: toInt(process.env.DATABASE_POOL_MAX, 10),
      // Neon y Render exigen TLS. Tambien se activa si la propia URL lo pide
      // con sslmode=require, que es como Neon entrega la cadena de conexion.
      ssl: toBool(process.env.DATABASE_SSL, requiresTls(databaseUrl)),
      /**
       * Neon suspende el computo tras unos minutos sin actividad (scale to zero).
       * La primera consulta despues de una suspension despierta la instancia y
       * puede tardar segundos: por eso los timeouts son mas holgados que los
       * habituales contra un PostgreSQL siempre encendido.
       */
      isNeon: /\bneon\.tech\b/.test(databaseUrl),
      connectionTimeoutMs: toInt(
        process.env.DATABASE_CONNECTION_TIMEOUT_MS,
        /\bneon\.tech\b/.test(databaseUrl) ? 20_000 : 10_000,
      ),
      idleTimeoutMs: toInt(process.env.DATABASE_IDLE_TIMEOUT_MS, 30_000),
    },
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
      accessTtl: process.env.JWT_ACCESS_TTL ?? '30m',
      refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
      refreshTtlDays: toInt(process.env.JWT_REFRESH_TTL_DAYS, 14),
    },
    swagger: {
      enabled: toBool(process.env.SWAGGER_ENABLED, nodeEnv !== 'production'),
      path: process.env.SWAGGER_PATH ?? 'docs',
    },
    outbox: {
      enabled: toBool(process.env.OUTBOX_ENABLED, true),
      intervalMs: toInt(process.env.OUTBOX_INTERVAL_MS, 5000),
      batchSize: toInt(process.env.OUTBOX_BATCH_SIZE, 50),
      maxAttempts: toInt(process.env.OUTBOX_MAX_ATTEMPTS, 5),
    },
    throttle: {
      ttlMs: toInt(process.env.THROTTLE_TTL_MS, 60000),
      limit: toInt(process.env.THROTTLE_LIMIT, 240),
    },
    senasa: {
      mode: (['MANUAL', 'SIMULADO', 'SIGSA'].includes(process.env.SENASA_MODE?.toUpperCase() ?? '')
        ? process.env.SENASA_MODE!.toUpperCase()
        : 'SIMULADO') as 'MANUAL' | 'SIMULADO' | 'SIGSA',
      apiUrl: process.env.SENASA_API_URL ?? 'https://api-sem.senasa.gob.ar/v1',
      apiKey: process.env.SENASA_API_KEY ?? '',
      timeoutMs: toInt(process.env.SENASA_TIMEOUT_MS, 15000),
    },
    dteLifecycle: {
      enabled: toBool(process.env.DTE_LIFECYCLE_ENABLED, true),
      intervalMs: toInt(process.env.DTE_LIFECYCLE_INTERVAL_MS, 60000),
    },
  };
};

/**
 * Falla al arrancar si falta configuracion critica: es preferible que el deploy
 * no levante a que quede corriendo con secretos por defecto.
 */
export const validateConfig = (config: AppConfig): AppConfig => {
  const errors: string[] = [];

  if (!config.database.url) {
    errors.push('DATABASE_URL es obligatoria.');
  }
  if (!config.jwt.accessSecret || config.jwt.accessSecret.length < 32) {
    errors.push('JWT_ACCESS_SECRET es obligatoria y debe tener al menos 32 caracteres.');
  }
  if (!config.jwt.refreshSecret || config.jwt.refreshSecret.length < 32) {
    errors.push('JWT_REFRESH_SECRET es obligatoria y debe tener al menos 32 caracteres.');
  }
  if (config.jwt.accessSecret && config.jwt.accessSecret === config.jwt.refreshSecret) {
    errors.push('JWT_ACCESS_SECRET y JWT_REFRESH_SECRET deben ser distintas.');
  }

  if (errors.length > 0) {
    throw new Error(`Configuracion invalida:\n  - ${errors.join('\n  - ')}`);
  }

  // Neon ofrece dos endpoints: el directo y el agrupado (sufijo `-pooler`).
  // Con varias instancias del web service conviene el agrupado, porque el
  // limite de conexiones del plan gratuito se agota rapido.
  if (config.database.isNeon && !/-pooler\./.test(config.database.url)) {
    // eslint-disable-next-line no-console
    console.warn(
      '[config] Neon: se esta usando el endpoint directo. Para varias instancias, ' +
        'preferir el endpoint agrupado (host con sufijo -pooler).',
    );
  }

  return config;
};
