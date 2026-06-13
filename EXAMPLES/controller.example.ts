/**
 * EXAMPLE FILE — Controller layer (HTTP handling)
 * Context: a fake "library" app. Not your actual code.
 * Use this as a reference while writing src/controllers/auth.controller.ts
 *
 * The controller is the ONLY layer that knows about req and res.
 * Its job is purely mechanical: unpack the request, call the service,
 * send one response. No business logic, no SQL — ever.
 *
 * Pattern repeated on every controller in phases 8–12:
 *   1. unpack req
 *   2. call service
 *   3. send res
 *   4. catch errors and translate to HTTP status codes
 */

import { Request, Response } from 'express';
import { register, login, AppError } from '../src/services/auth.service'; // real: '../services/auth.service'

// ---------------------------------------------------------------------------
// THE ERROR HANDLER — used identically in every controller function
// ---------------------------------------------------------------------------
// AppError = operational error (Lesson 74): safe message, meaningful status
// Anything else = programmer error: generic message, 500
//
// This pattern is temporary — Phase 13 moves it into a global error
// middleware so controllers don't repeat it. For now, inline is fine.

const handleError = (error: unknown, res: Response): void => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  res.status(500).json({ error: 'Something went wrong' });
};

// ---------------------------------------------------------------------------
// handleRegister — serves US-01 "a visitor creates an account"
// ---------------------------------------------------------------------------

const handleRegister = async (req: Request, res: Response): Promise<void> => {
  try {
    // Pull ONLY what register() needs from req.body.
    // Never pass the whole req.body object into a service — it may contain
    // extra fields (prototype pollution, unexpected data). Be explicit.
    const { username, email, password } = req.body;

    const result = await register({ username, email, password });

    // 201 Created — a new resource was made, not just a read
    res.status(201).json(result);
  } catch (error: unknown) {
    handleError(error, res);
  }
};

// ---------------------------------------------------------------------------
// handleLogin — serves US-02 "a returning member proves who they are"
// ---------------------------------------------------------------------------

const handleLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const result = await login(email, password);

    // 200 OK — login is not creating a resource, just authenticating
    res.status(200).json(result);
  } catch (error: unknown) {
    handleError(error, res);
  }
};

// ---------------------------------------------------------------------------
// EXPORTS
// ---------------------------------------------------------------------------

export { handleRegister, handleLogin };

// =============================================================
// WHAT THIS LAYER DOES NOT DO
// =============================================================
//
// - No SQL. Never imports from models.
// - No business decisions. "Is the email taken?" is the service's question.
// - No req/res passed into the service. Only plain values go in,
//   plain objects come out.
// - No logic in the error handler — just translate AppError to its
//   status, or fall back to 500.
//
// =============================================================
// HOW THE ROUTE WILL USE THIS (preview — you'll write it next)
// =============================================================
//
// In src/routes/auth.routes.ts:
//
//   import { handleRegister, handleLogin } from '../controllers/auth.controller';
//
//   router.post('/register', handleRegister);
//   router.post('/login', handleLogin);
//
// The route file maps URLs to handler functions.
// The handler functions are defined here.
// That is the complete relationship between these two files.
