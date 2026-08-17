# Resource runtimes

The client object that keeps documents, slide decks and spreadsheets in sync while
somebody edits them. Companion to
[the workbench model](workbench.md), which owns what is *open*
while this owns what is being *changed*.

## The two lines that matter

Everything below elaborates these.

```ts
runtime.body            // the whole current resource. Reactive. No call, no await.
runtime.apply(ops)      // hand over what the user just did. Returns nothing.
```

**Reading is a property, not a method.** There is nothing to call and nothing to
await. `body` is `$state`, so when the server accepts a change — yours or somebody
else's — it changes and Svelte re-renders whatever read it.

**Writing is one method.** The editor translates its own library's transaction into
`Op[]` and hands them over. The runtime buffers, coalesces, submits, and deals with
refusal.

`sync` is neither of those. It is a status for the 24px strip at the bottom of the
frame — "saved", "saving", "error". An editor never needs it, and it is separate
from `body` so that a save completing does not re-render a document.

## What the object is

One register holding one runtime per open resource.

```ts
type ResourceKey = `${GeneralResourceType}:${string}`;   // "document:k57ab…"

type BodyFor<T extends GeneralResourceType> =
  T extends "document" ? DocumentBody :
  T extends "slides" ? SlideDeckBody :
  SpreadsheetBody;

type ResourceRuntimesModel = {
  /** Every open resource, newest first. Lets a caller see the whole register. */
  readonly open: readonly ResourceKey[];
  /** Resources whose last submit has not settled. What the status bar reports. */
  readonly flushing: readonly ResourceKey[];

  attach<T extends GeneralResourceType>(type: T, id: string): ResourceRuntime<BodyFor<T>>;
  release(type: GeneralResourceType, id: string): void;
  releaseAll(): void;
};
```

| Field | Type | What it is |
| --- | --- | --- |
| `open` | `readonly ResourceKey[]` | Every resource with a live runtime |
| `flushing` | `readonly ResourceKey[]` | Those whose last submit has not settled |

Behind the surface it is a `Map<ResourceKey, ResourceRuntime<…>>` on the instance,
and both fields are projections of it. The map is private because a caller that
could reach into it could hold a runtime past its release.

| Method | Returns | Throws |
| --- | --- | --- |
| `attach(type, id)` | the runtime, opening one if needed | never |
| `release(type, id)` | — | never; a key with no runtime is a no-op |
| `releaseAll()` | — | never |

`attach` is idempotent. Already open and subscribed, here it is; not open,
subscribe and return it. The caller never has to know whether it is the first
viewer, which is what makes a second tab on one document free.

## What a runtime is

```ts
type ResourceRuntime<Body> = {
  // reading
  readonly body: Body | undefined;      // undefined only before the first read lands
  readonly revision: number;

  // status, for the status bar
  readonly sync: SyncState;
  readonly pending: number;             // ops buffered, not yet submitted

  // writing
  apply(ops: readonly Op[]): void;
  flush(): Promise<void>;

  // history
  undo(): void;
  redo(): void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
};

type SyncState =
  | "loading"       // attached; the first read has not arrived, so body is undefined
  | "saved"
  | "saving"
  | "rebasing"      // refused; re-reading and reapplying the buffer
  | "needs-review"  // refused in a way the user must resolve
  | "offline"
  | "error";
```

### `body` is the whole resource, not part of one

A `DocumentBody` is `{ page, styles, rows, header?, footer? }` — page setup and
styles included, so a change to margins or paper size arrives through exactly the
same channel as a change to a paragraph. There is no second call for layout.

The one thing not in it is the **title**, which lives on the `documents` metadata
row and is changed with `documents.rename`. That split is the storage design's:
metadata is what a tab, a breadcrumb and a search result render, and it is readable
without touching content.

Same for the other two: a `SlideDeckBody` carries the slides and the deck theme; a
`SpreadsheetBody` carries the sheets, their cells and their merges.

### One class, generic over the body

Buffering, flush thresholds, base-revision tracking and the refusal ladder are
identical across the three; only `Body` differs. The server proved the same claim
first — `changeSets` and `resourceSnapshots` are one table each, generic over
`resourceType`, and the code applying an op never inspects a body. Decks and
workbooks came along nearly free in pass 2 because of it.

## Three editors, three libraries, one runtime

The runtime knows none of them. That is what lets one class serve all three.

| Resource | Editor library | Lives in |
| --- | --- | --- |
| `document` | ProseMirror | `views/document/` |
| `slides` | Fabric — adapter unproven, and the largest schedule risk | `views/slides/` |
| `spreadsheet` | Univer, behind a vendor-neutral custom-element wrapper | `views/spreadsheet/` |

