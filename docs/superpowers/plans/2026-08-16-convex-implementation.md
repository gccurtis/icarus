# Convex Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build every table in the data models as Convex capabilities — 28
tables across 7 passes — ending with a project you can write documents in,
research inside, search over, and hand work to agents from.

**Architecture:** One capability directory per subject under
`src/lib/capabilities/<name>/`, each declaring its own table fragment composed
by `src/convex/schema.ts`. Public surface is one file per capability under
`src/convex/capabilities/`, built from `projectQuery` / `projectMutation` so
every call resolves a project token to a membership before the handler runs.
General resources store metadata on their row and their body as a snapshot plus
an append-only change-set log.

**Tech Stack:** Convex, TypeScript, SvelteKit, Vitest.

**Spec:** [docs/data-models/](../../data-models/) for what each object is,
[docs/storage/](../../storage/) for tables and indexes,
[docs/processes/](../../processes/) for the algorithms. Sequence:
[docs/storage/build-order.md](../../storage/build-order.md).

## Work in an isolated worktree

**This plan runs on its own branch in its own worktree**, start to finish.
Create it with the `superpowers:using-git-worktrees` skill before Task 1 —
`.claude/worktrees/` is the repository's declared and gitignored location for
them.

Nothing here touches the tree the design docs live in. Commit after every task;
the branch is reviewed as a whole when the passes are done.

### Bootstrap it before Task 1, because a fresh worktree cannot build

Three things this repository deliberately does not commit are things the toolchain
needs, so a new worktree starts unable to run a single check:

| Absent | Why | Restored by |
| --- | --- | --- |
| `node_modules/` | gitignored, and so is `pnpm-lock.yaml` | `pnpm install` |
| `.svelte-kit/` | generated types and the alias map | `pnpm exec svelte-kit sync` |
| `.env.local` | names the deployment; written on first provision | `pnpm exec convex dev --once` |
| `app/src/convex/_generated/` | Convex writes it from the schema | `pnpm exec convex codegen` |

```bash
export PATH="/nix/store/2gf37maq4k2nhidw22dxndccma074cak-nodejs-26.7.0/bin:/nix/store/ry314j51iqvrn8fs26vna9xy823c1swy-pnpm-11.20.0/bin:$PATH"
cd <worktree>/app
pnpm install
pnpm exec svelte-kit sync      # before the push, not after — see below
pnpm exec convex dev --once    # provisions the backend; writes .env.local and _generated/
pnpm test && pnpm typecheck && pnpm lint
```

**`svelte-kit sync` must precede the push.** The Convex bundler resolves aliases
from the *nearest* `tsconfig.json`, and for `src/lib/capabilities/**` that is
`app/tsconfig.json`, which extends the generated `.svelte-kit/tsconfig.json`.
Without it the push fails on `Could not resolve "$access/types/access"` while
`src/convex/tsconfig.json` sits there looking correct — it only covers
`src/convex/**`.

`convex codegen` works fine on its own once `.env.local` exists; a checkout that
has never provisioned needs `convex dev --once` once. It takes no account and
picks free ports, so a worktree runs its own backend beside the main tree's.

A green baseline before Task 1 is what makes the first red test mean something.

## Global Constraints

- **Toolchain is not on `PATH`.** Every command assumes:
  ```bash
  export PATH="/nix/store/2gf37maq4k2nhidw22dxndccma074cak-nodejs-26.7.0/bin:/nix/store/ry314j51iqvrn8fs26vna9xy823c1swy-pnpm-11.20.0/bin:$PATH"
  ```
  Verify with `ls -d /nix/store/*nodejs-2*/bin` if that hash has been collected.
- **All commands run from `app/`.** Tests `pnpm test`, typecheck `pnpm typecheck`,
  lint `pnpm lint`. All three must pass before every commit.
- **Convex module paths are camelCase.** Convex rejects a hyphen in a module
  path: a capability named `name-manager` registers as
  `capabilities/nameManager.ts`.
- **`projectId` leads every index** on a project-scoped table. A read that
  forgets the predicate reads every project's rows.
- **Nothing under `src/lib/capabilities/` imports `query` or `mutation`.** Only
  `src/convex/functions.ts` does, and lint enforces it.
- **Attribution is an `Actor`**, never a bare user id.
- **The resource key is `(resourceType, resourceId)`**, never the id alone.
- Timestamps are `v.number()`, milliseconds.
- **There are no unique indexes in Convex.** Uniqueness is an invariant a
  mutation maintains, made safe by serializable transactions. Every such write
  goes behind exactly one function.

---

## Reconciliation with the shipped `access` capability

`access` was built before the data models were written, and the two disagree.
This is a **merger**: each disagreement is settled on merits, and it goes both
ways. Resolve all six before Task 1.

### The code changes

**1. `users.subject` → `authSubject`.** "Subject" is ambiguous on its own; the
model's name says what it is — the identity provider's subject claim. Rename in
`schema.ts`, `seed.ts`, `resolve-scope.ts`, and the `by_subject` index (which
becomes `by_auth_subject`).

**2. `users` gains `email`, `imageUrl`, `lastSeenAt`, `updatedAt`.** The model is
right that a member list, a comment byline, and a notification all need these
without a round trip to the provider. `email` is **optional for now** — auth does
not exist, and requiring it would block `seed`. It becomes required when auth
lands.

**3. `projects` gains `description`, `archivedAt`, `revision`, `updatedAt`.**
Archival hides without destroying; `revision` is the stale-form check.

