# Client model rebuild

Implementing [`docs/client-model/`](../../client-model/) — resource runtimes, the
workbench, and the copilot — against the codebase as it stands after stage 0.

## Status

| Landing | State |
| --- | --- |
| 1 — `revisions` types capability | **Done** |
| 2 — client `configuration` object | **Done** |
| 3 — `resource-runtimes` | **Done** |
| 3a — `methods/shared/` takes one caller | **Done** |
| 4 — the workbench, deleted and rebuilt | **Done** |
| 5 — the shell views | **Done** |
| 6 — `Selector`, then `copilot` | **Done** |

394 tests, 189 script tests, four linters and `svelte-check` all clean;
`pnpm build` succeeds and `/app/[project]` serves its published configuration.

**Three departures from the design documents**, each because the document as
written does not compile or does not hold:

1. `insert` carries `ids` — below.
2. `Attachment`'s ref arm is wrapped as `{ kind: "resource"; ref }`.
   `ResourceRef | { kind: "link"; … }` is not a discriminated union, because
   `ResourceRef.kind` is an **open** string and `"link"` is a legal resource
   kind.
3. `frame.contextId` is optional. Which context a screen defaults to is the
   context panel's knowledge, so a freshly minted tab genuinely has no rail
   position — absent means "the panel's default".

**The change to the vocabulary stage 0 designed.** `insert` now carries `ids`
alongside `values`. Without them nothing can invert an insert — a `remove` names
ids, and reading one out of each opaque value is exactly the body-shape
assumption the client is not allowed to make. `insert` and `remove` are now exact
mirrors, and "every op is closed under inversion" is true rather than nearly
true.

## Context

`docs/client-model/` describes five client objects. Three exist today
(`storage`, `workbench`, `commands`), and the workbench that exists is not the
one described: it identifies a tab by `ResourceRef` over two resource kinds,
stores `permanent` as a field, carries an untyped options blob, and holds an
inspection ancestry of payload-carrying nodes. The design replaces all of that,
adds a register of per-resource edit runtimes, and adds an object holding the
unsent copilot message.

The workbench document claims the model cannot land without the shell views,
the screens registry, and eleven placeholder screens, because `CONTEXT_IDS`
grows from 2 members to ~50 and breaks the total `Record` maps in the views.
**That claim is retired**: the context vocabulary moves to the context panel
view, so no model type grows as screens arrive, and every landing below is
independently shippable.

## Decisions taken during review

| Decision | Resolution |
| --- | --- |
| Workbench migration | **Deleted and rebuilt**, not migrated |
| Landing shape | Six independent landings; nothing is a non-splittable seam |
| Context vocabulary | **Moves to `views/context-panel/`**. The workbench stores an opaque `contextId` string it never interprets |
| `permanent` | **Derived** from `target.kind === "singleton"`; comes off `Tab` |
| `TabTarget` | The nested three-arm union — singleton, resource, launcher |
| Commands | **Untouched.** Already a separate object borrowing the workbench one-directionally; `COMMAND_IDS` does not grow |
| The capability behind the runtime | **Forward-declared.** The submit path is written and commented out |
| `Op` | A new **types-only `revisions` capability** — not `src/convex/`, not the model |
| Undo | Ops are closed under inversion by design; the runtime swaps payload fields and never resolves a path or reads a body |
| Flush thresholds | A new **client `configuration` model object**, fed from server configuration |
| Workbench persistence | **Retired.** The workbench ships without it; storage's workbench section comes out and returns when its shape is settled |
| `methods/shared/` | Lint relaxed from **two callers to one** |
| `Selector` | **The copilot document wins.** `$shared` gains `part` and `web` and drops the `set` arm |
| `copilot-bar` → `copilot-dock` | Intentional rename, in the copilot landing |

## The codebase as it stands

Three enforced trees under `app/src/lib`, each with a written standard, a review
checklist, a generator, and a linter — `pnpm lint` runs all four.

**Capabilities** — five. `access` and `settings` carry tables and API;
`shared`, `content` and `messages` landed with stage 0 and are **types only**:
an `overview.md`, a `types/` directory of Convex validators with inferred TS
types, `test/unit/types/`, and an alias. No `schema.ts`, no `api/`, no file
under `src/convex/capabilities/`. That shape is the template for `revisions`.

**Client model** — `storage` → `workbench` → `commands`, composed by
`buildClientModel` in [constructor.ts](../../../app/src/lib/model/client/constructor.ts),
initialized once by `/app/[project]/+layout.svelte`, reached everywhere else
through `clientModel()`. `ClientModel` has no `close()`.

