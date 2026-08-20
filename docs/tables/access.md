# Access

Three tables: who exists, what projects exist, and who may reach which.

`users` · `projects` · `memberships`

**The only tables not scoped to a project**, because they are what decides what a
project scope is.

---

## `users`

`app/src/lib/capabilities/access/schema/users.ts`

```ts
import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * A person.
 *
 * **Looked up by `authSubject`, never by email.** An email is a display value
 * that changes and can be reassigned at a provider; the subject claim is what
 * the provider promises is stable.
 *
 * **`settings` is a JSON string.** A setting value is recursive and a Convex
 * validator is a value rather than a type, so there is no recursive one to
 * write. Encoding also keeps an author-controlled key space out of Convex's
 * field-name rules — `{"$schema": …}` is a legal setting key and an illegal
 * field name. Nothing queries inside it, which is what makes the encoding free.
 *
 * **This row is read on every request**, so a field written by a background
 * process does not belong on it: every write invalidates every subscribed query
 * in the project.
 */
export const users = defineTable({
  authSubject: v.string(),
  /** A label over the identity, not the identity. */
  displayName: v.string(),
  email: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  settings: v.string(),
  updatedAt: v.number()
}).index("by_auth_subject", ["authSubject"]);
```

---

## `projects`

`app/src/lib/capabilities/access/schema/projects.ts`

```ts
import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * A project. Everything else in the schema is scoped to one.
 *
 * **No index.** A project is never listed globally — that would be the one query
 * in the schema with no tenant predicate. It is reached by `db.get` from a
 * membership row the asking user already holds.
 *
 * **`revision` is not Convex's OCC.** Convex serializes concurrent mutations, so
 * two writes in flight are already safe. This guards a different thing: a client
 * read the project ten minutes ago, left a form open, and submits against state
 * that has since moved. Serializability cannot see that, because the read
 * committed long ago.
 *
 * **`lattice` records what built this project's index.** Every vector in a
 * project must come from one model — a distance between vectors from two models
 * is not less accurate, it is meaningless — so a repointed binding is refused
 * rather than adopted. Both the binding and the model it resolved to are stored,
 * so a provider quietly changing what a binding means is detectable. `pcaDims`
 * is here because a stored basis is fitted at one width.
 */
export const projects = defineTable({
  name: v.string(),
  description: v.optional(v.string()),
  /** Hides without destroying. Deletion is a real delete. */
  archivedAt: v.optional(v.number()),
  revision: v.number(),
  /** JSON, for the reason `users.settings` is. */
  settings: v.string(),
  lattice: v.optional(
    v.object({
      embeddingModel: v.string(),
      embeddingBinding: v.string(),
      dimensions: v.number(),
      pcaDims: v.number()
    })
  ),
  updatedAt: v.number()
});
```

---

## `memberships`

`app/src/lib/capabilities/access/schema/memberships.ts`

```ts
import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * One person's access to one project.
 *
 * **`by_user_and_token` leads with `userId`, and that is the whole design.** A
 * token-first index would resolve any token to its project regardless of who
 * presented it. With the user first, a copied URL lands in someone else's key
 * range and finds nothing — so the lookup is the authorization, and there is no
 * separate check for a handler to forget.
 *
 * Each collaborator holds their own token for a project, which is what makes a
 * token safe to put in a URL and useless to pass on.
 */
export const memberships = defineTable({
  userId: v.id("users"),
  projectId: v.id("projects"),
  token: v.string(),
  role: v.union(v.literal("owner"), v.literal("editor"), v.literal("viewer"))
})
  .index("by_user_and_token", ["userId", "token"])
  .index("by_user_and_project", ["userId", "projectId"]);
```

**One membership per `(user, project)`** is upheld by reading before inserting
inside one transaction — Convex has no unique index.

---

## Settings are fields, not a table

A Convex query re-runs whenever any document in its read set changes. The `users`
row is read on every request; the `projects` row is read whenever one is
displayed. A separate settings row would mean a settings write touches a settings
row and nothing else — but it also means a second read to render anything that
needs one, on tables that are already being read.

The blob is small and nothing queries inside it, so it lives on the row it
configures.

---

## Files

```text
app/src/lib/capabilities/access/schema/
├── schema.md
├── users.ts
├── projects.ts
├── memberships.ts
└── tables.ts                      accessTables
```

## Related

[all tables](README.md) · [revisions](revisions.md)
