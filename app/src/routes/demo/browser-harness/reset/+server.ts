import { dev } from "$app/environment";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, resolve } from "node:path";

import { resetServerModelForBrowserHarness } from "$runtime/server/start.server";

import type { RequestHandler } from "./$types";

const PREFIX = "icarus-browser-store-";

const disposableDirectory = (): { readonly store: string; readonly seed: string } | undefined => {
  const store = process.env.ICARUS_BROWSER_RESET_DIRECTORY?.trim();
  const seed = process.env.ICARUS_BROWSER_SEED_DIRECTORY?.trim();
  if (!store || !seed) return undefined;
  if (resolve(dirname(store)) !== resolve(tmpdir()) || !basename(store).startsWith(PREFIX)) {
    throw new Error("The browser harness refused to reset a non-disposable Store directory");
  }
  return { store, seed };
};

export const POST: RequestHandler = async ({ request }) => {
  const expected = process.env.ICARUS_BROWSER_RESET_TOKEN;
  const directory = disposableDirectory();
  if (
    !dev ||
    expected === undefined ||
    request.headers.get("x-icarus-browser-reset") !== expected ||
    directory === undefined
  ) {
    return new Response("not found", { status: 404 });
  }

  await resetServerModelForBrowserHarness(() => {
    rmSync(directory.store, { recursive: true, force: true });
    mkdirSync(directory.store, { recursive: true });
    cpSync(directory.seed, directory.store, { recursive: true });
  });
  return new Response(null, { status: 204 });
};
