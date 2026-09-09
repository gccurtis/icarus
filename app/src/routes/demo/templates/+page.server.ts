import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

/**
 * Keep the memorable demo URL while entering the scope every Template remote
 * function already requires. This is the same configured development handle
 * used by `/app`; it changes no authorization rule and exposes no new route to
 * a project the current session cannot resolve.
 */
export const load: PageServerLoad = ({ locals }) => {
  const token = locals.model.configuration.get("development.projectToken");

  if (typeof token !== "string" || token.length === 0) {
    throw new Error(
      "Configuration key 'development.projectToken' must be a non-empty string — see configuration/dev.yaml"
    );
  }

  redirect(307, `/demo/${token}/reference/templates`);
};