### The model changes

**4. `Project.members[]` is deleted; `memberships` stays a table.** Not
deference — the embedded version *cannot work*. Each membership carries a
per-user token resolved by `by_user_and_token`, leading with `userId`, so a
copied URL lands in someone else's key range and finds nothing. That lookup **is**
the authorization, and it needs an index on `(userId, token)`. You cannot index
into an embedded array, so embedding would force a scan of every project to
resolve one token.

The model's argument for embedding — "members are read on every request, a table
means a second read" — was answered by a design that makes the membership read
*the only* read. Update
[core/project.md](../../data-models/core/project.md).

**5. `Project.ownerId` is deleted.** It duplicates the membership whose `role` is
`owner`, and a stored copy can disagree with the row it copies. The invariant
"at least one owner membership exists" is enforced on membership removal instead.

**6. `User.name` → `displayName`.** The code is right, and there is a rule
underneath it: **`name` where the name is the identity** (project, persona,
automation, resource set), **`displayName` where it is a human label over a
machine identity** (user — identity is `authSubject`; connector — identity is
provider plus credential). Update
[core/user.md](../../data-models/core/user.md).

> **Do this first**, on `main`, before branching. A plan that contradicts its
> spec produces a codebase nobody can check against anything.

---

## The capability recipe

Every capability in this plan has the same shape. It is written out once here;
each task below gives its own fields, indexes, operations, and test assertions,
and follows this structure without restating it.

```text
src/lib/capabilities/<name>/
├── overview.md                  what this owns and why
├── schema.ts                    the table fragment
├── types/
│   ├── types.md
│   └── <name>.ts                the TypeScript types
├── api/
│   ├── api.md                   the function table
│   ├── <verb>/
│   │   ├── <verb>.md            carries the procedure tree
│   │   └── <verb>.ts            the handler
│   └── shared/                  procedures more than one verb needs
│       ├── shared.md
│       └── <procedure>.ts
└── test/
    ├── fixture.ts               the ctx and scope every test starts from
    └── unit/                    mirrors the source directories it covers
        ├── schema.test.ts
        └── api/<verb>/<verb>.test.ts

src/convex/capabilities/<name>.ts    the public surface
```

**`test/unit/` mirrors, one file per source file** — never one file per
capability. Shared setup is hoisted into `test/fixture.ts` rather than repeated.
Nothing below `test/` is linted, so this one is on the author.

**Every directory carries a document named after itself** — `types/types.md`,
`api/api.md`, `api/read/read.md`. Lint fails a missing one, and fails a document
whose name does not match its directory. `test/` and `docs/` are exempt, and so
are nested procedure directories: the function's document carries the whole tree.

**`api/` and the deployment door must name the same set of functions, in both
directions.** Lint reads the door's lowercase exports and the `api/`
subdirectories and reports either side's extras: an `api/apply/` nobody registers
is "no function named 'apply' is registered", and a registration with no
directory is a procedure hidden inline. `shared/` is the one exemption.

**So an internal procedure goes in `api/shared/`, never in an `api/<verb>/` of
its own.** This is not a style point — it decides where `applyOps`, `shift`, and
the conflict ladder live in Task 8 and Task 9, and getting it wrong fails lint at
the end of the task rather than the start.

A procedure with sub-procedures becomes a directory holding a `.ts` of the same
name, recursively: `api/shared/apply/apply.ts` with `api/shared/apply/shift.ts`
beside it.

**Six steps, every time:**

1. Write the failing test for the schema fragment — assert the field set,
   assert `projectId` leads the first index.
2. Write `schema.ts`, add the fragment to **both** the spread and the `declared`
   list in `src/convex/schema.ts`, and add the path alias to **both**
   `src/convex/tsconfig.json` and `svelte.config.js` — the Convex bundler does
   not read SvelteKit's map.
3. Write the failing tests for the operations against a fake `ctx`.
4. Write `types/` and `api/`.
5. Write `src/convex/capabilities/<name>.ts` — validators on the args, actor
   built from `ctx.scope` and never accepted as an argument.
6. `pnpm test && pnpm typecheck && pnpm lint`, then commit.

**The fake `ctx` used by every operation test:**

```ts
// src/lib/capabilities/shared/test/fake-ctx.ts
export function fakeCtx() {
  const rows = new Map<string, Record<string, unknown>>();
  const log: Record<string, unknown>[] = [];
  let n = 0;
  const ctx = {
    rows,
    log,
    db: {
      insert: async (table: string, doc: Record<string, unknown>) => {
        const id = `${table}:${++n}`;
        if (table === "activity") log.push(doc);
        rows.set(id, { ...doc, _table: table });
        return id;
      },
      get: async (id: string) =>
        rows.has(id) ? { _id: id, ...rows.get(id) } : null,
      patch: async (id: string, fields: Record<string, unknown>) => {
        rows.set(id, { ...rows.get(id), ...fields });
      },
      replace: async (id: string, doc: Record<string, unknown>) => {
        rows.set(id, { ...doc, _table: rows.get(id)?._table });
      },
      delete: async (id: string) => void rows.delete(id),
      query: (table: string) => {
        const all = [...rows.entries()]
          .filter(([, d]) => d._table === table)
          .map(([id, d]) => ({ _id: id, ...d }));
        const api = {
          withIndex: (_name: string, fn?: (q: unknown) => unknown) => {
            const preds: Array<(d: Record<string, unknown>) => boolean> = [];
            const q = {
              eq: (f: string, val: unknown) => {
                preds.push((d) => d[f] === val);
                return q;
              },
              gt: (f: string, val: number) => {
                preds.push((d) => (d[f] as number) > val);
                return q;
              }
            };
            fn?.(q);
            const rowsOut = all.filter((d) => preds.every((p) => p(d)));
            return { ...api, collect: async () => rowsOut, unique: async () => rowsOut[0] ?? null };
          },
          collect: async () => all,
          unique: async () => all[0] ?? null
        };
        return api;
      }
    }
  };
  return ctx;
}
```

