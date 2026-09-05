# Phase 1 — Server Application Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the SvelteKit SPA into a Node server application with server-side rendering, a request-scoped identity seam, an operational health route, and a proven remote-function wire — so Phases 2 through 4 have somewhere to put server capabilities.

**Architecture:** `adapter-static` becomes `adapter-node`, which is the only way SvelteKit can run server code. `ssr = false` is deleted, which is safe right now because nothing imports the four capability runtimes — they are unconsumed today, so no module-level singleton executes on the server. A `$runtime` alias opens the `src/lib/runtime/` tree, whose first inhabitant is `scope.server.ts`: the one function that answers "who is asking, and about which project." `hooks.server.ts` calls it once per request and puts the result on `event.locals`. Nothing is migrated in this plan.

**Tech Stack:** SvelteKit 2.70.2, Svelte 5.56.9, Vite 8.2.1, TypeScript ~6, `@sveltejs/adapter-node`, vitest. Node 26 and pnpm 11 come from the Nix devshell.

**Spec:** [`docs/superpowers/specs/2026-08-13-capability-integration-design.md`](../specs/2026-08-13-capability-integration-design.md)

## Global Constraints

- **All work happens inside `apps/frontend/`.** Promotion to the repository root is Phase 6. Every path below is relative to `apps/frontend/` unless it starts with `docs/` or `apps/`.
- **Work in a git worktree.** The user commits to `main` mid-task, so implementation must not run in the main checkout.
- **Never run git commands beyond what a task's commit step specifies.** A bare `git commit` would sweep up the user's pre-staged work.
- **No relative imports.** Every cross-file import uses an alias — `$lib`, `$runtime`, `$app/*`. This is an existing project rule and Phase 2's lint will enforce it.
- **Every directory and `.ts` file is kebab-case.** Compound extensions are checked per dot-separated segment, so `scope.server.test.ts` and `smoke.remote.ts` are valid.
- **No `sed`, `perl`, or other bulk-edit commands.** Use one edit per file.
- **Toolchain is not on `PATH`.** Prefix commands with:
  ```
  PATH="/nix/store/2gf37maq4k2nhidw22dxndccma074cak-nodejs-26.7.0/bin:/nix/store/9fa6mafvkmid11za3h07i5k93kxk4jbf-pnpm-11.20.0/bin:$PATH"
  ```
  or run inside `nix develop ./infra/devshell`. Every `Run:` line below assumes this is done and that the working directory is `apps/frontend/`.
- **Baseline:** `pnpm typecheck` currently reports `1156 FILES 0 ERRORS 0 WARNINGS`. It must still report 0 errors at the end of every task.

---

### Task 1: Serve on Node with server-side rendering

**Files:**
- Modify: `package.json` (dependencies + `dependencies`/`devDependencies` blocks)
- Modify: `svelte.config.js:1-30` (whole file)
- Delete: `src/routes/+layout.ts`
- Modify: `docs/routing.md:18-26` (the "SPA, not SSR" section)

**Interfaces:**
- Consumes: nothing.
- Produces: a `build/index.js` Node server entry point; server-side rendering active for every route, which Task 4 relies on to prove a remote function runs during render.

- [ ] **Step 1: Install the Node adapter and remove the static one**

```bash
pnpm remove @sveltejs/adapter-static
pnpm add -D @sveltejs/adapter-node
```

- [ ] **Step 2: Replace `svelte.config.js`**

The existing file's comments describe an SPA and are now wrong; replace the whole file rather than editing around them.

```js
import adapter from "@sveltejs/adapter-node";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/**
 * Svelte 5 + SvelteKit. `vitePreprocess` is what lets `<script lang="ts">` work
 * inside components — it hands the block to Vite's esbuild transform, which
 * strips types without checking them. Type *checking* is `pnpm typecheck`
 * (svelte-check), not the build.
 *
 * `adapter-node` rather than `adapter-static`: a static build cannot run server
 * code at all, and everything from Phase 3 onward runs on the server. The build
 * output is a Node server at `build/index.js`.
 */
export default {
  preprocess: vitePreprocess(),

  kit: {
    adapter: adapter(),
  },
};
```

