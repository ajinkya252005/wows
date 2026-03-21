const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseNumber(process.env.PORT, 3000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  sessionSecret: process.env.SESSION_SECRET ?? 'development-session-secret',
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  priceTickMs: parseNumber(process.env.PRICE_TICK_MS, 10_000),
};

export const isProduction = env.nodeEnv === 'production';
