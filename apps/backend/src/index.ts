import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startBackend } from "#initialization/create-runtime.js";

// Load env from cwd first, then from repo root so local root-level .env works
// for both `pnpm --filter backend ...` and direct package execution.
loadEnv();
const moduleDir = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(moduleDir, "../../../.env") });

void startBackend().catch(() => {
  process.exitCode = 1;
});