**Two isolation tests every project-scoped capability gets**, worded for its own
verbs:

```ts
it("scopes what it creates to the caller's project", async () => { /* … */ });

it("reports not found for a row in another project", async () => {
  // NOT "forbidden" — distinguishing them confirms the row exists to
  // someone with no right to know that.
});
```

---

## Pass 1 — Foundation

Tables: `projects`, `users` (both extended), `activity`, `documents`.

### Task 1: The shared `Actor` validator

**Files:** create `src/lib/capabilities/shared/overview.md`,
`types/types.md`, `types/actor.ts`, `test/unit/types/actor.test.ts`; add `$shared` to
`svelte.config.js` and `src/convex/tsconfig.json`.

**`shared` is a real capability directory, and it obeys the template.** Lint
treats any directory under `capabilities/` holding a file as a capability, and
allows only `overview.md`, `errors.ts`, and `schema.ts` at its root — so
`shared/actor.ts` fails on sight. It goes in `types/`, where it belongs anyway: a
validator is the model, not a procedure.

It has no `api/`, so lint demands no deployment door, and no `schema.ts`, because
it stores nothing. Its `overview.md` says exactly that — the one capability with
no public surface, holding what every other capability's tables embed.

**Produces:** `actorValidator`, type `Actor`. Every later table uses it for
`createdBy`, `updatedBy`, and `actor`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { actorValidator } from "$shared/types/actor";

