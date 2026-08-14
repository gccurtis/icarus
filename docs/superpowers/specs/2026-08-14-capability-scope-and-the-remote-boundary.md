# Capability Scope and the Remote Boundary

**Status:** **Implemented.** `data/settings` is built, the chain is proven
against the running server, and §10 records the three things building it found
that designing it did not.
**Scope of this document:** how a capability procedure learns which project and
which user it is acting for, and how a browser call reaches it safely.

Deliberately *not* about translating Name Manager or Rich Content. That is
[its own document](2026-08-14-name-manager-and-rich-content.md), and it waits on
this one.

Everything below is anchored on **one** capability, built as if we keep it. What
is true for it is true for every other; where it is not, this document says so.

---

## 1. The question

A capability procedure runs on one project's database and records which user
acted. Both facts have to arrive from somewhere, and **the browser must not be
able to choose either.**

If a client could name a project, every procedure would have to remember to
check it, and the one that forgot would be the vulnerability.

---

## 2. What a remote function actually sees

Measured, not assumed. A probe route `/probe/[token]` with a remote function
returning what its request event carries, called both ways against the built
server:

| Signal | Called during SSR | Called from the browser |
| --- | --- | --- |
| `url.pathname` | `/probe/tok-abc` | `/` |
| `params` | `{ token: "tok-abc" }` | `{}` |
| `route.id` | `/probe/[token]` | `/` |
| `referer` header | `null` | the page URL |
| `cookie` header | present | present |
| `locals` (from `handle`) | present | present |

Three consequences, and the first is a trap worth naming:

**A route parameter cannot scope a capability call.** A remote function called
during SSR sees the page's params; the same function called from the browser sees
`{}`, because kit routes remote requests to `/_app/remote/<hash>/<name>` and
normalizes the route to `/`. Scoping by `params.project` would work on first
paint and silently empty on every interaction after it.

**`Referer` is the only URL signal on the browser path, and it is not a
credential.** The client sets it; privacy settings strip it.

**A cookie travels on both paths, and `handle` runs on both.** Whatever
`hooks.server.ts` puts on `locals` is already there inside a remote function —
proved separately by a smoke test that read `locals` from a browser-invoked
remote function and opened a project database with what it found. That is what
makes the cookie usable for authority (§3), and it is the only automatic channel
there is.

---

## 3. The model: authority and selection differ, and so does their granularity

The token idea is right, and it splits in two. Conflating the halves is what
makes this confusing — and the halves do not merely answer different questions,
they **live for different lengths of time**.

| | Answers | Granularity | Transport | Client-chosen? |
| --- | --- | --- | --- | --- |
| **Authority** | who is acting | **the browser** — every tab, one user | session cookie | **No** |
| **Selection** | which project this call is about | **one client instance** — one tab, or one desktop window | the request | Yes, and *authorized* |

Authority is browser-wide because that is what people expect: signing in once
signs in every tab, and signing out signs out everywhere. A `userId` is never a
parameter — one in a payload lets a caller act as anyone.

**Selection is per client instance, and that granularity decides the
transport.** A cookie is shared by every tab in a browser, so a cookie carrying
the project would make two tabs on two projects impossible — the second would
silently redirect the first. The project must therefore travel with the call.

Combined with §2, that leaves exactly one place it can ride: **the remote
function's own input**, sourced from the client instance's URL. Route params are
empty on the browser path, `Referer` is client-controlled, and the cookie has the
wrong granularity.

Safety comes from **checking** the selection against the authority, not from
hiding it. The project token is not a secret; it is a reference, and naming one
you do not own is a 404.

### What the token is

**An opaque handle that means nothing on its own.** The server holds a map:

```text
(userId, projectToken) → projectId
```

**The lookup is the authorization.** There is no separate check to forget,
because a token is only ever resolved *within* one user's rows. A handle that is
not in the asking user's map has no project, and the call is a 404.

