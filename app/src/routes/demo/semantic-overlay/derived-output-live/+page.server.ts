import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

/** Enter the configured development project without weakening normal scope resolution. */
export const load: PageServerLoad = ({ locals }) => {
  const token = locals.model.configuration.get("development.projectToken");
  if (typeof token !== "string" || token.length === 0) {
    throw new Error("Configuration key 'development.projectToken' must be a non-empty string");
  }
  redirect(307, `/demo/${token}/semantic-overlay/derived-output-live`);
};