describe("actorValidator", () => {
  it("admits every actor kind the model defines", () => {
    const kinds = actorValidator.members.map((m) => m.fields.kind.value).sort();
    expect(kinds).toEqual(["agent", "automation", "connector", "system", "user"]);
  });

  it("gives the system actor no id field", () => {
    const system = actorValidator.members.find((m) => m.fields.kind.value === "system");
    expect(Object.keys(system!.fields)).toEqual(["kind"]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail** — `pnpm exec vitest run src/lib/capabilities/shared/` → cannot resolve module.

- [ ] **Step 3: Implement**

```ts
import { v, type Infer } from "convex/values";

/**
 * Who did something. One type for every table that attributes anything.
 *
 * An agent variant points at its *task*, not its persona: the task already
 * carries `personaId`, so storing both would let them disagree, and the task is
 * the more specific truth about what acted.
 *
 * `system` carries no id because there is nothing to look up.
 */
export const actorValidator = v.union(
  v.object({ kind: v.literal("user"), userId: v.id("users") }),
  v.object({ kind: v.literal("agent"), taskId: v.string() }),
  v.object({ kind: v.literal("automation"), automationId: v.string() }),
  v.object({ kind: v.literal("connector"), connectorId: v.string() }),
  v.object({ kind: v.literal("system") })
);

export type Actor = Infer<typeof actorValidator>;
```

`taskId`, `automationId`, and `connectorId` are `v.string()` because those tables
do not exist until passes 7 and 8. Tightening each to `v.id(...)` is a step in
the task that creates it.

- [ ] **Step 4: Run it and watch it pass** — 2 tests.
- [ ] **Step 5: Commit** — `feat(shared): add the Actor validator`

### Task 2: Apply the reconciliation to `access`

**Files:** modify `src/lib/capabilities/access/schema.ts`,
`api/seed/seed.ts`, `api/shared/resolve-scope.ts`; create
`src/lib/capabilities/access/test/unit/schema.test.ts`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { accessTables } from "$lib/capabilities/access/schema";

describe("access schema after reconciliation", () => {
  it("names the identity claim authSubject", () => {
    expect(accessTables.users.validator.fields).toHaveProperty("authSubject");
    expect(accessTables.users.validator.fields).not.toHaveProperty("subject");
  });

  it("keeps displayName, because identity is authSubject", () => {
    expect(accessTables.users.validator.fields).toHaveProperty("displayName");
  });

  it("carries contact fields so a member list needs no provider call", () => {
    const f = Object.keys(accessTables.users.validator.fields).sort();
    expect(f).toEqual(
      ["authSubject", "displayName", "email", "imageUrl", "lastSeenAt", "updatedAt"].sort()
    );
  });

  it("keeps membership in its own table and off the project", () => {
    expect(accessTables.projects.validator.fields).not.toHaveProperty("members");
    expect(accessTables.projects.validator.fields).not.toHaveProperty("ownerId");
    expect(accessTables.memberships).toBeDefined();
  });

  it("gives projects archival and a revision", () => {
    const f = Object.keys(accessTables.projects.validator.fields).sort();
    expect(f).toEqual(["archivedAt", "description", "name", "revision", "updatedAt"].sort());
  });
});
```

- [ ] **Step 2: Run it and watch it fail** — five failures.

- [ ] **Step 3: Implement**

```ts
  users: defineTable({
    /** The identity provider's subject claim. Look users up by this, never by email. */
    authSubject: v.string(),
    /** A label over the identity, not the identity. */
    displayName: v.string(),
    /** Optional until auth exists; `seed` has no email to supply. */
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    lastSeenAt: v.optional(v.number()),
    updatedAt: v.number()
  }).index("by_auth_subject", ["authSubject"]),

  projects: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    /** Hides without destroying. Deletion is a real delete. */
    archivedAt: v.optional(v.number()),
    /**
     * Bumped on every accepted write. A client sends the revision it read and a
     * stale write is rejected — the person-left-a-form-open problem, which
     * Convex's transactions do not cover because the read happened minutes ago.
     */
    revision: v.number(),
    updatedAt: v.number()
  }),
```

Leave the `// No index.` comment under `projects`; it is still true. Update
`seed.ts` to write `authSubject`, `updatedAt: Date.now()`, and
`revision: 1` on the project, and `resolve-scope.ts` to use `by_auth_subject`.

- [ ] **Step 4: Run it and watch it pass** — 5 tests, plus the existing suite green.
- [ ] **Step 5: Commit** — `refactor(access): reconcile with the data models`

### Task 3: `activity`

**Files:** create `src/lib/capabilities/activity/{schema.ts,types/activity.ts,api/record/record.ts,api/list/list.ts,test/fixture.ts,test/unit/{schema.test.ts,api/list/list.test.ts,api/shared/record.test.ts}}`,
`src/convex/capabilities/activity.ts`; modify `src/convex/schema.ts`.

**Produces:** `record(ctx, scope, entry): Promise<void>`,
`list(ctx, scope): Promise<Activity[]>`. Every later capability calls `record`.

- [ ] **Step 1: Failing tests** — index leads with `projectId`; `actorLabel` is
  stored beside `actor`; `target` has exactly `{ type, id, label }`; `record`
  sets `at` itself and ignores any `at` a caller passes.

- [ ] **Step 2: Run and watch fail.**

- [ ] **Step 3: Implement**

```ts
export const activityTables = {
  activity: defineTable({
    projectId: v.id("projects"),
    actor: actorValidator,
    actorLabel: v.object({
      kind: v.string(),
      name: v.string(),
      onBehalfOf: v.optional(v.string()),
      detail: v.optional(v.string())
    }),
    verb: v.string(),
    target: v.object({ type: v.string(), id: v.string(), label: v.string() }),
    context: v.optional(v.object({ type: v.string(), id: v.string(), label: v.string() })),
    detail: v.optional(v.string()),
    at: v.number()
  }).index("by_project", ["projectId"])
};
```

```ts
export async function record(ctx: MutationCtx, scope: Scope, entry: ActivityEntry) {
  // `at` is set here, not accepted: a log whose timestamps come from whoever is
  // writing is a log that can be backdated.
  await ctx.db.insert("activity", { projectId: scope.projectId, ...entry, at: Date.now() });
}
```

Labels are denormalized because an entry must read correctly after its subject is
gone, and rendering a hundred entries should be one query.

The public surface exposes **`list` only**. Entries are written by the capability
that did the thing, in the same transaction — a log a client can write to is not
evidence of anything.

- [ ] **Step 4: Run and watch pass.**
- [ ] **Step 5: Commit** — `feat(activity): add the append-only project log`

### Task 4: `documents`

**Files:** create `src/lib/capabilities/documents/{schema.ts,errors.ts,types/document.ts,api/{create,rename,remove,list}/…,api/shared/require-document.ts,test/fixture.ts,test/unit/{schema.test.ts,api/{create,rename,remove,list}/*.test.ts}}`,
`src/convex/capabilities/documents.ts`.

- [ ] **Step 1: Failing tests** — the row holds **no** `blocks`, `rows`, or
  `revision`; field set is exactly `{projectId, title, templateId, createdBy,
  updatedBy, updatedAt}`; create scopes to `scope.projectId`; rename and remove
  across projects throw `/not found/i`; remove copies the title into the activity
  entry before deleting.

- [ ] **Step 2: Run and watch fail.**

- [ ] **Step 3: Implement**

```ts
/**
 * A document's metadata, and deliberately nothing else.
 *
 * **The body is not here, and neither is a revision.** A Convex patch rewrites
 * the whole document, so a body on this row would be rewritten in full on every
 * edit, and a revision counter would force that rewrite for a one-character
 * change. Both live in pass 2, where an edit appends one small row.
 */
export const documentsTables = {
  documents: defineTable({
    projectId: v.id("projects"),
    title: v.string(),
    templateId: v.optional(v.string()),
    createdBy: actorValidator,
    updatedBy: actorValidator,
    updatedAt: v.number()
  }).index("by_project", ["projectId"])
};
```

```ts
// api/shared/require-document.ts
export async function requireDocument(ctx: QueryCtx, scope: Scope, id: Id<"documents">) {
  const doc = await ctx.db.get(id);
  // Not found, never forbidden: distinguishing them confirms the document
  // exists to someone with no right to know that.
  if (!doc || doc.projectId !== scope.projectId) throw new Error(`Document not found: ${id}`);
  return doc;
}
```

`remove` reads the title **before** deleting and passes it as the activity
target label.

- [ ] **Step 4: Run and watch pass.**
- [ ] **Step 5: Commit** — `feat(documents): add the document metadata table`

### Task 5: Pass 1 live check

- [ ] **Step 1:** `npx convex dev --once` — schema pushes with no duplicate-table
  error. One means the `declared` list was not updated alongside the spread.
- [ ] **Step 2:** `pnpm seed`, then create / list / activity-list via
  `npx convex run`. Expect one document and one `created` entry naming it.
- [ ] **Step 3:** `npx convex run capabilities/documents:list '{"projectToken":"wrong"}'`
  → **an error**, not an empty list. An empty list would mean the gate admitted
  an unknown token.
- [ ] **Step 4: Commit** — `chore: verify pass 1 against a live deployment`

---

## Pass 2 — Editing

Tables: `resourceSnapshots`, `changeSets`, `slideDecks`, `spreadsheets`,
`nameVariables`. Plus formula evaluation, which has no table.

**This is the pass that proves the design.** Read
[change-set.md](../../data-models/revisions/change-set.md),
[resource-snapshot.md](../../data-models/revisions/resource-snapshot.md),
[change-conflicts.md](../../processes/change-conflicts.md), and
[storage/general-resources.md](../../storage/general-resources.md) before
starting.

### Task 6: Content block types

**Files:** create `src/lib/capabilities/content/types/{block.ts,format.ts,value.ts}`,
`src/lib/capabilities/content/test/unit/types/block.test.ts`.

Only the variants pass 2 needs: `text` and `formula`. `image`, `table`, `embed`
arrive in pass 3 and `prompt` in pass 7 — the union grows a member and nothing
existing changes.

- [ ] **Step 1: Failing tests** — every block variant carries `id`; a `TextBlock`
  carries `atoms`, `display`, `marks`; every atom and mark carries `id`; a
  formula atom carries `resolved` and `state`.
- [ ] **Step 2: Run and watch fail.**
- [ ] **Step 3: Implement** the validators from
  [content-block.md](../../data-models/content/content-block.md), with
  `blockValidator` as a `v.union` discriminated on `type`.
- [ ] **Step 4: Run and watch pass.**
- [ ] **Step 5: Commit** — `feat(content): add text and formula block validators`

### Task 7: `resourceSnapshots` and `changeSets`

**Files:** create `src/lib/capabilities/revisions/{schema.ts,types/change.ts}`,
`test/unit/schema.test.ts`.

- [ ] **Step 1: Failing tests** — `changeSets` has indexes
  `by_resource_state` on `["resourceType","resourceId","tier","revision"]` and
  `by_resource_revision` on `["resourceType","resourceId","revision"]`;
  `resourceSnapshots` has `by_resource_role`; a change set carries `touched`;
  `role` admits exactly `base | leader | checkpoint`.

- [ ] **Step 2: Run and watch fail.**

- [ ] **Step 3: Implement**

```ts
const opValidator = v.union(
  v.object({ op: v.literal("set"), target: targetValidator, path: v.string(),
             value: v.any(), was: v.any() }),
  v.object({ op: v.literal("insert"), target: targetValidator, path: v.string(),
             after: v.union(v.string(), v.null()), values: v.array(v.any()) }),
  v.object({ op: v.literal("remove"), target: targetValidator, path: v.string(),
             ids: v.array(v.string()), after: v.union(v.string(), v.null()),
             values: v.array(v.any()) }),
  v.object({ op: v.literal("move"), target: targetValidator, path: v.string(),
             id: v.string(), after: v.union(v.string(), v.null()),
             wasAfter: v.union(v.string(), v.null()) }),
  v.object({ op: v.literal("text"), target: v.literal("atom"), path: v.string(),
             at: v.number(), insert: v.string(), remove: v.string() })
);

export const revisionsTables = {
  changeSets: defineTable({
    projectId: v.id("projects"),
    resourceType: resourceTypeValidator,
    resourceId: v.string(),
    revision: v.number(),
    baseRevision: v.number(),
    tier: v.union(v.literal("recent"), v.literal("historical")),
    ops: v.array(opValidator),
    /** The deepest id each op addresses — the conflict filter. */
    touched: v.array(v.string()),
    actor: actorValidator,
    at: v.number()
  })
    .index("by_resource_state", ["resourceType", "resourceId", "tier", "revision"])
    .index("by_resource_revision", ["resourceType", "resourceId", "revision"]),

  resourceSnapshots: defineTable({
    projectId: v.id("projects"),
    resourceType: resourceTypeValidator,
    resourceId: v.string(),
    revision: v.number(),
    role: v.union(v.literal("base"), v.literal("leader"), v.literal("checkpoint")),
    body: v.any(),
    at: v.number()
  }).index("by_resource_role", ["resourceType", "resourceId", "role"])
};
```

`body` is `v.any()` here and tightened to a discriminated union on
`resourceType` in Task 11, once all three body types exist.

- [ ] **Step 4: Run and watch pass.**
- [ ] **Step 5: Commit** — `feat(revisions): add snapshots and change sets`

### Task 8: Applying ops

**Files:** create
`src/lib/capabilities/revisions/api/shared/apply/{apply.ts,shift.ts,invert.ts}`,
`test/unit/api/shared/apply/{apply,shift,invert}.test.ts`.

**`shared/`, not `api/apply/`.** Nothing registers `apply` — it is called by
`read`, `submit`, and `consolidate`, which is the definition of a promoted
procedure. An `api/apply/` directory with no matching export in the deployment
door fails lint, and `shared/` is the exemption. See
[the recipe](#the-capability-recipe).

**Produces:** `applyOps(body, ops): Body`, `invert(op): Op`,
`shift(p, a): number | CONFLICT`.

- [ ] **Step 1: Failing tests — `shift` first, it is the risky one**

```ts
// shift(p, {at, remove, insert})
expect(shift(20, { at: 4, remove: "", insert: "strong " })).toBe(27); // after
expect(shift(2,  { at: 4, remove: "", insert: "strong " })).toBe(2);  // before
expect(shift(6,  { at: 4, remove: "quarterly", insert: "Q3" })).toBe(CONFLICT); // inside
expect(shift(4,  { at: 4, remove: "", insert: "x" })).toBe(5); // equal: later goes after
// a mark spanning the edit grows with it
expect(shift(0,  { at: 4, remove: "", insert: "xx" })).toBe(0);
expect(shift(30, { at: 4, remove: "", insert: "xx" })).toBe(32);
```

Then: every op inverts to its opposite and `applyOps(applyOps(b, [op]),
[invert(op)])` deep-equals `b`, for all five ops.

- [ ] **Step 2: Run and watch fail.**

- [ ] **Step 3: Implement**

```ts
export const CONFLICT = Symbol("conflict");

/**
 * Shift one offset past an already-applied text op.
 *
 * **This is the only code in the system that fails open.** Everything else
 * rejects when in doubt; a bug here puts characters in the wrong order with no
 * error raised. Offsets are UTF-16 throughout, matching JS string slicing, so a
 * surrogate pair is never split by an off-by-one.
 */
export function shift(p: number, a: TextOp): number | typeof CONFLICT {
  const aStart = a.at;
  const aEnd = a.at + a.remove.length;
  const delta = a.insert.length - a.remove.length;
  if (p >= aEnd) return p + delta;
  if (p <= aStart) return p;
  return CONFLICT;
}
```

`applyOps` walks ops in order; a `text` op additionally shifts every mark in its
block by the same function — marks are never carried in a change set, so the
shift is a consequence of applying, computed here.

- [ ] **Step 4: Run and watch pass.**
- [ ] **Step 5: Commit** — `feat(revisions): apply, invert, and shift`

### Task 9: The conflict ladder

**Files:** create `src/lib/capabilities/revisions/api/submit/{submit.md,submit.ts,check.ts}`,
`test/unit/api/submit/{submit,check}.test.ts`.

`check.ts` sits beside `submit.ts` rather than in `shared/`: the ladder has one
caller. `submit.md` carries the procedure tree, and every `.ts` path it names
must resolve — lint checks that too.

Implements [change-conflicts.md](../../processes/change-conflicts.md) exactly.

- [ ] **Step 1: Failing tests — the seven worked cases from the spec**

```ts
it("applies when nothing intervened", …);                    // step 0
it("applies when touched sets are disjoint", …);             // different paragraphs
it("applies when different atoms in one paragraph", …);
it("shifts when the same atom is edited apart", …);          // step 4 shift
it("rejects when the same atom is edited overlapping", …);
it("shifts a mark past a concurrent text edit", …);
it("applies two marks on different phrases", …);             // both land
it("rejects an edit under a removed row", …);                // step 3
it("rejects when a formula re-resolved in the window", …);   // precondition
it("applies two inserts after the same row", …);             // order by revision
it("rejects when baseRevision predates the window", …);      // step 1
```

- [ ] **Step 2: Run and watch fail.**

- [ ] **Step 3: Implement** the ladder in order — identity intersection, removal
  containment, then the precondition and shift. **The precondition rejects unless
  every intervening op affecting the block is a `text` op on a literal atom**; a
  re-resolved formula, an inserted or removed atom, or a wholesale block `set`
  all disqualify it, because the delta is not stated by the ops.

- [ ] **Step 4: Run and watch pass** — 11 tests.
- [ ] **Step 5: Commit** — `feat(revisions): the conflict check ladder`

### Task 10: Read, submit, consolidate

**Files:** create `src/lib/capabilities/revisions/api/{read,consolidate}/…`,
`src/convex/capabilities/revisions.ts`; modify `app/configuration/revisions.yaml`
if the defaults need moving.

The door registers exactly three: `read`, `submit`, `consolidate` — one per
`api/` directory that is not `shared/`. `consolidate` is registered rather than
hidden because it is a real maintenance mutation someone triggers, and because a
directory the door never names fails lint.

- [ ] **Step 1: Failing tests** — reading returns leader body plus recent sets
  folded, in revision order; a submit at a taken revision loses the race and the
  caller re-runs; consolidation folds recent into leader and flips those sets to
  `historical` without touching the resource row.
- [ ] **Step 2–4:** implement and verify.
- [ ] **Step 5: Commit** — `feat(revisions): read, submit, and consolidate`

### Task 11: `slideDecks` and `spreadsheets`

**Files:** create both capabilities following the recipe; tighten
`resourceSnapshots.body` to a union on `resourceType`.

They come along nearly free — the snapshot and change-set machinery is generic
over `resourceType`. **Building them here is what proves that.** If either needs
a special case, better to find out now than after three passes depend on it.

- [ ] Steps 1–5 per the recipe. Test that a deck body and a sheet body both round
  trip through `applyOps` with no resource-specific code path.
- [ ] **Commit** — `feat(slides,spreadsheets): add the remaining general resources`

### Task 12: `nameVariables` and formula evaluation

**Files:** create `src/lib/capabilities/nameManager/…` (camelCase for Convex),
`src/lib/capabilities/formula/…` (no table).

- [ ] **Step 1: Failing tests** — `(projectId, nameKey)` uniqueness is enforced
  by the mutation; **a name conflict is reported before the type or value is
  validated**, so redefining a name says "name conflict" rather than whichever
  schema fault the payload carried; `definitionOrder` is monotonic; the manager
  **evaluates nothing** — a declared `number` receiving a function call is
  rejected as not-a-number.
- [ ] **Step 2–4:** implement. Formula resolves bare names through the name
  manager; the dependency runs one way only.
- [ ] **Step 5: Commit** — `feat(nameManager,formula): named values and evaluation`

---

## Pass 3 — Files and collaboration

Tables: `externalFiles`, `templates`, `commentThreads`, `comments`.

### Task 13: `externalFiles`

- [ ] Failing tests: extension → `ext-*` kind mapping for every row of the table
  in [external-file.md](../../data-models/special-resources/external-file.md);
  an unknown extension is `ext-unknown`, never an error; `origin` discriminates
  upload / connector / generated / capture; `supersedes` chains without
  rewriting the superseded row.
- [ ] Implement, verify, commit — `feat(externalFiles): uploads and extraction`

### Task 14: Content blocks — `image`, `table`, `embed`

- [ ] Failing tests: an image block round trips through `applyOps`; a table
  cell holds `ContentBlock[]`; the union grew without changing any existing
  variant's validator.
- [ ] Implement, verify, commit — `feat(content): add image, table, and embed blocks`

### Task 15: `templates`

- [ ] Failing tests: instantiation is a **full copy** — editing the template
  afterwards leaves the created resource untouched; `body` discriminates on
  `target`; a slot with `kind: "derived"` carries a prompt.
- [ ] Tighten every deferred `templateId` now that `templates` exists: the
  `documents`, `slideDecks`, and `spreadsheets` schemas move from
  `v.optional(v.string())` to `v.optional(v.id("templates"))`; the matching
  `types/*.ts` fields move from `string` to `Id<"templates">`; and each
  capability's `create` door argument in `src/convex/capabilities/*.ts` moves
  with them. Run the full suite.
- [ ] Implement, verify, commit — `feat(templates): resource skeletons with slots`

### Task 16: `commentThreads` and `comments`

- [ ] Failing tests: `within` variants are legal only for their target type per
  the table in [comment.md](../../data-models/collaboration/comment.md); an
  anchor to `#b7x2` still resolves after a block is inserted above it; `mentions`
  admits user, persona, and task; `resolvedBy` is a user id, not an Actor.
- [ ] Implement, verify, commit — `feat(comments): anchored discussion`

---

## Pass 4 — Research

Tables: `questions`, `hypotheses`, `findings`, `researchLinks`.

### Task 17: `questions` and `hypotheses`

- [ ] Failing tests: question status is exactly `open | investigating |
  answered` — **no `parked`**; hypothesis assessment includes `testing`;
  a hypothesis carries **no** `questionId`; both carry `revision`.
- [ ] Implement, verify, commit — `feat(research): questions and hypotheses`

### Task 18: `findings`

- [ ] Failing tests: a finding holds no `questionId`, `hypothesisId`, or
  `bearing`; `sources` carry their own `excerpt` and `capturedAt`; a `resource`
  source names both `resourceType` and `resourceId`.
- [ ] Implement, verify, commit — `feat(research): findings with copied citations`

### Task 19: `researchLinks`

- [ ] Failing tests: only the three legal `(bearer, subject)` pairs are
  accepted; a question is never a bearer and a finding is never a subject;
  `by_bearer` and `by_subject` both resolve in one indexed read; **one finding
  can support one hypothesis and contradict another**; duplicate links are
  rejected by the mutation.
- [ ] Implement, verify, commit — `feat(research): the many-to-many link table`

---

## Pass 5 — Conversation

Tables: `messages`, `researchThreads`, `personas`, `personaThreads`.

### Task 20: `messages`

- [ ] Failing tests: role is `prompt | response`, **not** user/assistant;
  `author` is required on a prompt and optional on a response; `thread`
  discriminates research / task / persona; `by_thread` returns one thread's
  messages and no other's; there is **no `chats` table**.
- [ ] Implement, verify, commit — `feat(messages): one conversation table`

### Task 21: `researchThreads`

- [ ] Failing tests: the row **is** the thread — no `chatId`; `mode` is
  `discover | question | hypothesis`; `discover` does not require an anchor.
- [ ] Implement, verify, commit — `feat(research): threads`

### Task 22: `personas` and `personaThreads`

- [ ] Failing tests: the definition has exactly the five sections; a definition
  with five empty sections **and** a scope is legal and renders to an empty
  string; consumers tolerate an empty prompt and omit the message rather than
  sending a blank system turn; `branchedFrom` records thread and message.
- [ ] Implement, verify, commit — `feat(personas): definitions and chats`

---

## Pass 6 — Search that works

Tables: `resourceSets`, `latticeVersions`, `latticeNodes`, `latticeLevelIndexes`.
Plus windowing, embedding, clustering, and descent — most of the work is not in
the tables. Read [lattice-clustering.md](../../processes/lattice-clustering.md)
and [lattice-retrieval.md](../../processes/lattice-retrieval.md) first.

### Task 23: `resourceSets`

- [ ] Failing tests: `{op:"project"}` resolves lazily — a resource created after
  the set was saved is included; `difference(project, kind("document"))`
  excludes documents and nothing else; a cycle between two sets fails naming
  them rather than recursing; a `connector` ref expands to its files.
- [ ] Implement, verify, commit — `feat(resourceSets): lazy scope expressions`

### Task 24: Windowing and embedding

- [ ] Failing tests: windows overlap; **a window whose text is unchanged keeps
  its vector** (content-addressed reuse) — editing one paragraph re-embeds one
  paragraph; `latticeVersions` is one row per project and the mutation enforces
  it.
- [ ] Implement, verify, commit — `feat(knowledge): windowing and embedding`

### Task 25: Exact clustering

**Build the exact path only.** Clustering picks between two modes by pool size;
the exact one compares every pair. It is the **known-correct oracle** the
approximate path is tested against — otherwise PCA and clustering are debugged
simultaneously with nothing to compare to.

- [ ] Failing tests: clusters are overlapping maximal cliques at or above the
  threshold; `cohesion` is the **weakest** pairwise similarity, not the mean;
  node ids hash sorted member ids, so re-clustering the same grouping yields the
  same id; a node with no strong neighbour stays `clustered: false`; **the next
  pass clusters unclustered nodes from every level**, not just the newest.
- [ ] Implement, verify, commit — `feat(knowledge): exact clustering`

### Task 26: PCA, IVF, and the level index

- [ ] Failing tests: the approximate path produces **the same clusters as the
  exact path** on a pool just above the crossover; the PCA basis is deterministic
  for a fixed seed; **every stored edge weight is a full-dimensional dot
  product** — the projection selects candidates and never scores them;
  `latticeLevelIndexes` is derived and can be dropped and rebuilt.
- [ ] Implement, verify, commit — `feat(knowledge): PCA and IVF candidate search`

### Task 27: Descent and regions

- [ ] Failing tests: the frontier is exactly the `clustered: false` set; descent
  cost is bounded by `beam × maxExpansions` regardless of corpus size; **nothing
  above threshold returns nothing — there is no fallback scan**; overlapping
  windows merge into regions; `relevance` is the best covering window's score,
  not an average; the top region is admitted even alone over budget; a dense
  region gets the 25% overage; scope filters **after** descent.
- [ ] Implement, verify, commit — `feat(knowledge): descent and region assembly`

---

## Pass 7 — Generated content and agents

Tables: `latticeEdges`, `latticeChanges`, `derivedOutputs`, `agentTasks`.

### Task 28: `latticeEdges` and `latticeChanges`

- [ ] Failing tests: an edge's `layer` is the generation it was computed at and
  may connect nodes of different generations; a `resource` cause carries the
  change-set revision it followed; `reclustered` is a count per level, not ids.
- [ ] Implement, verify, commit — `feat(knowledge): edges and change history`

### Task 29: `derivedOutputs` and the prompt block

- [ ] Failing tests: an output holds **exactly one** block, not a list;
  `inputsAt` records each input's revision at generation time; an input whose
  current revision exceeds the recorded one makes the output `stale`; a failed
  refresh leaves `block` intact; a prompt block carries editable `atoms` and its
  edits feed the next refresh as shaping.
- [ ] Implement, verify, commit — `feat(knowledge): derived outputs and prompt blocks`

### Task 30: `agentTasks`

- [ ] Failing tests: the row **is** a thread — no `chatId`; `origin` is an Actor
  and dispatching does not make the dispatcher the actor of the task's changes;
  `title` is the `detail` half of the actor label; tool calls hold opaque input
  and output; `waiting` is distinct from `running` and `cancelled` from `failed`.
- [ ] Implement, verify, commit — `feat(agents): tasks and tool execution`

### Task 31: Tighten the Actor validator

- [ ] Change `taskId`, `automationId`, `connectorId` from `v.string()` to
  `v.id(...)` now that every referenced table exists. Run the full suite.
- [ ] **Commit** — `refactor(shared): tighten Actor to real table ids`

---

## Pass 8 and beyond

`automations` (needs scheduling infrastructure), `connectors` (needs OAuth,
webhooks, provider sync), `analyses` (needs the relational builtins `JOIN`,
`WHERE`, `GROUP`, `AGGREGATE`, `SORT`). Not planned here — each waits on
something outside the model.

---

## Final verification

- [ ] `pnpm test && pnpm typecheck && pnpm lint` all clean.
- [ ] `npx convex dev --once` pushes the full schema.
- [ ] Every table in [storage/README.md](../../storage/README.md) exists with the
  indexes listed there, except the pass 8 three.
- [ ] Write `overview.md` in each new capability directory, and update
  `src/convex/convex.md` with the new registrations.
- [ ] Open the PR from `convex-implementation`.

## Self-review notes

**Spec coverage.** All 28 planned tables have a task. The three deferred are
named with reasons.

**Where the risk is.** `shift` in Task 8 is the only code that fails open —
every other check rejects when in doubt, and a bug there produces silently wrong
text. It is tested first and separately for that reason.

**Where the design is proven.** Task 11 is the load-bearing one: if decks and
workbooks need a special case in the change-set machinery, the claim that it is
generic over `resourceType` was wrong, and better to learn that in pass 2 than
pass 6.

**Known gap.** `actorLabel.name` is written empty by capabilities and resolved at
the registration layer, which has the user. Fill it for the `user` case in Task 3
— a blank label in an audit log is exactly the kind of thing that ships and
stays.

## Related

[build order](../../storage/build-order.md) · [storage](../../storage/) ·
[data models](../../data-models/) · [processes](../../processes/)