That also answers the collaboration question. A project has many users — this is
built to be collaborative. **Each user gets their own handle to the same
project**, so two collaborators on one project hold two different tokens that
resolve to the same `projectId`. A URL copied to a colleague is worthless to
them, and revoking one person's access removes their rows without touching
anyone else's.

**Where the map lives.** Not in a project database — you need the map to know
*which* project database to open. So:

| | The map is | Cost |
| --- | --- | --- |
| Today, pre-auth | derived from `configuration` — one user, one project, one handle | nothing |
| When auth lands | a table in a control database, alongside users and memberships | the control database, which auth needs regardless |

Only `resolveScope` changes between those two. Nothing above or below it moves,
which is why the control plane can wait for the thing that actually needs it.

### The development identity

Today's map has one entry, and it belongs in configuration rather than in a
constant, so the one place naming the pre-auth identity is a file someone can
find.

`configuration/project.yaml` becomes `configuration/dev.yaml`:

```yaml
# The signed-in user and open project that exist before authentication does.
# Deleted whole when the auth capability lands — nothing else reads these keys.
development:
  userId: default-user
  projectId: default
  projectToken: dev-project
```

Renamed because `project.yaml` reads as ongoing configuration, and these three
are scaffolding with an expiry date. Nesting them under `development:` makes the
block obviously removable and makes `resolveScope`'s reads —
`configuration.get("development.projectToken")` — say out loud that they are
temporary.

`resolveSession` returns `development.userId` until a session cookie exists.
`resolveScope` accepts `development.projectToken` and rejects every other value,
which means the 404 path is exercised from the first day rather than written and
never taken.

---

## 4. The chain, end to end

### The vocabulary this uses

The walkthrough traces one concrete call. It needs four names first.

| | |
| --- | --- |
| **`settings`** | the anchor capability defined in §6 — per-project key/value pairs |
| **`set(scope, { key, value })`** | one of its three procedures. It writes `value` at `key` for the project named in `scope` |
| **`api/set/`** | that procedure's directory. `set.ts` is the procedure; `set.remote.ts` is its browser wrapper, and the only file that crosses the boundary |
| **`locals`** | SvelteKit's per-request bag, `event.locals`. `hooks.server.ts` fills it before anything else runs, and load functions, endpoints, and remote functions all read the same one |

The scenario: a settings panel writes `theme = "dark"`.

### Step 0 — the client instance already knows its project

The tab is at `/app/<project token>`, and that is very nearly the **only** route
this application has. Resources open as workbench tabs, not as URLs, so there is
no `/app/<token>/document/<id>` beneath it — the editor takes the id from the
active tab.

So the path segment is not there to be nested under. It is there because it is
**the one thing that has to differ between two client instances**, and a URL is
the only per-tab identity a browser hands out for free. It also survives a
reload, which is what lets a tab come back to the same project.

**The URL does not scope anything.** §2 proved a remote function cannot see it.
It is where the client *keeps* its project, not how the server *learns* it — the
client reads it and sends it, every call. Worth stating plainly, because a token
sitting in the address bar reads as though it were doing the work.

`?project=` would serve equally well and is equally safe. Path because it reads
as identity rather than as an option.

The **first** token, before a project picker exists, is the development one
configuration names — see §3. `/app` redirects to it.

### Step 1 — a view calls the capability's browser door

```ts
import { set } from "$settings";           // index.ts — remote re-exports only
import { page } from "$app/state";

await set({ project: page.params.project, key: "theme", value: "dark" });
```

The view reads the token from its own URL. It has it; the remote function will
not.

### Step 2 — kit sends it, and the cookie rides along

```text
POST /_app/remote/<hash>/set
Cookie: session=…                          ← automatic, same-origin
{ project: "<token>", key: "theme", value: "dark" }
```

### Step 3 — `handle` resolves the session, and only the session

```ts
// hooks.server.ts
export const handle: Handle = async ({ event, resolve }) => {
  event.locals.session = await resolveSession(event.cookies);   // { userId }
  return resolve(event);
};
```

