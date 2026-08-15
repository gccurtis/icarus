import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

/**
 * `/app` names no project, so it sends you to one.
 *
 * A client instance acts on exactly one project for its whole life, and the
 * project token in its URL is the only per-tab identity a browser hands out for
 * free — which is what lets two tabs hold two different projects, and what lets
 * a tab come back to the same one after a reload.
 *
 * The token is not a credential and does not scope anything by sitting here: a
 * remote function cannot see the page that called it, so the client reads this
 * out of its own URL and sends it with every call. See
 * `model/server/scope.server.ts`.
 *
 * Until authentication exists there is one project and one handle to it, named
 * in `configuration/dev.yaml`. When a real picker arrives this becomes a lookup
 * of the user's last project, and nothing below it changes.
 */
export const load: PageServerLoad = ({ locals }) => {
  const token = locals.model.configuration.get("development.projectToken");

  if (typeof token !== "string" || token.length === 0) {
    throw new Error(
      "Configuration key 'development.projectToken' must be a non-empty string — see configuration/dev.yaml"
    );
  }

  redirect(307, `/app/${token}`);
};
