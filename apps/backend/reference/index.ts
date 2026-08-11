import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startBackend } from "#initialization/create-runtime.js";

// Load env from cwd first, then from repo root so local root-level .env works
// for both `pnpm --filter backend ...` and direct package execution.
// `quiet` suppresses the per-file banner dotenv prints from v17 onward.
loadEnv({ quiet: true });
const moduleDir = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(moduleDir, "../../../.env"), quiet: true });

void startBackend().catch((error: unknown) => {
  // Report why startup failed. Discarding this hid a broken configuration path
  // behind a silent exit.
  console.error("backend failed to start:", error);
  process.exitCode = 1;
});
