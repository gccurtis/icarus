import { buildRuntime } from "#initialization/runtime-initialization.js";

const runtime = await buildRuntime();

// The only line printed to stdout. Request telemetry belongs in the log file,
// but a dev server that says nothing at all gives no way to tell it came up.
console.log(`backend listening on ${runtime.address}`);
