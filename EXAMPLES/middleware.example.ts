/**
 * EXAMPLE FILE — Auth middleware (requireAuth)
 * Context: a fake "library" app. Not your actual code.
 * Use this as a reference while writing src/middleware/auth.middleware.ts
 *
 * Middleware is a function that runs BETWEEN the route and the controller.
 * requireAuth has one job: verify the JWT. If valid → call next().
 * If missing or invalid → send 401 and stop. The controller never runs.
 *
 * User stories this enables:
 *   Every protected route — US-03 and beyond. Without this middleware,
 *   there is no way to know who the logged-in user is.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// ---------------------------------------------------------------------------
// THE SHAPE OF THE DECODED JWT PAYLOAD
// ---------------------------------------------------------------------------
// jwt.verify() returns `unknown` — we cast it to this interface after
// verifying so TypeScript knows what properties to expect.

interface JwtPayload {
  userId: string;
}

// ---------------------------------------------------------------------------
// requireAuth — the middleware function
// ---------------------------------------------------------------------------
// Signature: (req, res, next) — same as a controller, but with next().
// next() tells Express: "I'm done here, move on to the next handler."
// In a protected route: router.get('/me', requireAuth, handleGetMe)
//   1. requireAuth runs first
//   2. If it calls next(), handleGetMe runs
//   3. If it sends a 401, handleGetMe never runs

const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  // Step 1 — read the Authorization header
  // The frontend sends: Authorization: Bearer <token>
  // We split on ' ' and take index [1] to get just the token string.
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No token at all — stop here, never call next()
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];

  // Step 2 — verify the token
  // jwt.verify() throws if the token is expired, tampered with, or signed
  // with the wrong secret. We catch that and return 401.
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');

  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;

    // Step 3 — attach userId to req.user so the controller can read it
    // req.user is a custom property — it does not exist on Express's Request
    // type by default. You need src/types/express.d.ts to declare it.
    req.user = { userId: decoded.userId };

    // Step 4 — call next() to hand off to the controller
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export { requireAuth };

// =============================================================
// HOW A PROTECTED ROUTE USES THIS
// =============================================================
//
// In a routes file (e.g. src/routes/users.routes.ts):
//
//   import { requireAuth } from '../middleware/auth.middleware';
//   import { handleGetMe } from '../controllers/users.controller';
//
//   router.get('/me', requireAuth, handleGetMe);
//                     ^^^^^^^^^^^
//                     This is the third argument — middleware runs first,
//                     then handleGetMe only if next() was called.
//
// =============================================================
// THE TYPE DECLARATION YOU ALSO NEED TO CREATE
// =============================================================
//
// TypeScript does not know req.user exists. You must tell it.
// Create src/types/express.d.ts with this content:
//
//   import { Request } from 'express';
//
//   declare global {
//     namespace Express {
//       interface Request {
//         user?: { userId: string };
//       }
//     }
//   }
//
// This is called "module augmentation" — you are adding a property
// to an existing third-party type without modifying the library.
// The ? makes it optional because unauthenticated routes don't have it.
