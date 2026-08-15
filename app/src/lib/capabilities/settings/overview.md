# Settings

Named values a project holds, keyed by string. The smallest capability there is, and the
first one on Convex.

## Public Surface

Both functions are registered in
[`src/convex/capabilities/settings.ts`](../../../convex/capabilities/settings.ts) and reached
as `api.capabilities.settings.*`.

| Function | Kind | Answers |
| --- | --- | --- |
| `list` | query | every setting in one project, in key order |
| `set` | mutation | writes one setting, creating it if absent |

## Neither function is authenticated

**Anyone who knows the deployment URL can read and write any project's settings.** Both
take `projectId` as an ordinary argument and trust it; there is no identity check and no
membership lookup.

This is a deliberate limit of the first Convex slice, not an oversight. What it buys is that
the slice proves the connection — schema, function, reactivity, a browser — with nothing else
in the way. What it costs is that this capability must not hold anything worth protecting
until the scope gate exists.

Closing it means a `projectQuery`/`projectMutation` wrapper that reads
`ctx.auth.getUserIdentity()` and resolves membership before the handler runs, so `projectId`
stops being an argument the caller chooses.

## Data Ownership

| Stored | Purpose |
| ------ | ------- |
| `settings` | one row per (project, key), holding the JSON-encoded value and when it was written |

The table is declared in [`schema.ts`](schema.ts) and composed into the deployment schema by
[`src/convex/schema.ts`](../../../convex/schema.ts). `projectId` leads its index, which is
what makes a project-scoped read the cheap one.

## Capability Invariants

- **A key is canonical before it is stored or looked up.** `Editor.Theme` and `editor.theme`
  are one setting. `set` canonicalizes before its read, so the two contend for one row rather
  than becoming two that shadow each other by write order.
- **One row per (project, key).** Convex has no unique index, so this is preserved by
  `set` reading before it writes inside a serializable mutation rather than by a constraint.
- **A stored value is JSON text.** `types/settings.ts` describes what a consumer sees; the
  encoding is a storage decision and does not appear in it.
