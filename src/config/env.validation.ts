/**
 * Validación de variables de entorno al boot.
 *
 * Se ejecuta una sola vez cuando ConfigModule arranca. Si algo falta o es
 * inválido tiramos error para no levantar el proceso con config rota.
 *
 * No usamos Joi para no sumar dependencia; validamos a mano con chequeos
 * simples y tipados.
 */
export type AppEnv = {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  DB_HOST: string;
  DB_PORT: number;
  DB_USERNAME: string;
  DB_PASSWORD: string;
  DB_DATABASE: string;
  JWT_SECRET: string;
  FRONTEND_URL?: string;
};

function required(config: Record<string, unknown>, key: string): string {
  const value = config[key];
  if (value === undefined || value === null || value === '') {
    throw new Error(`Falta la variable de entorno obligatoria: ${key}`);
  }
  return String(value);
}

function optional(
  config: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = config[key];
  if (value === undefined || value === null || value === '') return undefined;
  return String(value);
}

function toPort(value: string, key: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0 || n > 65535) {
    throw new Error(`${key} inválido. Debe ser un entero entre 1 y 65535.`);
  }
  return n;
}

export function validateEnv(config: Record<string, unknown>): AppEnv {
  const nodeEnvRaw = optional(config, 'NODE_ENV') ?? 'development';
  if (
    nodeEnvRaw !== 'development' &&
    nodeEnvRaw !== 'production' &&
    nodeEnvRaw !== 'test'
  ) {
    throw new Error(
      `NODE_ENV inválido: "${nodeEnvRaw}". Valores permitidos: development, production, test.`,
    );
  }

  // DB_DATABASE acepta legacy DB_NAME como fallback
  const dbDatabase =
    optional(config, 'DB_DATABASE') ?? optional(config, 'DB_NAME');
  if (!dbDatabase) {
    throw new Error('Falta la variable de entorno obligatoria: DB_DATABASE');
  }

  const jwtSecret = required(config, 'JWT_SECRET');
  if (jwtSecret.length < 32) {
    throw new Error(
      'JWT_SECRET demasiado corto. Debe tener al menos 32 caracteres.',
    );
  }

  return {
    NODE_ENV: nodeEnvRaw,
    PORT: toPort(optional(config, 'PORT') ?? '3001', 'PORT'),
    DB_HOST: required(config, 'DB_HOST'),
    DB_PORT: toPort(optional(config, 'DB_PORT') ?? '5432', 'DB_PORT'),
    DB_USERNAME: required(config, 'DB_USERNAME'),
    DB_PASSWORD: required(config, 'DB_PASSWORD'),
    DB_DATABASE: dbDatabase,
    JWT_SECRET: jwtSecret,
    FRONTEND_URL: optional(config, 'FRONTEND_URL'),
  };
}
