/**
 * `/app` is client-rendered.
 *
 * The shell reads the client runtime objects — the workbench, preferences, the
 * two projections over them — and those are browser-only by construction: their
 * accessors throw outside the browser, because a module-level instance on the
 * server would be shared by every request in the process.
 *
 * This costs content in the first paint and nothing else. Server load functions,
 * remote functions, and `+server.ts` endpoints all still work with SSR off — the
 * client router fetches them. `/` and `/demo` are unaffected and still render on
 * the server.
 *
 * See src/lib/runtime/client/client.md for why the guard rather than context.
 */
export const ssr = false;
