#!/usr/bin/env node
/** Starts Vite against disposable represented and native-file repositories. */
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { execFileSync, spawn } from "node:child_process";
import {
  browserConfigurationSections,
  copyBrowserConfiguration
} from "./browser-configuration.mjs";

const port = Number(process.argv[2]);
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("browser-server: expected a valid port");
}

const supplied = process.env.ICARUS_BROWSER_STORE_DIRECTORY?.trim();
const storeDirectory = supplied || mkdtempSync(join(tmpdir(), "icarus-browser-store-"));
const owned = supplied === undefined || supplied.length === 0;
const suppliedProviderOrigin = process.env.ICARUS_BROWSER_PROVIDER_ORIGIN?.trim();
const providerOrigin = (() => {
  if (suppliedProviderOrigin === undefined || suppliedProviderOrigin.length === 0) return undefined;
  const parsed = new URL(suppliedProviderOrigin);
  if (
    parsed.protocol !== "http:" ||
    parsed.hostname !== "127.0.0.1" ||
    parsed.pathname !== "/" ||
    parsed.search !== "" ||
    parsed.hash !== ""
  ) {
    throw new Error("browser-server: provider origin must be an HTTP loopback origin");
  }
  return parsed.origin;
})();
const configurationDirectory =
  providerOrigin === undefined || providerOrigin.length === 0
    ? undefined
    : mkdtempSync(join(tmpdir(), "icarus-browser-configuration-"));
const suppliedExternalFiles = process.env.ICARUS_BROWSER_EXTERNAL_FILE_DIRECTORY?.trim();
const externalFileDirectory = suppliedExternalFiles ||
  mkdtempSync(join(tmpdir(), "icarus-browser-external-files-"));
const externalFilesOwned = suppliedExternalFiles === undefined || suppliedExternalFiles.length === 0;

if (owned) cpSync(join(process.cwd(), "seed"), storeDirectory, { recursive: true });
if (configurationDirectory !== undefined) {
  const trackedSections = browserConfigurationSections(
    execFileSync("git", ["ls-files", "--", "configuration"], {
      cwd: process.cwd(),
      encoding: "utf8"
    }).split(/\r?\n/u)
  );
  copyBrowserConfiguration({
    sourceDirectory: join(process.cwd(), "configuration"),
    destinationDirectory: configurationDirectory,
    trackedSections,
    overlay: "overlays/browser-providers.yaml",
    providerOrigin
  });
}

let cleaned = false;
const cleanup = () => {
  if (cleaned) return;
  cleaned = true;
  if (
    owned &&
    dirname(storeDirectory) === tmpdir() &&
    basename(storeDirectory).startsWith("icarus-browser-store-")
  ) {
    rmSync(storeDirectory, { recursive: true, force: true });
  }
  if (
    configurationDirectory !== undefined &&
    dirname(configurationDirectory) === tmpdir() &&
    basename(configurationDirectory).startsWith("icarus-browser-configuration-")
  ) {
    rmSync(configurationDirectory, { recursive: true, force: true });
  }
  if (
    externalFilesOwned &&
    dirname(externalFileDirectory) === tmpdir() &&
    basename(externalFileDirectory).startsWith("icarus-browser-external-files-")
  ) {
    rmSync(externalFileDirectory, { recursive: true, force: true });
  }
};

const child = spawn(
  process.execPath,
  [
    join(process.cwd(), "node_modules/vite/bin/vite.js"),
    "dev",
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--strictPort"
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      ICARUS_STORE_DIRECTORY: storeDirectory,
      ...(configurationDirectory === undefined
        ? {}
        : { ICARUS_CONFIGURATION_DIRECTORY: configurationDirectory }),
      ...(owned
        ? {
            ICARUS_BROWSER_RESET_DIRECTORY: storeDirectory,
            ICARUS_BROWSER_SEED_DIRECTORY: join(process.cwd(), "seed"),
            ICARUS_BROWSER_RESET_EXTERNAL_FILE_DIRECTORY: externalFileDirectory
          }
        : {}),
      ICARUS_EXTERNAL_FILE_DIRECTORY: externalFileDirectory
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
