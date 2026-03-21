import type { NextFunction, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { HttpError } from './errors.js';

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

export const asyncHandler =
  (handler: AsyncHandler) => (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, next).catch(next);
  };

export const requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.session.user) {
    next(new HttpError(401, 'Authentication required.'));
    return;
  }
  next();
};

export const requireAdmin = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.session.user) {
    next(new HttpError(401, 'Authentication required.'));
    return;
  }

  if (req.session.user.role !== UserRole.ADMIN) {
    next(new HttpError(403, 'Admin access required.'));
    return;
  }

  next();
};

export const requireParticipant = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.session.user) {
    next(new HttpError(401, 'Authentication required.'));
    return;
  }

  if (req.session.user.role !== UserRole.PARTICIPANT) {
    next(new HttpError(403, 'Participant access required.'));
    return;
  }

  next();
};
