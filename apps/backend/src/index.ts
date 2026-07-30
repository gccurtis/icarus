import { startBackend } from "#init/startBackend.js";

void startBackend().catch((error) => {
  console.error(error);
  process.exit(1);
});
