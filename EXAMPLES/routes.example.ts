/**
 * EXAMPLE FILE — Routes layer
 * Context: a fake "library" app. Not your actual code.
 * Use this as a reference while writing src/routes/auth.routes.ts
 *
 * The routes file has ONE job: map a URL + HTTP method to a controller function.
 * Nothing else. No logic, no SQL, no business decisions — ever.
 *
 * User story this serves:
 *   US-01: A visitor creates a library account → POST /auth/register
 *   US-02: A member logs in                   → POST /auth/login
 */

import { Router } from 'express';
import { handleRegister, handleLogin } from '../src/controllers/auth.controller'; // real: '../controllers/auth.controller'

// Router() creates a mini Express app that handles its own set of routes.
// It gets mounted into the main app in index.ts at a prefix (e.g. '/auth').
const router = Router();

// POST /auth/register  →  handleRegister
// The route only declares the METHOD and the PATH SUFFIX.
// The '/auth' prefix is added when it is mounted in index.ts.
router.post('/register', handleRegister);

// POST /auth/login  →  handleLogin
router.post('/login', handleLogin);

export default router;

// =============================================================
// HOW THIS MOUNTS INTO THE APP (you will do this in index.ts)
// =============================================================
//
//   import authRouter from './routes/auth.routes';
//   app.use('/api/v1/auth', authRouter);
//
//   Result:
//     POST /api/v1/auth/register  →  handleRegister
//     POST /api/v1/auth/login     →  handleLogin
//
// The prefix '/api/v1/auth' lives in index.ts — NOT in this file.
// That way, if the business decides to change the version prefix
// from v1 to v2, only index.ts changes, not every route file.
//
// =============================================================
// WHAT THIS FILE DOES NOT DO
// =============================================================
//
// - No req/res — only the controller touches those.
// - No imports from models or services — routes do not know SQL exists.
// - No if statements, no try/catch, no logic of any kind.
// - No middleware yet — auth middleware comes in Phase 7b
//   and will be added as a third argument: router.get('/me', requireAuth, handleGetMe)