`resolveSession` reads the session cookie and answers **who is asking**. Nothing
more — it cannot know the project, because the project is in a request body that
`handle` runs before anyone has parsed.

**This is a real change from what is built today**, where `handle` sets
`locals.scope` outright. It cannot any more.

### Step 4 — the remote wrapper assembles the scope

The one place holding both halves: the session from `locals`, the token from the
input.

```ts
// api/set/set.remote.ts
export const set = command("unchecked", async (input: SetInput) => {
  const { locals } = getRequestEvent();
  const scope = await resolveScope(locals.session, input.project);   // 404 if not this user's
  return setSetting(scope, { key: input.key, value: input.value });
});
```

`resolveScope` does the §3 lookup and returns `{ userId, projectId }`. **The project
token stops existing here** — nothing below this line has ever heard of one.

### Step 5 — the procedure runs

```ts
// api/set/set.ts
export const set = async (scope: Scope, input: SettingInput): Promise<Setting> =>
  record("set", { key: input.key }, async () => {
    const key = canonicalKey(input.key);
    const database = await projectDatabase(scope.projectId);
    // upsert, with updated_by = scope.userId
  });
```

### What that costs

Two files per public function — the procedure and its wrapper — plus one lookup
per call. The wrapper is four lines and holds no logic, which is why the same
procedure serves a load function calling `set(scope, input)` directly with no
wrapper involved at all.

### Three properties of the shape

**The token is known in exactly one function.** `resolveScope` resolves it;
everything below takes a resolved `Scope`. Swapping a configuration-derived map
for a control-database table touches that function alone.

**A procedure cannot be called without a scope.** It is the first parameter and
there is no default.

**Nothing below the wrapper can name a project.** `Scope` arrives already
resolved and already authorized, so there is no procedure that could forget to
check.

---

## 5. What a resolved scope gets you

Exactly one thing today, and probably one thing for a long time: **that project's
database.**

| Server object | Scoped? | Reached how |
| --- | --- | --- |
| `persistence` | **yes** — one database per project | `projectDatabase(scope.projectId)` |
| `observability` | no — one logger per process | `record()` resolves it itself |
| `configuration` | no — one snapshot per process | imported where read |

Nothing else is planned. A future scoped object — a per-project cache, a
subscription fan-out — would join the first row and get its own accessor beside
`projectDatabase`, which is why these are separate functions rather than one bundle
that would have to grow a field.

### Why an accessor exists at all

This is the part I previously over-built. The correction:

**The logger needs nothing from the caller.** It is process-wide. `record()`
resolves it itself, so a procedure never mentions it.

**The database is per-project, so it cannot be imported.** There is no
`import { database }` that could be correct — which database depends on
`scope.projectId`, known only at call time. So it is a call, and it takes the
project:

```ts
// runtime/server/index.server.ts
export const projectDatabase = async (projectId: string): Promise<Kysely<Database>> => {
  const { persistence } = await serverRuntime();
  const { database } = await persistence.forProject(projectId);
  return database;
};
```

**It lives on the composition root, not in `persistence/`.** That module exports
`createPersistence(configuration, logger)` — a constructor. The composition root
holds the built instance, so an accessor inside `persistence/` would have to reach
back up to it, which is a cycle.

This is what your "a function the runtime exports that takes the token and returns
the scoped database" describes, with one split: **token → scope** happens once per
request in `hooks.server.ts`; **scope → database** happens per procedure. Keeping
them apart is what confines token knowledge to one file.

---

## 6. The anchor capability: `data/settings`

Per-project settings, keyed. Small, real, and worth keeping: every project
eventually needs configuration that belongs to the project rather than to one
person's browser. It is the counterpart to `runtime/client/preferences`, which
holds *this browser's* panel widths.