**Views** — the six-zone frame in [app.svelte](../../../app/src/lib/views/app/app.svelte),
plus `tab-bar`, `context-panel`, `workspace`, `inspector`, `copilot-bar`,
`command-bar`. Model keys are resolved to components in the view that renders
them, never in a shared registry.

### What stage 0 gave us, and what it withheld

`$shared/types/resource-set-expression.ts` ships `ResourceSetExpression`,
`Selector`, and a real `normalize` implementing duplicate collapse, absorption
and exclude-wins — reuse it rather than reimplementing it in the copilot.

`Op`, `OpTarget` and `ResourceKey` were **designed in full and deliberately
deferred** to a `revisions` capability that does not exist. The design is at
[0-foundation-design.md](../../stage-0/0-foundation-design.md#revisionstypes--the-edit-vocabulary),
and the property the runtime depends on is stated there outright: *every op is
closed under inversion* — `was` reverses a `set`, `values` and `after` reverse a
`remove`, `wasAfter` reverses a `move`.

### The pattern every object here follows

[workbench/definition.svelte.ts](../../../app/src/lib/model/client/workbench/definition.svelte.ts)
holds **two classes**. `WorkbenchState` declares every rune and is "the only
thing a method is handed". `Workbench` declares **none** — it is getters and
one-line delegations over a private `#state`, and reactivity propagates through
the getters without it. Methods import `WorkbenchState` as `import type`, so the
definition/methods cycle erases at compile time.

Every method takes state as its first argument and returns a value. Nothing
composes two methods except the definition. An object holding a varying
collection — `Tab[]`, or a map of open resources — holds **records**, and the
verbs over them are ordinary methods.

---

## Landing 1 — the `revisions` types capability

Ships the op vocabulary only. No tables, no API, no deployment door — the shape
`content` and `messages` already have.

**Create**

```text
app/src/lib/capabilities/revisions/
├── overview.md                          what it owns; why types ship before tables
├── types/
│   ├── types.md
│   ├── op.ts                            Op · OpTarget, as Convex validators
│   └── resource.ts                      GeneralResourceType · ResourceKey
└── test/unit/types/
    ├── op.test.ts                       every arm validates; inversion payloads present
    └── resource.test.ts
```

**Change** — [`app/svelte.config.js`](../../../app/svelte.config.js): add
`$revisions: "src/lib/capabilities/revisions"` to the alias map.

**Two naming collisions to resolve here, not later.** Stage 0 calls the closed
three-member union `ResourceType`, while `$shared/types/resource.ts` already
exports `ResourceKind` as an *open string* over a much wider space. Ship it as
**`GeneralResourceType`**. Separately, stage 0's `ResourceKey` is
`{ resourceType, resourceId }` while the runtime document's is the template
string `"document:k57ab…"`; the capability keeps the object, and the register's
map key is named **`RuntimeKey`** in the model.

## Landing 2 — the client `configuration` object

The runtime's flush thresholds live in
[`configuration/revisions.yaml`](../../../app/configuration/revisions.yaml),
which only `model/server/configuration` reads — and the `environment` lint rule
forbids the client tree from importing it.

Fed by a **server load** rather than a remote function, because the values must
be present before `createResourceRuntimes` is called: a load returns
synchronously into the layout's `data` prop, whereas a remote function resolves
after mount and would force the runtime to carry defaults anyway. Nothing about
the object changes if it is later fed from a remote function instead.

**Create**

```text
app/src/lib/model/client/configuration/
├── configuration.md
├── index.ts
├── types.ts                             ClientConfiguration · ConfigurationSnapshot
├── definition.ts                        plain .ts — a snapshot declares no runes
├── constructor.ts                       createConfiguration(snapshot)
├── methods/
│   ├── methods.md
│   └── get.ts                           dotted key path against the snapshot
└── test/unit/
    ├── constructor.test.ts
    └── get.test.ts

app/src/routes/app/[project]/+layout.server.ts
```

`get` resolves a dotted path exactly as the server's
[get.ts](../../../app/src/lib/model/server/configuration/methods/get.ts) does —
own properties only, `undefined` for a miss.

`+layout.server.ts` projects an **explicit allowlist** of client-visible keys out
of `locals.model.configuration`, never the whole snapshot: the YAML also holds
observability settings and the development project token.

**Change**

- [`model/client/types.ts`](../../../app/src/lib/model/client/types.ts) —
  `ClientModelInput` gains the snapshot; `ClientModel` gains `configuration`
- [`model/client/constructor.ts`](../../../app/src/lib/model/client/constructor.ts) —
  built first, before storage
- `model/client/index.ts` — type exports
- `model/client/client.md` — object inventory
- [`+layout.svelte`](../../../app/src/routes/app/[project]/+layout.svelte) —
  take `data` as a prop and pass the snapshot into `initClientModel`

## Landing 3 — `resource-runtimes`

One model object holding a varying collection, exactly as the workbench holds
`Tab[]`. The register lives for the client instance; an entry lives from the
first tab that opens a resource to the last tab that closes it — the same
relationship a `Tab` has to the workbench, needing no special treatment.

**Why the register exists at all.** Two tabs split across one document must write
into one buffer, or each holds half the edits and whichever flushes second
submits against a stale revision. So entries are keyed by **resource**, never by
tab: `attach` is idempotent, the second tab gets what the first one made, and
`release` fires only when the last tab on that resource closes. The workbench
owns that lifetime, because it is the thing that knows when a tab begins and
ends — a view reaches a runtime through `workbench.runtimeFor(tab.id)` and never
touches the register.

**An entry is a record, not an object with behaviour.**

```ts
type RuntimeState = {
  type: GeneralResourceType;  id: string;
  body: unknown | undefined;  revision: number;   // last accepted base
  sync: SyncState;            buffer: Op[];       // unsent
  undoStack: Op[][];          redoStack: Op[][];  // one entry per gesture
  timer?: ReturnType<typeof setTimeout>;
  inFlight: boolean;          unsubscribe?: () => void;
};
```

Every verb over it — buffer, coalesce, flush, rebase, invert, push, pop — is a
free function in `methods/` taking the record first, exactly as
`close(state, id)` takes `WorkbenchState`.

`Runtime` is the handle `runtimeFor` returns: getters onto the record and
one-line delegations to those same functions, so a view writes `runtime.apply(ops)`
rather than naming a resource at every call site. It declares no rune, because
getters over `$state` propagate without one — which is why `Workbench` declares
none either.

**Create**

```text
app/src/lib/model/client/resource-runtimes/
├── resource-runtimes.md
├── index.ts
├── types.ts                     ResourceRuntimesModel · ResourceRuntime<Body>
│                                SyncState · RuntimeKey · BodyFor<T>
├── definition.svelte.ts         RuntimeState · Runtime
│                                ResourceRuntimesState · ResourceRuntimes
├── constructor.ts               createResourceRuntimes(configuration)
├── methods/
│   ├── methods.md
│   ├── attach.ts                idempotent open-or-return
│   ├── release.ts               flush, unsubscribe, move to settling
│   ├── release-all.ts
│   ├── apply.ts                 buffer, push history, report whether a flush is due
│   ├── flush/
│   │   ├── flush.md
│   │   ├── flush.ts             submit the buffer as one change set
│   │   ├── coalesce.ts          fold the buffer before it goes
│   │   └── rebase.ts            on refusal: resubmit at the new base revision
│   ├── history/
│   │   ├── history.md
│   │   ├── history.ts           the undo and redo stacks
│   │   └── invert.ts            swap the inversion payloads
│   └── shared/
│       ├── shared.md
│       └── runtime-key.ts       `${type}:${id}` — attach and release both need it
└── test/
    ├── unit/                    mirrors the source directories
    └── non-functional/          a submit that rejects, and one that never settles
```

**Why this differs from the tree in `resource-runtimes.md`.** That tree puts the
runtime class at `methods/runtime/runtime.svelte.ts`, which the linter refuses
twice: a method directory's entry must be `<name>.ts` exactly, and `attach`
importing a sibling method directory is a cross-owner import. Both dissolve
against the workbench's pattern rather than against the standard:

- **Only the `$state` factory needs `.svelte.ts`.** Runes compile nowhere else,
  so creating a reactive record is the one step that cannot be a plain function.
  It is a single factory method on the state class, `createRuntime(type, id)` —
  the role `WorkbenchState.nextId()` already plays. `Runtime` itself declares no
  rune and so needs no `.svelte.ts` at all.
- **`attach` imports no class**, only `ResourceRuntimesState` as `import type`,
  which erases. No module cycle, nothing to promote to `shared/`.
- **The definition is the only composer.** `Runtime.apply()` calls `apply` then
  schedules; `Runtime.undo()` calls `history` then `apply`. Every method stays a
  leaf, so the sibling-import rule holds by construction.

**Map reactivity.** A plain `Map` of `$state` records tracks field changes but
not insertion or deletion, so `open` and `flushing` would go stale as tabs come
and go. Use `SvelteMap` from `svelte/reactivity`, or a `$state` record keyed by
`RuntimeKey`.

**Three things the document leaves open, resolved here.**

- **`flushing` cannot be a projection of the map.** The document calls both
  fields projections, then says a released key stays in `flushing` until its
  submit settles — after the entry is deleted. Two maps: `open` and `settling`.
  `release` moves the entry across and the submit's settlement deletes it.
  Exactly-once still falls out of the data, because a second `release` finds
  nothing in `open`.
- **Coalescing must not touch history.** The buffer is what goes on the wire and
  folds; the undo stack keeps one entry per `apply` call, which is one user
  gesture. Folding two `set`s on one path keeps the **last** `value` and the
  **first** `was`, or undo of the folded op restores the wrong thing.
- **Rebase is small, and that is the point.** Because the runtime resolves no
  paths, "re-read, reapply, resubmit" is: wait for the subscription to deliver
  the new revision, resubmit the same ops against it. No transformation. A
  second refusal the ladder cannot resolve becomes `needs-review`.

**One signature departs from the document.** `createResourceRuntimes()` takes no
dependencies there; it now takes `configuration`, because that is where the
thresholds come from. Consistent with `createWorkbench(storage, runtimes)`.

**`BodyFor<T>` is the one genuine forward declaration.** The three body types
belong to `documents`, `slideDecks` and `spreadsheets`, none of which exist. The
runtime never reads a body, so `BodyFor<T>` resolves to `unknown` today behind a
comment naming the three capabilities that will supply it.

**What is commented out, and only this:** the `revisions.read` subscription in
`attach`, and the `revisions.submit` call in `flush`. Both written as the code we
expect to run, commented, with the surrounding state transitions live. Buffering,
coalescing, the flush schedule, inversion, the undo and redo stacks, the
register's idempotence, release-as-flush and both projections are real and
unit-tested.

**Change**

- `model/client/types.ts` — `ClientModel` gains `resourceRuntimes`, **and
  `close()`**, which the aggregate has never had
- `model/client/constructor.ts` — after configuration, before the workbench
- `model/client/index.ts`, `model/client/client.md`
- `+layout.svelte` — `$effect` cleanup calling `clientModel().close()`

## Landing 3a — `methods/shared/` requires one caller, not two

Independent of the rest, and small.

- [`scripts/lint/model/rules.mjs`](../../../app/scripts/lint/model/rules.mjs) —
  `found < 2` becomes `found < 1`; the message stops saying "invariants two
  methods share". A zero-caller promotion is still a failure, which is the check
  worth keeping: it catches dead code.
- `scripts/lint/model/test/build-fixtures.mjs` — the
  `method-ownership-lonely-shared` fixture drops to zero callers, and the header
  comment about "the two callers that justify it" changes
- `scripts/lint/model/test/lint.test.mjs` — "rejects a promoted method with one
  caller" becomes "with no callers", expecting `0 callers`
- [`model-directory.md`](../../../app/docs/model-directory/model-directory.md) —
  lines 215, 219 and the rule table at 302
- `docs/model-directory/reviewing-a-model-object.md` — if it restates the count

## Landing 4 — the workbench, deleted and rebuilt

`rm -r app/src/lib/model/client/workbench/` and write the object the document
describes. Fourteen methods rather than sixteen: `availableContexts` and
`activeContext` leave with the context vocabulary.

**Create** — the standard leaf shape, with `methods/` holding `open/` (with
`resolve-launcher.ts`), `close.ts`, `close-all.ts`, `activate.ts`, `reorder.ts`,
`reopen-closed.ts`, `update.ts`, `select-context.ts`, `inspected-node.ts`,
`inspect.ts`, `frame.ts`, `resize.ts`, `runtime-for.ts`, and `shared/` holding
`assign-state.ts`, `target-key.ts`, `adopt-target.ts`.

The pieces carrying the design's weight:

- `TabTarget` — singleton · resource · launcher. `targetKey()` returns
  `undefined` for a launcher, which is the whole of "never dedupes"
- `viewState` — one arm per screen kind, `frame` present from mint, and
  `PERSISTED_FIELDS` typed as
  `readonly (keyof Omit<ViewStateFor<K>, "kind" | "frame">)[]`
- `inspected?: InspectionKey` — a namespaced string, no payload, no ancestry
- `closed` — the reopen queue, capped at ten, holding whole tabs
- `isPermanent(tab)` — one exported predicate over `target.kind`, replacing the
  field at its four call sites
- `runtimeFor(id)` — the only route from a view to a runtime; the workbench calls
  `attach` on open and `release` on close

**Persistence is not in this landing.** `restore`, `persist` and `toPersisted`
are not written, and storage's workbench section is retired rather than
re-versioned — `PersistedWorkbench`, `PersistedTab`, `PersistedTabOptions`,
`PersistedPanels` and `ClientStorage.workbench`/`saveWorkbench` all come out. The
visible consequence: until persistence returns, a reload gives you a single
project-overview tab.

**Change** — `commands/methods/registry.ts` (`!active.permanent` becomes
`!isPermanent(active)`), the client aggregate and constructor, `client.md`, and
[`storage/types.ts`](../../../app/src/lib/model/client/storage/types.ts) plus its
tests for the retirement above.

## Landing 5 — the shell views

Wired incrementally, one surface at a time, against a workbench that already
works.

- **`views/context-panel/`** gains the vocabulary the model gave up:
  `CONTEXT_IDS`, `CONTEXTS_BY_SCREEN` (first entry is the kind's default), and a
  pure resolver in `procedures/` taking `(screenKind, storedId)` to a
  `ContextId` — which is where the drift fallback stays unit-testable without a
  render harness. The panel derives the screen kind from the active tab and hands
  it to the rail and the content.
- **`views/tab-bar/`** — targets rather than `ResourceRef`, launcher tabs, and
  `isPermanent` deciding the close affordance.
- **`views/workspace/`** — the screens registry, and eleven placeholder screen
  roots resolved from `target`.
- **`views/inspector/`** — routes on the prefix of an `InspectionKey`.

## Landing 6 — `Selector`, then `copilot`

**6a — `$shared` adopts the copilot document's union.** The two disagree in both
directions today; the copilot document wins.

- `$shared/types/resource-set-expression.ts` — add
  `{ kind: "part"; ref; scopePath; label }` and `{ kind: "web" }`; drop
  `{ kind: "set"; setId }`, since a saved set is reachable as an ordinary
  `resource`
- `normalize` — `part` and `web` are **exempt from absorption**, so `covers` and
  `keyOf` both need arms for them
- `$shared/test/unit/types/resource-set-expression.test.ts` — the exemption, and
  the removal of the `set` arm
- The copilot document contradicts itself at line 191 ("follows set references")
  after removing the arm at line 79; resolve in favour of line 79 and correct
  the document

**6b — the copilot object and the dock.** Reuse `normalize` rather than
rewriting it. `views/copilot-bar/` is renamed to `views/copilot-dock/`, with the
mode and persona fixtures replaced by model state.

---

## Verification

Node and pnpm are not on `PATH`:

```bash
export PATH="/nix/store/2gf37maq4k2nhidw22dxndccma074cak-nodejs-26.7.0/bin:/nix/store/ry314j51iqvrn8fs26vna9xy823c1swy-pnpm-11.20.0/bin:$PATH"
cd app
```

Per landing:

```bash
pnpm lint          # capability, model, view and style structure
pnpm typecheck     # svelte-check — needs src/convex/_generated/ to exist
pnpm test          # vitest, node environment
pnpm test:scripts  # the linters' and generators' own tests
```

`pnpm typecheck` does not run tests and `pnpm test` does not typecheck — both are
needed. Landing 3a is proved by `pnpm test:scripts`: its fixture pair is what
demonstrates the relaxed rule still rejects a zero-caller promotion.

Landings 1, 2 and 3a need no Convex deployment. From landing 4 onward, run the
app end to end:

```bash
pnpm dev:convex    # first, in its own terminal
pnpm dev           # :3000
```

Then, on `/app/<project>`: open several tabs of different kinds and confirm each
keeps its own rail position, inspection and panel geometry across switches; open
two launchers and confirm both persist as separate tabs; close a tab and reopen
it, and confirm view state comes back with it; confirm a singleton offers no
close affordance and that `tab.close` is greyed in the command bar while one is
active.

The runtime has no end-to-end path until `revisions` has its tables — which is
the point of the forward declaration, and the reason its proof is unit and
non-functional tests rather than a click-through.
