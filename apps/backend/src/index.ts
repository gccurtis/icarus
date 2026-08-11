import { config as loadEnv } from "dotenv";
import { startBackend } from "#initialization/create-runtime.js";
import { repositoryEnvFile } from "#initialization/paths.js";

// Load env from cwd first, then from the repository root so a root-level .env
// works for both `pnpm --filter backend ...` and direct package execution.
// `quiet` suppresses the per-file banner dotenv prints from v17 onward.
loadEnv({ quiet: true });
loadEnv({ path: repositoryEnvFile, quiet: true });

void startBackend().catch((error: unknown) => {
  // Report why startup failed. Discarding this hid a broken configuration path
  // behind a silent exit.
  console.error("backend failed to start:", error);
  process.exitCode = 1;
});
