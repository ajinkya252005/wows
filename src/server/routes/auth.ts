import { Router } from 'express';
import bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import type { AuthUserDto } from '../../shared/contracts.js';
import type { MarketRuntime } from '../services/marketRuntime.js';
import { prisma } from '../lib/db.js';
import { HttpError } from '../lib/errors.js';
import { asyncHandler, requireAuth } from '../lib/http.js';
import { moneyNumber } from '../lib/money.js';

const buildAuthUser = async (
  userId: number,
  displayName: string,
  role: AuthUserDto['role'],
): Promise<AuthUserDto> => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { cashBalance: true },
  });

  return {
    userId,
    displayName,
    role,
    cashBalance: moneyNumber(user.cashBalance.toString()),
  };
};

export const createAuthRouter = (runtime: MarketRuntime): Router => {
  const router = Router();

  router.post(
    '/login',
    asyncHandler(async (req, res) => {
      const username = String(req.body.username ?? '').trim();
      const password = String(req.body.password ?? '');

      if (!username || !password) {
        throw new HttpError(400, 'Username and password are required.');
      }

      const user = await prisma.user.findUnique({
        where: { username },
      });

      if (!user || !user.isActive) {
        throw new HttpError(401, 'Invalid credentials.');
      }

      const validPassword = await bcrypt.compare(password, user.passwordHash);
      if (!validPassword) {
        throw new HttpError(401, 'Invalid credentials.');
      }

      req.session.user = {
        userId: user.id,
        role: user.role,
        displayName: user.displayName,
      };

      const authUser = await buildAuthUser(user.id, user.displayName, user.role);
      const payload =
        user.role === UserRole.ADMIN
          ? await runtime.buildAdminBootstrap(authUser)
          : await runtime.buildParticipantBootstrap(authUser);

      res.json(payload);
    }),
  );

  router.post(
    '/logout',
    requireAuth,
    asyncHandler(async (req, res) => {
      await new Promise<void>((resolve, reject) => {
        req.session.destroy((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });

      res.status(204).send();
    }),
  );

  router.get(
    '/me',
    requireAuth,
    asyncHandler(async (req, res) => {
      const sessionUser = req.session.user!;
      const authUser = await buildAuthUser(
        sessionUser.userId,
        sessionUser.displayName,
        sessionUser.role,
      );

      res.json(authUser);
    }),
  );

  return router;
};