- [ ] **Step 3: Delete the SPA route options**

```bash
rm src/routes/+layout.ts
```

That file set `ssr = false` and `prerender = false`. Both are now the framework
defaults — `ssr` defaults to `true`, `prerender` to `false` — so the file has
nothing left to say. Deleting it is what turns SSR on.

- [ ] **Step 4: Rewrite the SSR section of `docs/routing.md`**

Replace the section currently headed `## SPA, not SSR` with:

```markdown
## Server-rendered

`svelte.config.js` uses `adapter-node`, and there is no `+layout.ts` setting
`ssr = false` — both SvelteKit defaults apply, so every route renders on the
server and hydrates on the client.

This is a change from the original SPA design, and the reason is that the
backend was merged into this application: capabilities run in this process, so
there is a server to render on.

Server rendering has one standing obligation: a module that runs during render
must not touch `window`, `document`, or `localStorage` at module or
component-init scope. Guard those with `browser` from `$app/environment`, or
read them in an effect after mount.
```

- [ ] **Step 5: Build, and verify the Node entry point exists**

```bash
pnpm build
ls build/index.js
```

Expected: the build succeeds and `build/index.js` is listed. Under
`adapter-static` this file did not exist — the output was `build/index.html` and
prerendered assets.

- [ ] **Step 6: Start the built server and prove SSR is actually on**

```bash
node build/index.js &
sleep 2
curl -s localhost:3000/app | grep -c 'No object open'
```

Expected: `1` or greater.

This is the real assertion of this task. `src/routes/app/+page.svelte` renders
the literal text `No object open.` **With SSR off, this returns `0`** — the
server sent an empty shell and that text only appeared after the client
hydrated. A non-zero count means the server rendered the component tree.

- [ ] **Step 7: Stop the server**

```bash
kill %1
```

- [ ] **Step 8: Verify types still pass**

```bash
pnpm typecheck
```

Expected: `0 ERRORS`.

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-lock.yaml svelte.config.js docs/routing.md
git add -u src/routes/+layout.ts
git commit -m "feat(app): serve on Node with server-side rendering

adapter-static cannot run server code, and everything from Phase 3 onward
runs on the server. Deleting +layout.ts turns SSR on: both values it set are
now the framework defaults.

Safe to enable now because nothing imports the four capability runtimes yet
— their module-level singletons would otherwise be shared across every
request on the server."
```

---

### Task 2: The scope seam

**Files:**
- Modify: `svelte.config.js` (add `kit.alias`)
- Modify: `vite.config.ts` (add the `test` block)
- Modify: `package.json` (add vitest, add the `test` script)
- Create: `src/lib/runtime/server/scope.server.ts`
- Create: `src/lib/runtime/server/scope.server.test.ts`
- Modify: `src/app.d.ts:1-12` (whole file)
- Create: `src/hooks.server.ts`

**Interfaces:**
- Consumes: server-side rendering from Task 1.
- Produces:
  - `$runtime` → `src/lib/runtime`, the alias every later phase reaches the runtime tree through.
  - `type Scope = { readonly projectId: string; readonly userId: string }` from `$runtime/server/scope.server`. **Every capability procedure written in Phase 5 takes this as its first parameter.**
  - `resolveScope(session: { userId: string } | undefined, projectToken: string | undefined): Promise<Scope>` — async now so the signature survives becoming a database lookup.
  - `App.Locals.scope: Scope`, read by load functions and remote wrappers.
  - `DEMO_USER_ID` and `DEMO_PROJECT_ID` constants, which Phase 3's persistence registry uses to name its first project directory.
  - **The convention that a server module's *door* carries `.server.ts`** — see Step 6. Internals do not. Phase 3's persistence, observability, and configuration each get an `index.server.ts` and unmarked files beneath it.

- [ ] **Step 1: Add the `$runtime` alias**

In `svelte.config.js`, add `alias` inside `kit`:

```js
  kit: {
    adapter: adapter(),

    // One alias per tree that code reaches across. `$lib` is built in.
    // Per-capability aliases arrive with their capabilities in Phase 4 and 5;
    // there are none yet, so this is the only entry.
    //
    // SvelteKit generates .svelte-kit/tsconfig.json paths from this, so the
    // compiler and the bundler cannot drift — which is why there is no second
    // map to keep in step.
    alias: {
      $runtime: "src/lib/runtime",
    },
  },
