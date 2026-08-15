import { v } from "convex/values";
import { mutation, query } from "$convex/_generated/server";
import { list as listSettings } from "$settings/api/list/list";
import { set as setSetting } from "$settings/api/set/set";

/**
 * Settings' public surface. **This file's path is its public name** — every
 * export here is `api.capabilities.settings.<name>`, reachable by anything that
 * knows the deployment URL.
 *
 * The registrations are written here rather than re-exported from the capability
 * for two reasons: codegen sees a real `query({...})` call and types it properly,
 * where a re-export through a path alias can degrade the generated API to
 * `AnyApi`; and a Convex module only becomes a function by sitting under the
 * functions directory, so this is the one place it could be.
 *
 * Everything below the `handler` line lives in `$settings`. What stays here is
 * the argument contract and nothing else.
 *
 * **Admission is here, not in the procedure.** Remote functions were declared
 * `'unchecked'` because the procedure re-validated everything it received; a
 * Convex validator is the documented security boundary for a public function, so
 * the shape is checked at the door. Canonicalizing a key is semantics and stays
 * with the procedure that owns the invariant.
 *
 * **Neither function is authenticated.** Both trust the `projectId` they are
 * handed, so anyone holding the deployment URL can read and write any project's
 * settings. That is a deliberate limit of this slice, recorded in
 * `$settings/overview.md`, and the next slice closes it.
 */
export const list = query({
  args: { projectId: v.string() },
  handler: (ctx, args) => listSettings(ctx, args.projectId)
});

export const set = mutation({
  args: { projectId: v.string(), key: v.string(), value: v.string() },
  handler: (ctx, args) => setSetting(ctx, args.projectId, args.key, JSON.parse(args.value))
});
