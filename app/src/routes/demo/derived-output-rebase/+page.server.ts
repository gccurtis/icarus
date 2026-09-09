import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ locals }) => {
  const token = locals.model.configuration.get("development.projectToken");

  if (typeof token !== "string" || token.length === 0) {
    throw new Error(
      "Configuration key 'development.projectToken' must be a non-empty string — see configuration/dev.yaml"
    );
  }

  redirect(307, `/demo/${token}/reference/derived-output-rebase`);
};