```

- [ ] **Step 2: Install vitest**

```bash
pnpm add -D vitest
```

- [ ] **Step 3: Configure vitest and add the script**

In `vite.config.ts`, add a `test` block:

```ts
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  // tailwindcss() before sveltekit(): the CSS plugin needs to see .svelte files
  // as content sources, which requires it to be registered first.
  plugins: [tailwindcss(), sveltekit()],

  server: {
    port: 3000,
  },

  // Tests reuse this config, which is the whole reason they run under vitest
  // rather than `node --test`: `$runtime` and `$lib` resolve here and nowhere
  // else. Node resolves package.json "imports", whose keys must begin with `#`.
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",

    // SvelteKit's server-only guard blocks any import of a `*.server.ts` file
    // from client-reachable code, and it checks for exactly this variable to
    // stand down. Without it a test importing a server module could trip the
    // guard instead of running.
    env: {
      TEST: "true",
    },
  },
});
```

In `package.json`, add to `scripts`:

```json
    "test": "svelte-kit sync && vitest run",
```

`svelte-kit sync` first because the generated `.svelte-kit/tsconfig.json` is
what makes aliases resolvable; a fresh checkout has no `.svelte-kit`.

- [ ] **Step 4: Write the failing test**

Create `src/lib/runtime/server/scope.server.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "vitest";
import {
  DEMO_PROJECT_ID,
  DEMO_USER_ID,
  resolveScope,
} from "$runtime/server/scope.server";

test("falls back to the demo user when there is no session", async () => {
  const scope = await resolveScope(undefined, undefined);

  assert.equal(scope.userId, DEMO_USER_ID);
  assert.equal(scope.projectId, DEMO_PROJECT_ID);
});

test("honours an authenticated session's user id", async () => {
  const scope = await resolveScope({ userId: "user-7" }, undefined);

  assert.equal(scope.userId, "user-7");
});

test("ignores the project token until membership exists", async () => {
  // Documented stub behaviour, asserted so that the day it changes, this test
  // fails and says so rather than the change passing silently.
  const scope = await resolveScope(undefined, "some-opaque-token");

  assert.equal(scope.projectId, DEMO_PROJECT_ID);
});
```

- [ ] **Step 5: Run the test to verify it fails**

```bash
pnpm test
```

Expected: FAIL — `Failed to resolve import "$runtime/server/scope.server"`.

- [ ] **Step 6: Write `scope.server.ts`**

Create `src/lib/runtime/server/scope.server.ts`.

**The `.server.ts` suffix is load-bearing and not decoration.** SvelteKit's
path-based guard protects exactly `$lib/server/**` — the literal `src/lib/server`
directory. `src/lib/runtime/server/` is *not* that path, so the directory name
buys **no protection at all**; the only mechanism covering this tree is the
`*.server.*` basename pattern, which fails the build with the full import chain.

**Mark the door, not every file** — the same rule capabilities already use. This
module is a single file, so it is its own door and carries the suffix. When
Phase 3 makes persistence a directory it becomes `persistence/index.server.ts`
with unmarked internals (`types.ts`, `definition.ts`, `constructor.ts`), exactly
as a capability marks `index.server.ts` and leaves `api/` alone.

What that leaves uncovered is a deliberate deep-import of an internal into a
component, which the guard would not see. It still fails the build — `node:fs`
and friends cannot be bundled for a browser — just with a worse message than the
guard's import chain. Closing that properly needs a lint rule over `runtime/**`,
and runtime structure enforcement is post-integration.

```ts
/**
 * Who is asking, and about which project.
 *
 * Server-provided infrastructure — the database registry, the logger,
 * configuration — is *imported* by the procedures that need it. Identity is
 * not, because it comes from the request. So every capability procedure takes a
 * Scope as its first parameter and its own input as the rest.
 *
 * Keeping scope out of the input type is a security property, not tidiness: the
 * browser's payload has no slot for `projectId` or `userId`, so a client cannot
 * name a project it does not belong to and no procedure has to remember to
 * overwrite what it was sent.
 */