Each editor translates its library's transactions into `Op[]` on the way in and
renders `body` on the way out.

### The vocabulary is shared; the paths are not

`set`, `insert`, `remove`, `move` and `text` are the same five ops for all three.
What differs is what a path names:

```text
document      rows/#r1/blocks/#b2/atoms/#a3
slides        slides/#s1/elements/#e2/blocks/#b3/atoms/#a4
spreadsheet   cells/B7
```

A path is `/`-delimited: a `#id` segment resolves by search anywhere in the body, a
numeric segment indexes a list, anything else is a key. **The runtime never parses
one.** It buffers ops and ships them; the server walks the path against the body.
That is precisely why one runtime serves three shapes — it is carrying an envelope,
not reading the letter.

The spreadsheet line is the interesting one: `B7` is a key, not an id, because a
cell's identity *is* its address. That is the one place the model departs from
ids-everywhere, and it is the reason the conflict ladder has a keyed-collection
case at all.

## Construction

Both this and the workbench are singletons per client instance, built the same way
the model standard requires — three verbs, three callers.

```ts
// model/client/resource-runtimes/constructor.ts
export const createResourceRuntimes = (): ResourceRuntimesModel => …

// model/client/constructor.ts — pure composition, holds nothing
export const buildClientModel = (input: ClientModelInput): ClientModel => {
  const storage = createStorage(input);
  const resourceRuntimes = createResourceRuntimes();
  const workbench = createWorkbench(storage, resourceRuntimes);  // borrows both
  const copilot = createCopilot(workbench);
  const commands = createCommands(workbench, copilot);
  return { storage, resourceRuntimes, workbench, copilot, commands };
};

// model/client/index.ts — the one place that assigns the instance
initClientModel(input);        // called by /app/[project]/+layout.ts
clientModel();                 // the accessor every view uses
```

`createResourceRuntimes` takes no dependencies. It does not know about tabs, and it
does not need storage — nothing it holds survives a reload, by design, because an
unflushed buffer that outlived the browser would be an edit the user cannot see and
cannot cancel.

The order matters in one place: the workbench borrows the register, so the register
is built first. `ClientModel.close()` releases in reverse — workbench first, so
`closeAll` can hand tabs back before `releaseAll` disposes what is left.

## How it is used

A view never touches the register. It asks the workbench, which attached the
runtime when the tab opened.

```svelte
<script lang="ts">
  import { clientModel } from "$model/client";

  const { tab }: ScreenProps = $props();
  const { workbench } = clientModel();

  // ResourceRuntime<DocumentBody> — the workbench attached it on open.
  const runtime = workbench.runtimeFor(tab.id);

  // READ. `body` is reactive; this re-runs when the server accepts anything,
  // from this tab, another tab, or another person.
  $effect(() => {
    if (runtime?.body) view.setDocument(toProseMirror(runtime.body));
  });

  // WRITE. Translate the library's transaction, hand it over, forget about it.
  const onTransaction = (tr: Transaction) => runtime?.apply(toOps(tr));
</script>
```

That is the whole integration. No subscription to manage, no revision to track, no
retry to write — the runtime owns all three.

`runtimeFor` returns `undefined` for a tab that is not a resource, which is why the
optional chaining is there rather than a guard.

### Exactly one method is asynchronous

| Method | | Why |
| --- | --- | --- |
| `attach` | sync | Returns with `sync: "loading"` and an undefined body; the body arrives reactively. Awaiting would make opening a tab block on a round trip |
| `apply` | sync | It buffers. A keystroke must never await anything |
| `undo` · `redo` | sync | They append inverted ops to the same buffer |
| `release` · `releaseAll` | sync | Submits without awaiting. Closing is a synchronous gesture and the strip must not lag behind the click |
| `flush` | **async** | The one case a caller needs to know it landed: leaving the page, or a deliberate save |

The rule underneath: **nothing a user gesture triggers is awaited, and nothing
awaited is triggered by a user gesture.** A slow or failed write becomes visible in
the status bar rather than as a spinner on a click.

## The sequence

```text
EDITOR SUBVIEW              RESOURCE RUNTIME           CAPABILITY

workbench.runtimeFor(id) ─► already attached
                                  │  sync: "loading"
render(body) ◄────────────── body ◄──────────────────── revisions.read
                                  │  sync: "saved"      (live subscription)
user types
  └─ translate → Op[] ─────► apply(ops)
                                  │ buffer · coalesce · compress
                                  │ sync: "saving" at 50 ops / 2000ms
                                  └────────────────────► revisions.submit
                                  ┌◄──────────────────── accepted @ revision
                                  │                       or RevisionsError(step)
                                  ├─ refused → sync: "rebasing"
                                  │  re-read, reapply the buffer, resubmit
re-render ◄──── body updates ─────┘

WORKBENCH ──── close(tabId) ─────► release(type, id)
```

