import { dev } from "$app/environment";
import { resetServerModelForBrowserHarness } from "$runtime/server/start.server";
import {
  disposableBrowserState,
  restoreDisposableBrowserState
} from "$development-views/external-files-reference/procedures/browser-reset-state.server";

import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
  const expected = process.env.ICARUS_BROWSER_RESET_TOKEN;
  const state = disposableBrowserState();
  if (
    !dev ||
    expected === undefined ||
    request.headers.get("x-icarus-browser-reset") !== expected ||
    state === undefined
  ) {
    return new Response("not found", { status: 404 });
  }

  await resetServerModelForBrowserHarness(() => restoreDisposableBrowserState(state));
  return new Response(null, { status: 204 });
};
