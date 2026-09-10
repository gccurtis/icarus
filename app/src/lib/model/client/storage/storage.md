# Storage

> **Workspace persistence is not wired to this object yet.**
>
> Everything it persists is workbench state, and the workbench does not persist
> while its stored shape is unsettled — a target instead of a `ResourceRef`, an
> eleven-arm workspace state instead of an options blob. See
> [workspace-state.md](../workspace-state/workspace-state.md).
>
> The client runtime constructs it, but the workspace does not yet read or write
> its workbench value. Its wire contract nevertheless names only current
> represented identities and is validated as one indivisible document.

## Description

Storage holds this project's browser store and the format of what survives a
reload, so that a workbench can be rebuilt from where the user left it.

`localStorage`, not a cookie. A cookie would only have been needed to be readable
during server rendering, and `/app` is client-rendered.
`localStorage` has no 4KB limit, needs no server
load, and is read synchronously at construction, so the panels are their stored
width in the first paint rather than snapping to it afterwards.

## Ownership Boundary

Storage owns:

- the `localStorage` key for one project, and the only two calls that touch it;
- the wire format, and the decision that a malformed value is an absent one.

Consumers own:

- display policy such as a panel's minimum and maximum width. Storage owns the
  current wire vocabulary: category, category-specific identity, context, and
  the complete stored shape.

## Lifetime

- **Instance:** one per client instance, which is one browser tab on one project
- **Constructed by:** `buildClientModel`, first, because the workbench is built
  over it
- **Released by:** nothing — this object holds nothing releasable

## One key per project

Everything persisted is workbench state, and a workbench belongs to a project.
Two windows open on the same project share that key and the last write wins.
Sharing is correct — they are the same workbench — but neither observes the
other's writes, so a tab opened in one is absent from the other until a reload.
Known. A key per window is not the fix; it would make the two disagree about what
is open.

## The split

| File | Holds |
| --- | --- |
| `types.ts` | The contract and the wire shape, using current represented ids |
| `methods/serialize.ts` | `decode` / `encode`. Pure — no DOM, no `$app/*`, no runes |
| `definition.ts` | The document, and write coalescing |
| `constructor.ts` | The two `localStorage` calls, and the key |

`serialize.ts` is where every decision actually lives, and being pure is what
lets it be tested directly rather than through a fake DOM. It sits in `methods/`
because that is the execution behind this object's surface: `encode` is what
happens behind `saveWorkbench`, and `decode` is what happens behind construction.
The object root holds what storage *is* — its document, index, types, state, and
constructor — and everything it *does* lives one directory down. See
[`methods/methods.md`](methods/methods.md).

## Public Methods

| Method | Shape | Effect | Description |
| ------ | ----- | ------ | ----------- |
| `saveWorkbench` | definition | mutator | Replaces the workbench section and schedules one write |

It stays on the definition because it is two assignments and a call to the
scheduler, and the scheduler is instance state. Extracting it would move three
lines into a file and leave the state they guard behind.

## Exposed State

| Field | Type | Meaning |
| ----- | ---- | ------- |
| `workbench` | `readonly PersistedWorkbench \| undefined` | What was stored last time, already validated. Undefined when the store was absent, corrupt, or uses another version |

## Construction

```ts
export const createStorage = (initial: PersistedClient, sink: Sink): ClientStorage => ...;
export const createBrowserStorage = (project: string): ClientStorage => ...;
```

| Dependency | Ownership | Usage |
| ---------- | --------- | ----- |
| `initial` | BORROWED | The document to start from; a test hands one in directly |
| `sink` | BORROWED | Where a serialized document goes |
| `project` | BORROWED | Names the key, and nothing else |

`createBrowserStorage` is the pairing the root uses: this project's key, read
once, written through `localStorage`. `createStorage` is the same object over
anything else, which is what lets the format be tested without a DOM.

## Nothing here throws on bad input

Stored text may be absent, malformed, or outside the one current version. Those
cases deliberately mean the same thing: "start from defaults." A later save
writes a fresh complete current document.

A version mismatch **discards rather than migrates**. This is a cache of panel
widths and open tabs; being wrong costs one re-drag, and migration code for it
would outlive its usefulness.

`localStorage` itself throws rather than returning null when site data is
blocked, so both calls are wrapped. A panel width is not worth taking the
application down over.

## What is deliberately not stored

**Tab ids.** They are minted by a counter, so a stored id is meaningless on the
next boot — and a restored `tab-1` colliding with a freshly minted `tab-1` makes
lookups return the wrong tab. Tabs are stored as resource refs and replayed
through `open()`, which is the same path a click takes and already dedupes on
kind and id.

**`inspection` and `scrollTop`.** An inspection names block ids and character
offsets in a document that may have changed since. `TabOptions`' own comment
already says what dies with the tab; this is that line, enforced.

## What it validates, and what it does not

Storage admits one complete current document or discards it whole. Required
fields must be present, optional fields must be valid when present, tuples have
their exact current length, and objects may not carry unknown fields. It never
fills a missing value, drops an invalid member, or interprets another shape as
the current schema.

It does **not** clamp an otherwise valid width to a panel's minimum or maximum:
that is policy, it belongs to the component that enforces the drag, and putting
it here would put the same number in two places.

The tab discriminator is the current closed `Category` vocabulary, and each
category proves the identity it stores: editor and research tabs require the
matching canonical Store row namespace, analysis requires its canonical local
identifier, and singleton or project-level surfaces require their one literal
identity. A remembered context must be one current context belonging to that
same category. Unknown categories, mismatched ids, duplicate tab identities,
and an active identity absent from the tab list invalidate the whole document.

A malformed nested option invalidates the complete stored document. This cache
is cheap to discard, while silently constructing a shape no current writer
emitted would be an unrepresented interpretation.

## Terminal Behaviour

None. This object owns nothing releasable. Writes are coalesced with
`queueMicrotask` rather than a timer precisely so that nothing is ever left
pending at unload, and there is therefore nothing to close.

## Concurrency and SSR

- `saveWorkbench` is synchronous and indivisible. Repeated calls in one
  synchronous burst collapse into a single serialization, and the last one wins.
- The write itself happens in a microtask, so a caller cannot observe the store
  changing mid-call.
- `createBrowserStorage` reads `window.localStorage` during construction. That is
  safe only because `/app` exports `ssr = false` and the layout script never runs
  on the server. The first route to enable SSR moves this read behind a guard.

## Invariants

- The document always carries the current `STORAGE_VERSION`; a document read at
  any other version is discarded whole.
- What `decode` returns is always usable: every field it hands back has been
  checked, and any malformed current document was discarded whole.
- A write always serializes one complete current document.

## File Tree

```text
storage/
├── storage.md
├── index.ts
├── types.ts
├── definition.ts
├── constructor.ts
├── methods/
│   ├── methods.md
│   └── serialize.ts
└── test/
    └── unit/
        ├── constructor.test.ts
        ├── definition.test.ts
        └── serialize.test.ts
```