Thresholds are `revisions.yaml`'s — `flushAfterOps: 50`, `flushAfterMs: 2000` — and
nothing server-side batches, which is why they are this object's problem.

**No editor library type crosses into the runtime. No runtime type crosses into the
workbench.** Those two sentences are the architecture.

### Whole body rather than a differential

ProseMirror already diffs its document against a new one and touches only changed
nodes, so a differential optimises a step that is already incremental — and
computing it means this object reproducing the transform semantics the editor
already has. If profiling later disagrees, the interface does not change.

## Ownership

**Scoped to general resources.** `GENERAL_RESOURCE_TYPES` has three members,
`revisions.read` and `revisions.submit` take exactly those three, and `changeSets`
is generic over them. A fourth general resource would get a runtime automatically,
and nothing else has one because nothing else is edited this way.

**The workbench owns lifetime; the register owns runtimes.** The workbench calls
`attach` when a resource tab opens and `release` when it closes, because it is the
thing that knows when a tab begins and ends. A view calling `attach` itself would
tie runtime lifetime to a component's mount — the case this whole design exists to
prevent, since the work surface remounts on every tab switch.

**Why a peer rather than a field on the workbench.** A runtime cannot be a model
object of its own: the environment root builds one instance of each object at graph
time, and runtimes come and go with resources. So the map needs an owner either
way. The owner is not the workbench because the sync protocol is not what a tab is
— it is roughly the weight of the current workbench again, and folding it in means
`workbench.md` documenting two unrelated contracts. That is the workbench's own
stated test for splitting. Folding it in is legal and would work; the cost is
burying the most failure-prone machinery in the client inside an object named after
something else.

## Terminal behaviour

`release` submits what is buffered, drops the subscription, and deletes the map
entry. The key stays in `flushing` until the submit settles.

**Exactly-once falls out of the data.** Releasing deletes the entry, so a second
release finds nothing. There is no released-set to maintain, because the map is the
record — which is what let the workbench delete its own.

A rejected or never-settling submit leaves the key in `flushing` reporting
`sync: "error"`. Deliberate: a runtime that could not send the user's last edits is
work disappearing, and dropping it silently is the one outcome with no recovery.

## File architecture

The leaf shape the model standard requires. The runtime class lives under
`methods/` because the standard puts there everything an object *does*, including
modules that are not public methods — "a codec, a wire format, a parser is still
the execution behind the surface."

```text
model/client/resource-runtimes/
├── resource-runtimes.md          ownership, surface, dependencies, invariants
├── index.ts                      composition door
├── types.ts                      ResourceRuntimesModel · ResourceRuntime<Body>
│                                 SyncState · ResourceKey · BodyFor<T>
├── definition.svelte.ts          holds Map<ResourceKey, Runtime>; delegates
├── constructor.ts                createResourceRuntimes()
├── methods/
│   ├── methods.md
│   ├── attach.ts                 idempotent open-or-return
│   ├── release.ts                flush, unsubscribe, delete the entry
│   ├── release-all.ts
│   └── runtime/                  the class, and the protocol behind it
│       ├── runtime.md            the whole sync contract, in one document
│       ├── runtime.svelte.ts     one open resource: $state body/sync/pending
│       ├── apply.ts              buffer and schedule the next flush
│       ├── flush/
│       │   ├── flush.md
│       │   ├── flush.ts          submit the buffer as one change set
│       │   ├── coalesce.ts       fold the buffer before it goes
│       │   └── rebase.ts         on refusal: re-read, reapply, resubmit
│       └── history/
│           ├── history.ts        the undo and redo stacks
│           └── invert.ts         an undo is an ordinary change set
└── test/
    ├── unit/                     mirrors the source directories
    └── non-functional/           a submit that rejects, and one that never settles
```

`runtime.md` is where the sync contract is written down in one place — which is the
point of the split, and what was missing when this machinery had no model home.

## Invariants

- **One runtime per resource, never per tab.** Two views of one document share a
  buffer, which is the only way both can be correct.
- **A runtime exists only while a tab references it.** None outlives the last tab
  on its resource.
- **`body` is the single source of truth for what is rendered.** No method returns
  a body.
- **Unacknowledged writes never leave this object.** Not into view state, not into
  storage, not into a component.
- **Release submits.** Disposal is never a silent discard.
- **The runtime never parses an op path.** It carries ops; the server resolves them.

## Related

[workbench model](workbench.md) ·
[general resources](../storage/general-resources.md) ·
[change conflicts](../processes/change-conflicts.md) ·
[model directory](../../app/docs/model-directory/model-directory.md)