export type Scope = {
  readonly projectId: string;
  readonly userId: string;
};

/** The one user and project that exist before authentication does. */
export const DEMO_USER_ID = "demo-user";
export const DEMO_PROJECT_ID = "demo-project";

/**
 * Resolves one request's scope.
 *
 * Both parameters are unused today and are present because they are the ones
 * that survive. When the auth capability lands, this looks `projectToken` up
 * against the caller's membership rows in the control database — which makes
 * the lookup itself the authorization check, since a miss is a 404 rather than
 * a fallback. It is `async` now for the same reason: that lookup hits a
 * database, and a signature change would reach every caller.
 *
 * `session` is server-derived, never client-supplied. A user id taken from a
 * request body or URL would let a caller act as anyone.
 */
export const resolveScope = async (
  session: { userId: string } | undefined,
  projectToken: string | undefined
): Promise<Scope> => ({
  projectId: DEMO_PROJECT_ID,
  userId: session?.userId ?? DEMO_USER_ID,
});
```

- [ ] **Step 7: Run the test to verify it passes**

```bash
pnpm test
```

Expected: PASS, 3 tests.

- [ ] **Step 8: Declare `App.Locals`**

Replace `src/app.d.ts` entirely:

A type-only import of a `*.server.ts` module is safe here: `verbatimModuleSyntax`
is on, so `import type` is erased before Vite resolves anything and the guard
never sees it.

```ts
// See https://svelte.dev/docs/kit/types#app.d.ts
import type { Scope } from "$runtime/server/scope.server";

