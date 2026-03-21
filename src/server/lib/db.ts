import { PrismaClient } from '@prisma/client';
import pg from 'pg';
import { env } from './env.js';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  sessionPool?: pg.Pool;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.nodeEnv === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

export const sessionPool =
  globalForPrisma.sessionPool ??
  new pg.Pool({
    connectionString: env.databaseUrl,
  });

if (env.nodeEnv !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.sessionPool = sessionPool;
}