```text
src/lib/capabilities/data/settings/          alias $settings
├── overview.md
├── index.server.ts          set, get, list + types + error
├── index.ts                 remote re-exports
├── errors.ts                invalid-key, invalid-value, setting-not-found
├── types/
│   ├── types.md
│   └── settings.ts          Setting, SettingInput
├── api/
│   ├── api.md
│   ├── shared/
│   │   ├── shared.md
│   │   ├── record.ts        instrumentation
│   │   └── canonical-key.ts admission — shared by all three
│   ├── set/    set.md   set.ts   set.remote.ts
│   ├── get/    get.md   get.ts   get.remote.ts
│   └── list/   list.md  list.ts  list.remote.ts
├── persistence/
│   └── persistence.md  tables.ts  initialize.ts  stored-types.ts
└── test/unit/…
```

### The table

```sql
settings
  key         text primary key
  value       jsonb        not null
  updated_by  text         not null   -- scope.userId
  updated_at  timestamptz  not null
```

No `project_id`. A project is its own database, so scoping is structural.

`updated_by` earns its place: it is written from `scope.userId`, which is **not**
in the input type. If a browser could put a user id in the payload, this column
would be a lie. It is the smallest possible demonstration that authority arrives
from the session rather than the caller.

### The three procedures

```ts
set(scope: Scope, input: { key: string; value: unknown }): Promise<Setting>
get(scope: Scope, key: string): Promise<Setting | undefined>
list(scope: Scope): Promise<readonly Setting[]>
```

`set`'s procedure tree, as `set.md` carries it — lint resolves every path:

```text
set(scope, input)
├── record("set", { key })              shared/record.ts
├── canonicalKey(input.key)             shared/canonical-key.ts
├── projectDatabase(scope.projectId)        $runtime/server
├── insert … on conflict (key) do update
│     set value, updated_by = scope.userId, updated_at = now()
└── return the stored row
```

### The remote wrapper

Four lines, and the only file that crosses the boundary:

```ts
// api/set/set.remote.ts
import { command, getRequestEvent } from "$app/server";
import { resolveScope } from "$runtime/server/scope.server";
import { set as setSetting } from "$settings/api/set/set";

export const set = command("unchecked", async (input: SetInput) => {
  const scope = await resolveScope(getRequestEvent().locals.session, input.project);
  return setSetting(scope, { key: input.key, value: input.value });
});
```

`'unchecked'` because the capability validates its own input — `canonicalKey`
runs on every path.

**`SetInput` carries a project *token*; the procedure's `SettingInput` does
not.** That split is the security property written as two types: the browser
names a handle it may or may not own, `resolveScope` turns it into a project or a
404, and by the time `set` is called there is no untrusted field left. **Neither
type has any slot for a user** — that comes only from the cookie.

### What this one capability exercises

Every mechanism the other two will need, at a size that fits on a screen:

| | |
| --- | --- |
| `Database` seam | `tables.ts` declares `settings` onto it |
| `INITIALIZERS` seam | `initialize.ts` joins the list; the database logs `initializers: 1` |
| Project isolation | two projects, two databases, no shared rows |
| User identity | `updated_by`, written from scope and absent from the input |
| Both doors | `index.server.ts` imports Kysely; `index.ts` must not |
| Both call forms | a load function calls `set` directly; a view calls `set.remote` |
| Command and query | `set` mutates, `get`/`list` read |
| Procedure tree | lint resolves the paths in `set.md` |
| Drift check | change a column, fail at startup |

---

## 7. One project per client instance

**Decided.** A client instance — one browser tab today, one desktop window later
— acts on exactly one project for its whole life. By the time you are at `/app`
the project is fixed, and everything reachable from there is scoped to it.

That is a stronger guarantee than "the server checks each call," and it is the
one that makes accidental cross-project access structurally impossible rather
than merely rejected: there is no second project a client instance could name,
because it holds one token and the token is in its own URL.

Two client instances may hold different projects. They are separate workbenches
with separate tabs, which is the same reason the client model objects are
per-instance rather than shared.

### The consequence this exposes

