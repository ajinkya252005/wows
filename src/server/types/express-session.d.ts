import 'express-session';
import type { SessionUser } from '../../shared/contracts.js';

declare module 'express-session' {
  interface SessionData {
    user?: SessionUser;
  }
}