declare global {
  namespace App {
    interface Locals {
      /**
       * Who is asking, and about which project. Set once per request by
       * hooks.server.ts, read by load functions and remote wrappers.
       */
      scope: Scope;
    }
    // interface Error {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
```

- [ ] **Step 9: Create the hook**

Create `src/hooks.server.ts`:

```ts
import type { Handle } from "@sveltejs/kit";
import { resolveScope } from "$runtime/server/scope.server";

/**
 * One scope resolution per request.
 *
 * Both of `resolveScope`'s inputs are `undefined` here because neither source
 * exists yet: there is no session cookie to read a user from, and no
 * `[project]` route to take a token from. The seam is created now rather than
 * later because every capability procedure added from Phase 3 onward reads
 * `locals.scope`, and retrofitting it would touch all of them.
 *
 * Phase 3 adds `locals.runtime` beside it — a lazy resolver over the
 * project-keyed database registry.
 */
export const handle: Handle = async ({ event, resolve }) => {
  event.locals.scope = await resolveScope(undefined, undefined);
  return resolve(event);
};
```

- [ ] **Step 10: Verify types and the build**

```bash
pnpm typecheck
pnpm build
```

Expected: `0 ERRORS`, and the build succeeds. The typecheck is what proves
`$runtime` resolves through the generated tsconfig paths rather than only
through Vite.

- [ ] **Step 11: Commit**

```bash
git add svelte.config.js vite.config.ts package.json pnpm-lock.yaml
git add src/lib/runtime/server/scope.server.ts src/lib/runtime/server/scope.server.test.ts
git add src/app.d.ts src/hooks.server.ts
git commit -m "feat(runtime): add the request scope seam

Server infrastructure is imported by the procedures that need it; identity
comes from the request, so it is an argument. Scope is deliberately not part
of any procedure's input type — the browser payload has no slot for
projectId or userId, so a client cannot name a project it does not belong to.

resolveScope is async and takes both eventual inputs now, so the signature
survives becoming a membership lookup against the control database.

Named .server.ts because src/lib/runtime/server is NOT \$lib/server: kit's
path guard covers only the literal src/lib/server directory, so the filename
pattern is the only thing protecting this tree. A single-file module is its
own door; internals under a directory door stay unmarked, as in a capability.

vitest arrives with this task because it is the first thing with a unit test,
and because \`node --test\` cannot resolve \$-aliases: Node resolves
package.json imports, whose keys must begin with #."
```

---

### Task 3: The health route

**Files:**
- Create: `src/routes/health/+server.ts`

**Interfaces:**
- Consumes: `adapter-node` from Task 1 — a static build cannot serve a request handler.
- Produces: `GET /health` returning `{ service: "icarus", status: "ok", timestamp: <ISO 8601> }`. Nothing in later phases imports this; it exists for operators.

- [ ] **Step 1: Create the route**

```ts
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/**
 * `GET /health` — the process identity and the moment it answered.
 *
 * Operational only. It inspects no database, provider, or queue, so a 200 here
 * means the process is up and routing, not that it is healthy in any deeper
 * sense. Adding a database probe would make it a liveness check that fails
 * during a database restart, which is usually not what a load balancer wants.
 *
 * This replaces the backend endpoint of the same name. It is a real HTTP
 * endpoint rather than a capability's surface — the distinction the integration
 * draws is that capabilities are reached by calling functions, and this is
 * reached by a machine that only speaks HTTP.
 */
export const GET: RequestHandler = () =>
  json({
    service: "icarus",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
```

- [ ] **Step 2: Start the dev server**

```bash
pnpm dev &
sleep 4
```

- [ ] **Step 3: Verify the route answers**

```bash
curl -s localhost:3000/health
```

Expected: JSON containing `"service":"icarus"` and `"status":"ok"`, with a
`timestamp` field holding an ISO 8601 string.

- [ ] **Step 4: Verify it is JSON, not an HTML error page**

```bash
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' localhost:3000/health
```

Expected: `200 application/json`.

This is worth asserting separately: a missing or misnamed `+server.ts` produces
SvelteKit's HTML 404 page, and `curl -s` alone would print that without
obviously failing.

- [ ] **Step 5: Stop the dev server**

```bash
kill %1
```

- [ ] **Step 6: Commit**

```bash
git add src/routes/health/+server.ts
git commit -m "feat(routes): add GET /health

Process identity only — no database, provider, or queue probe, so a 200
means up and routing rather than healthy in a deeper sense.

Replaces the backend endpoint of the same name. A real HTTP endpoint rather
than a capability surface: capabilities are reached by calling functions,
and this is reached by a machine that only speaks HTTP."
```

---

### Task 4: Prove the remote-function wire

**Files:**
- Modify: `svelte.config.js` (add `kit.experimental.remoteFunctions`)
- Create: `src/lib/runtime/server/smoke.remote.ts`
- Create: `src/routes/smoke/+page.svelte`

**Interfaces:**
- Consumes: `$runtime` from Task 2, server-side rendering from Task 1.
- Produces: `experimental.remoteFunctions` enabled, which every capability's `<function>.remote.ts` requires. The first real one arrives in Phase 5 — Phase 4's client objects persist to a cookie and cross no boundary — so the two smoke files are the only proof the wire works until then, and Phase 5 deletes them.

This task exists because remote functions are the single largest bet in the
design and they are an experimental API. Three later phases depend on the wire
working; proving it costs two files now and would cost a redesign later.

- [ ] **Step 1: Enable the flag**

In `svelte.config.js`, add `experimental` inside `kit`:

```js
  kit: {
    adapter: adapter(),

    alias: {
      $runtime: "src/lib/runtime",
    },

    // Remote functions are how a browser reaches a capability: a three-line
    // wrapper per exposed function, and no endpoint layer at all. The API is
    // experimental and may change in a minor release — the bet is cheap
    // because every wrapper is a three-line file at a predictable path, so an
    // API change is a mechanical sweep and the fallback is a +server.ts route
    // per function with the same procedures underneath.
    experimental: {
      remoteFunctions: true,
    },
  },
```

- [ ] **Step 2: Write the smoke query**

Create `src/lib/runtime/server/smoke.remote.ts`:

```ts
import { getRequestEvent, query } from "$app/server";

/**
 * Proves the remote-function wire works end to end.
 *
 * Temporary, and deliberately so — Phase 5 deletes this file and its route
 * once a real capability has a `.remote.ts`. Until then it is the only thing
 * that would notice the wire breaking, and four phases are built on it.
 *
 * It reads `locals.scope` on purpose: that is precisely the shape every Phase 5
 * wrapper takes — resolve scope from the request, pass it to a procedure, and
 * never let the browser's payload carry identity. Proving the wire without also
 * proving the seam would leave half the pattern untested.
 *
 * A `.remote.ts` file may export *only* remote functions: the SSR transform
 * loops over every export assigning `fn.__.id`, so a plain exported function
 * throws at module load. On the client the body is discarded entirely and
 * regenerated as a fetch stub, which is why such a file may freely import the
 * whole server tree — and why it needs no `.server.` in its name.
 */
export const smokeCheck = query(async () => {
  const { scope } = getRequestEvent().locals;

  return {
    projectId: scope.projectId,
    userId: scope.userId,
    answeredAt: new Date().toISOString(),
  };
});
```

- [ ] **Step 3: Write the route that calls it**

Create `src/routes/smoke/+page.svelte`:

```svelte
<script lang="ts">
  import { smokeCheck } from "$runtime/server/smoke.remote";

  /**
   * Calls a server function from a component with no endpoint, no wire type,
   * and no fetch. Temporary — see smoke.remote.ts.
   *
   * `{#await}` rather than top-level `await`: awaiting in a component's
   * instance scope needs Svelte's async compiler option, and this proves the
   * wire without also turning that on.
   */
  const check = smokeCheck();
</script>

{#await check}
  <p>pending</p>
{:then result}
  <p data-answered-at={result.answeredAt}>remote ok for {result.userId} on {result.projectId}</p>
{:catch error}
  <p>remote failed: {error.message}</p>
{/await}
```

- [ ] **Step 4: Start the dev server**

```bash
pnpm dev &
sleep 4
```

- [ ] **Step 5: Verify the query ran on the server during render**

```bash
curl -s localhost:3000/smoke | grep -c 'remote ok'
```

Expected: `1`.

This is the assertion that matters. With SSR on, the query executes on the
server while the page renders, so `remote ok` is in the delivered HTML. If the
transform is not active the page delivers `pending` or `remote failed`, and
`grep -c` returns `0`.

- [ ] **Step 6: Verify the scope seam reached the remote function**

```bash
curl -s localhost:3000/smoke | grep -c 'remote ok for demo-user on demo-project'
```

Expected: `1`.

This asserts the second half of the pattern: `hooks.server.ts` populated
`locals.scope`, `getRequestEvent()` inside the remote function saw it, and the
resolved values crossed back into the component. Every Phase 5 wrapper is this
shape, so a failure here is a failure of the design rather than of this route.

- [ ] **Step 7: Stop the dev server**

```bash
kill %1
```

- [ ] **Step 8: Verify the production build accepts remote functions**

```bash
pnpm build
```

Expected: succeeds. Worth its own step: the build fails with an explicit error
if a `.remote.ts` file exists while `experimental.remoteFunctions` is off, so
this confirms the flag reached the build config and not only the dev server.

- [ ] **Step 9: Verify types**

```bash
pnpm typecheck && pnpm test
```

Expected: `0 ERRORS`, and the 3 tests from Task 2 still pass.

- [ ] **Step 10: Commit**

```bash
git add svelte.config.js src/lib/runtime/server/smoke.remote.ts src/routes/smoke/+page.svelte
git commit -m "feat(app): enable and prove remote functions

Remote functions are how a browser reaches a capability, and they are the
largest bet in the integration design — an experimental API that three
phases depend on. Proving the wire costs two temporary files now.

The smoke route asserts the query runs server-side during render, which is
the behaviour the whole design rests on: types flow from the server
implementation, the client module is regenerated as a fetch stub, and no
endpoint or wire type is written by hand.

Both files are deleted in Phase 5, once a real capability has a .remote.ts."
```

---

## Phase 1 is done when

- [ ] `pnpm build` produces `build/index.js`, and `node build/index.js` serves.
- [ ] `curl -s localhost:3000/app | grep -c 'No object open'` returns `1` or more — SSR is on.
- [ ] `curl -s -o /dev/null -w '%{http_code} %{content_type}' localhost:3000/health` returns `200 application/json`.
- [ ] `curl -s localhost:3000/smoke | grep -c 'remote ok for demo-user on demo-project'` returns `1` — the remote wire and the scope seam both work.
- [ ] `pnpm typecheck` reports `0 ERRORS`.
- [ ] `pnpm test` passes 3 tests.
- [ ] `src/routes/+layout.ts` no longer exists.
- [ ] `docs/routing.md` describes a server-rendered application, not an SPA.

## Notes for Phase 2 — the capability standard

Three files this plan creates sit outside `capabilities/`, and the lint rewrite has to account for each. All three are legitimate; none should be made to fit a capability rule.

- **`scope.server.test.ts` sits beside the module it tests.** The current rule 11 allows `*.test.ts` only under a capability's `test/`. `runtime/` is not a capability, so that rule must be scoped to `capabilities/**` or `runtime/**` needs its own convention.
- **`smoke.remote.ts` is a `.remote.ts` outside any capability.** The rule that a `.remote.ts` sits in `api/<function>/` and is named for its directory must apply within `capabilities/**` only, or this file fails lint until Phase 5 deletes it.
- **`runtime/**` structure enforcement is deliberately out of scope.** A runtime object will have types, a definition, methods, and supporting procedures, and the shape those settle into is not yet known. Phase 2 should lint `capabilities/**` thoroughly and leave `runtime/**` alone rather than guess.

## Notes for Phase 3 — server runtime objects

- `locals.runtime` joins `locals.scope` in `hooks.server.ts` as a lazy resolver over the project-keyed database registry.
- `DEMO_PROJECT_ID` is the name of the first project directory the registry creates.
- **A server module's door carries `.server.ts`; internals do not.** `persistence/index.server.ts` is what a component could reach, so that is what needs the marker — `types.ts`, `definition.ts`, and `constructor.ts` beneath it stay unmarked, exactly as a capability marks its index and leaves `api/` alone. `src/lib/runtime/server/` is not `$lib/server/`, so the directory name protects nothing on its own.
- The three `import.meta.resolve` path derivations to fix are in `configuration`, `observability`, and `persistence`. They break silently under bundling — a wrong directory is still a valid path — so each needs an assertion that the resolved directory is the intended one, not merely that the code runs.
- `resolveScope` keeps its stub body. It gains a real one with the auth capability, which is post-integration.
