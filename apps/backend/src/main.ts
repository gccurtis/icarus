import { buildRuntime } from "#runtime/build-runtime.js";

/**
 * The process entry point. It builds one backend runtime and arranges for it to
 * be stopped cleanly.
 *
 * Everything about *what* a runtime contains lives in
 * [`runtime/`](runtime/runtime.md); this file owns only the process itself.
 */
const runtime = await buildRuntime();

let closing: Promise<void> | undefined;

const stopRuntime = (): void => {
  // A second signal must not start a second shutdown: the first promise is
  // reused, so close runs once however many times we are asked.
  closing ??= runtime.close().catch((error: unknown): void => {
    process.exitCode = 1;
    console.error("backend shutdown failed", error);
  });
};

// Process termination releases OS resources, but does not run application
// cleanup. Handle normal stop signals so Fastify, PGlite, and observability
// close in order; `once` leaves a second signal to use Node's forced exit.
process.once("SIGINT", stopRuntime);
process.once("SIGTERM", stopRuntime);
