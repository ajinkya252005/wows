const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (!value) return fallback;

  switch (value.trim().toLowerCase()) {
    case '1':
    case 'true':
    case 'yes':
      return true;
    case '0':
    case 'false':
    case 'no':
      return false;
    default:
      return fallback;
  }
};

const normalizeOrigin = (value: string | undefined, fallback: string): string => {
  const next = value?.trim();

  if (!next) {
    return fallback;
  }

  return next.endsWith('/') ? next.slice(0, -1) : next;
};

const nodeEnv = process.env.NODE_ENV ?? 'development';

export const env = {
  nodeEnv,
  port: parseNumber(process.env.PORT, 3000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  sessionSecret: process.env.SESSION_SECRET ?? 'development-session-secret',
  clientUrl: normalizeOrigin(
    process.env.CLIENT_URL,
    nodeEnv === 'production' ? '' : 'http://localhost:5173',
  ),
  priceTickMs: parseNumber(process.env.PRICE_TICK_MS, 10_000),
  serveStaticClient: parseBoolean(process.env.SERVE_STATIC_CLIENT, true),
};

export const isProduction = env.nodeEnv === 'production';
