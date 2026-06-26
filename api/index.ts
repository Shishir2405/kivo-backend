/**
 * Vercel serverless entrypoint for the Kivo API.
 *
 * Vercel is serverless: it has no long-running process to `app.listen()` on, no
 * place to keep BullMQ workers / Socket.IO / repeatable schedulers alive. This file
 * exposes the Express app as a request handler and nothing else.
 *
 * IMPORTANT: we import the COMPILED app from `../dist/app`, not `../src/app` or a
 * `@/`-aliased path. @vercel/node bundles the function with esbuild, which does NOT
 * resolve the project's `@/*` TypeScript path aliases at runtime — importing alias
 * source would crash the function (FUNCTION_INVOCATION_FAILED). `npm run build`
 * (tsc + tsc-alias) emits `dist/**` with every alias rewritten to a real relative
 * path, so the compiled output is safe to require. `vercel.json` runs that build and
 * ships `dist/**` alongside the function (`includeFiles`).
 */
import type { Application } from 'express';

// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const { createApp } = require('../dist/app') as { createApp: () => Application };

// Build the Express app once per cold start (module scope is reused across warm
// invocations). createApp() does NOT open any sockets or call app.listen(); Redis,
// BullMQ, and Firebase are all lazy, so importing/instantiating is side-effect free.
const app: Application = createApp();

// Export the Express app directly. @vercel/node detects an Express-style
// `(req, res)` handler and drives it per request. No app.listen().
export default app;
