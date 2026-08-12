import { buildRuntime } from "#initialization/runtime-initialization.js";

const runtime = await buildRuntime();

// The only line printed to stdout. Request telemetry belongs in the log file,
// but a dev server that says nothing at all gives no way to tell it came up.
console.log(`backend listening on ${runtime.address}`);

let closing: Promise<void> | undefined;

const closeRuntime = (): void => {
  closing ??= runtime.close().catch((error: unknown): void => {
    process.exitCode = 1;
    console.error("backend shutdown failed", error);
  });
};

// Process termination releases OS resources, but does not run application
// cleanup. Handle normal stop signals so Fastify, PGlite, and the logger close
// in order; `once` leaves a second signal to use Node's forced exit.
process.once("SIGINT", closeRuntime);
process.once("SIGTERM", closeRuntime);