**`runtime/client/storage` writes to `localStorage`, which is browser-wide.**
Everything currently goes to one key, `icarus.client`. Two tabs on two projects
would clobber each other's workbench, because the storage granularity does not
match the object granularity.

The split follows the same authority/selection line as §3:

| State | Granularity | Store |
| --- | --- | --- |
| Panel widths, collapsed flags | the browser — a person's ergonomics do not change per tab | `localStorage` |
| Open tabs, active tab, inspections | the client instance — this is the workbench | `sessionStorage`, keyed by project |

`sessionStorage` is per-tab and survives reload, which is exactly the lifetime a
client instance has. It is a change inside `storage/`, invisible to
`preferences` and `workbench`, and it is not part of this document's work — but
it is wrong today and should be fixed before the shell is wired.

### Still open, and deferred on purpose

**How a client instance acquires its project token.** Something has to mint the
first one — a project picker, a redirect from `/app` to the user's last project,
or a default while there is one project in configuration. That is the
authentication story, and `resolveSession` is where it lands.

---

## 8. What this means for the other two

Nothing changes in Name Manager or Rich Content beyond taking `Scope` first and
calling `projectDatabase`. Both are already procedural; both already validate their
input. The `settings` capability is built first because it is the one small
enough to be wrong cheaply.

---

## 9. Verification

Run against `node build/index.js`, calling the generated remote endpoints the way
a browser does — base64url-encoded devalue payloads, `Origin` set.

| | Result |
| --- | --- |
| `/app` names no project | `307 → /app/dev-project` |
| write a scalar | `{"key":"editor.theme","value":"dark","updatedBy":"default-user",…}` |
| write an object | `{"family":"Inter","size":14}` survives the `jsonb` round trip |
| overwrite | last writer wins; one row, not two |
| list | key order, both settings |
| invalid key | `400 invalid-key: key must be lowercase letters, digits, dots…` |
| oversized value | `400 invalid-value: value must serialize to at most 65536 bytes` |
| **project token this user does not hold** | **`404 No such project`** |
| **no project token at all** | **`400 A project token is required`** |
| the project database | opens logging `initializers: 1` |
| instrumentation | 5 `set.started`, 3 `completed`, 2 `rejected` — matching the calls |

`updatedBy` is `default-user` on every write, and no payload field could have set
it: the wrapper never passes one and `SettingInput` has no slot for one.

Project isolation is asserted in `test/unit/api/list/list.test.ts` against two
real databases rather than over HTTP, because two client instances on two
projects is not something one process can be asked for yet.

`pnpm build` succeeding is itself a check: kit fails it if a `.server.` module
reaches the client graph.

---

## 10. What building it found

Three things the design did not predict. This is why it was built small first.

**A remote function that nothing imports does not exist.** The first build
produced an empty `remotes: {}` map — kit tree-shakes an unreferenced
`.remote.ts` out entirely. An unused capability is not a quiet capability; it is
an absent one. That is why `/app/[project]` has a settings panel: the capability
needed a real consumer to be reachable at all.

**A stated refusal reached the browser as `500 Internal Error`.** Kit hides
thrown values deliberately and cannot tell a `SettingsError` from a null
dereference, so a view had no way to distinguish "that key is not valid" from
"the server is broken" — and the only honest thing it could show was the second.
Fixed by `api/shared/stated.ts`, which is now part of the template and the
generator. **Found by calling the endpoint, not by reading the code.**

**Commands are CSRF-protected and queries are not.** A `command` is a POST and
kit refuses one whose `Origin` does not match the server's, which is correct and
worth knowing: `adapter-node` derives that origin from the `ORIGIN` environment
variable, so a deployment that does not set it refuses every mutation.

A fourth, smaller: devalue refuses to encode a `__proto__` key at all, so that
payload cannot cross the wire. The guard in `canonicalValue` is defense in depth
behind it — still worth keeping, because a server-side caller is not bound by
devalue.
