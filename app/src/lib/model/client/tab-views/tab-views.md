# Tab Views

Lives at the object root as `tab-views.md`. It is the entry point: a reviewer
reads this, then follows the file tree into the document that answers their
question.

## Description

Tab views holds **what each open tab is looking at** — one `TabView` per tab id,
and nothing about which tabs exist or which one is active.

A `TabView` is six fields: the centre it is on, what that centre is about, the
rail position, the lens, what the lens is about, and the panel geometry. It is
exactly the stored shape from the `views` domain, spelled with `null` rather than
`undefined`, because these round-trip through JSON and an absent key and a null
are two spellings of one state.

**It decides nothing.** It does not know which rail a category offers, what a
landing has to clear, or what a new tab starts as. Every write is a field it was
told to write, and the policy behind them lives in
[workspace-state](../workspace-state/workspace-state.md), which is the only object that holds
one of these.

## Ownership Boundary

Tab views owns:

- One `TabView` per id, and the fact that reading an id it has never been given
  is an error rather than a default
- **Copy on write.** Every mutator replaces the entry rather than editing it

Consumers own:

- **Which ids exist.** That is [tab-list](../tab-list/tab-list.md); this object
  stores under whatever ids it is handed and forgets on request
- **Whether a write is allowed.** A rail this subscreen does not offer, a lens
  that names no file — both are refused one call earlier
- **What a landing means.** `land` writes five fields at once; deciding what
  those five are is `workspace-state`'s

## Why copy on write

`SvelteMap` tracks which keys are present and which have been read. It does not
track a field changing inside a value, so a view mutated in place would be a
render nobody gets. Replacing the entry is what makes a rail click repaint the
panel.

It also makes a view a snapshot the moment it is replaced, which is what an
operation log needs for the `was` half of every op it records.

## Lifetime

- **Instance:** one per client instance
- **Constructed by:** `buildClientModel`, immediately before `workspace-state`
- **Released by:** nothing — this object holds nothing releasable

**It is not a field on `ClientModel`**, for the same reason `tab-list` is not:
a view that could reach it through the graph could change what a tab is showing
without going through the coordinator.

## Public Methods

| Method | Shape | Effect | Description |
| ------ | ----- | ------ | ----------- |
| `of` | file | accessor | The view for an id. Throws for one it has never been given |
| `set` | definition | mutator | Store a whole view under an id |
| `forget` | definition | mutator | Drop one |
| `land` | definition | mutator | Write the five fields of a `Landing` together |
| `focusOn` | definition | mutator | What the centre is about, and nothing else |
| `selectContext` | definition | mutator | The rail position |
| `inspect` | definition | mutator | The lens and what it is about |
| `clear` | definition | mutator | The lens back to `"empty"`, and the selection with it |
| `resize` | definition | mutator | Merge a partial frame over the one held |

Every mutator but `set` and `forget` is one call to
[`methods/patch.ts`](methods/patch.ts) with a different slice, which is why they
read as one line each on the definition rather than as nine files.

## Exposed State

| Field | Type | Meaning |
| ----- | ---- | ------- |
| `ids` | `readonly TabId[]` | Every id with a view, in insertion order |

`ids` exists for a caller reconciling the two halves — nothing renders from it.
What a surface reads is a composed `Tab`, and composition is `workspace-state`'s.

## Construction

```ts
export const createTabViews = (): TabViewsModel => ...;
```

| Dependency | Ownership | Usage |
| ---------- | --------- | ----- |
| — | — | None. It borrows no object |

**`definition.ts`, not `definition.svelte.ts`.** `SvelteMap` is a class from
`svelte/reactivity` and needs no compilation, and the standard is that a
`.svelte.ts` declares a rune or it is paying for a transform it does not use.

## Terminal Behaviour

None. This object owns nothing releasable.

## Concurrency and SSR

- Every method is synchronous, so no two can interleave.
- **It touches no browser API** — no storage, no timers, no `window`.

## Invariants

- **Every id has a view, or reading it throws.** A tab with a record and no view
  is a half-built tab, and returning a default would hide the one caller that
  built it wrong.
- **A stored view is never mutated in place.** Every write replaces it.
- **Nothing is decided here.** A field written is a field a caller chose.

## File Tree

```text
tab-views/
├── tab-views.md
├── index.ts
├── types.ts
├── definition.ts
├── constructor.ts
└── methods/
    ├── methods.md
    ├── of.ts
    └── patch.ts
```
