#!/usr/bin/env node
/** Starts Vite against a disposable copy of the committed represented seed. */
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { spawn } from "node:child_process";

const port = Number(process.argv[2]);
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("browser-server: expected a valid port");
}

const supplied = process.env.ICARUS_BROWSER_STORE_DIRECTORY?.trim();
const storeDirectory = supplied || mkdtempSync(join(tmpdir(), "icarus-browser-store-"));
const owned = supplied === undefined || supplied.length === 0;

if (owned) cpSync(join(process.cwd(), "seed"), storeDirectory, { recursive: true });

let cleaned = false;
const cleanup = () => {
  if (cleaned || !owned) return;
  cleaned = true;
  if (
    dirname(storeDirectory) === tmpdir() &&
    basename(storeDirectory).startsWith("icarus-browser-store-")
  ) {
    rmSync(storeDirectory, { recursive: true, force: true });
  }
};

const executable = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const child = spawn(
  executable,
  ["dev", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      ICARUS_STORE_DIRECTORY: storeDirectory,
      ...(owned
        ? {
            ICARUS_BROWSER_RESET_DIRECTORY: storeDirectory,
            ICARUS_BROWSER_SEED_DIRECTORY: join(process.cwd(), "seed")
          }
        : {})
    }
  }
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => child.kill(signal));
}

child.once("error", (error) => {
  cleanup();
  throw error;
});

child.once("exit", (code) => {
  cleanup();
  process.exitCode = code ?? 1;
});

process.once("exit", cleanup);
