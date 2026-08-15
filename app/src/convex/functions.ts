import { customMutation, customQuery } from "convex-helpers/server/customFunctions";
import { v } from "convex/values";
import { resolveScope } from "$access/api/shared/resolve-scope";
import { mutation, query } from "$convex/_generated/server";

/**
 * The scoped function builders. **Every capability function is built from one of
 * these**, and this is the only module that imports `query` or `mutation`.
 *
 * That is the whole of the access control story. A Convex function is public the
 * moment it is registered, so "is this call allowed" cannot live in middleware a
 * request passes through — there is no request pipeline. It lives in what the
 * function is *made of*, which is why a bare `query(...)` outside this file is a
 * defect rather than a style choice, and why lint says so.
 *
 * **`args: {}` is the security property, not the ergonomics.** The wrapper
 * declares `projectToken` and consumes it, so the handler's argument type has no
 * project in it at all — nothing to read, shadow, or forward. A handler cannot
 * act on a project it was not scoped to, because it cannot name one.
 *
 * What it receives instead is `ctx.scope`, and a handler holding one does not
 * check it: a `Scope` exists only because `resolveScope` produced one, and it
 * produces one only for a project the asking user holds a membership in.
 *
 * The two are written out rather than sharing a configuration object, because
 * the query and mutation contexts are different types and a shared literal
 * erases both.
 *
 * A capability that legitimately has no project — signing in, listing what you
 * belong to, seeding the first membership — registers with `query`/`mutation`
 * directly and says why in its document. That is rare, and it should look
 * unusual.
 */
export const projectQuery = customQuery(query, {
  args: { projectToken: v.string() },
  input: async (ctx, args) => ({
    ctx: { scope: await resolveScope(ctx, args.projectToken) },
    args: {}
  })
});

export const projectMutation = customMutation(mutation, {
  args: { projectToken: v.string() },
  input: async (ctx, args) => ({
    ctx: { scope: await resolveScope(ctx, args.projectToken) },
    args: {}
  })
});
