# The View Directory

**Status:** Templates, generator, and lint are implemented.
**Document templates:** [`templates/`](templates/templates.md)
**Review checklist:** [`reviewing-a-view.md`](reviewing-a-view.md)

## What a view is

A view is a complex component: the stateful counterpart to the presentational
primitives.

- A **simple component** (`simple-components/`) is vendored shadcn, run as
  shipped. It knows only its props.
- A **unique component** (`unique-components/`) is authored here: a primitive
  carrying real engineering of its own. It still knows only its props.
- A **view** knows this application exists. It reads the client model, calls a
  capability browser door, or owns state coordinating the tree it renders.

Views are ordinary Svelte components. They take props, they nest, and a view may
render another view.

A view is not a route. Route structure and view structure are independent.

### When a child becomes a view

A child stays a plain component while it is presentational and prop-driven. It
becomes its own view when it:

- reads the client model or calls a capability browser door itself;
- owns state that coordinates its siblings;
- needs an `interactions/`, `effects/`, `shared/`, or `procedures/` directory.

## Location

```text
src/lib/views/<view>/
```

Every directory directly beneath `views/` is a view. Names are kebab-case. The
tree is flat: a nested view is a sibling, not a subdirectory of the view that
renders it.

## Layout

```text
views/<view>/
├── <view>.md
├── <view>.svelte
├── types.ts
├── components/
│   ├── components.md
│   ├── <simple-component>.svelte
│   └── <complex-component>/
│       ├── <complex-component>.svelte
│       └── components/
├── shared/
│   ├── shared.md
│   ├── types.ts
│   └── create-shared.svelte.ts
├── interactions/
│   ├── interactions.md
│   ├── <simple-interaction>.ts
│   └── <complex-interaction>/
│       └── <complex-interaction>.ts
├── effects/
│   ├── effects.md
│   ├── <simple-effect>.svelte.ts
│   └── <complex-effect>/
│       └── <complex-effect>.svelte.ts
├── procedures/
│   ├── procedures.md
│   ├── <simple-procedure>.ts
│   └── <complex-procedure>/
│       ├── <complex-procedure>.ts
│       └── <private-helper>.ts
├── docs/
└── test/
    ├── unit/
    ├── regression/
    └── non-functional/
```

Only `<view>.md` and `<view>.svelte` are required. A directory is absent when the
view has nothing for it — no placeholders, no `.gitkeep`.

`types.ts` holds the public contract: prop, event, and snippet types a parent
needs, plus the value types those name. Types used only inside the tree stay with
the code that uses them.

There is no `index.ts`.

### Names that appear nowhere under `views/`

`utils/`, `helpers/`, `common/`, `lib/`, `handlers/`, `containers/`, `stores/`,
`store.ts`, `state.svelte.ts`, `index.ts`, `definition.ts`, `constructor.ts`.

## Component tree

`<view>.svelte` is the public entry and composition root. A small child is one
file; a child owning a subtree is a directory with a matching entry:

```text
components/editor-toolbar/
├── editor-toolbar.svelte
└── components/
    ├── format-control.svelte
    └── insert-menu/
        └── insert-menu.svelte
```

Component nesting may repeat. Nested component directories carry no document;
`components/components.md` carries the complete tree.

Sub-components do not own `interactions/`, `effects/`, `shared/`, or
`procedures/`. Small local behavior stays in the component; extracted behavior
goes to the view root.

### Selecting a component by model key

A model object exposes stable keys, never Svelte components. The view rendering
key-selected content maps the key to a component in its own tree:

```text
views/workspace/
├── workspace.svelte              reads the key, renders the match
└── components/
    ├── project-overview/
    ├── document-editor/
    └── spreadsheet-editor/
```

There is no registry directory and no map file. `components/components.md`
records which keys the mapping covers. A mapped child that meets the promotion
test is a sibling view, imported through its root.

## Shared

`shared/` holds state or context used by more than one component in the same
mounted view. The root constructs it; it dies with that view instance.

- State stays in a component when only that component needs it.
- State belongs in `model/client/` when it must survive the view, coordinate
  multiple views, or be persisted.

`shared/` exports constructors or context accessors, never a module singleton.
The root calls one per mount.

## Interactions

An interaction begins with user intent: save, select, resize, reorder, retry.

The component translates the DOM event into application-shaped input. The
interaction coordinates model methods, capability doors, optimistic updates, and
recovery. DOM mechanics stay in the component.

A complete interaction is one file; a substantial one is a directory with a
matching entry. Nested interaction directories carry no document.

Interactions are named for intent — `save-document`, not `handle-click`.

## Effects

An effect runs because reactivity or the environment changed: subscriptions,
observers, external widgets, focus restoration, measurement, global listeners.

Every file under `effects/` is `.svelte.ts`. Nothing under `interactions/` or
`procedures/` is `.svelte.ts`, and nothing there declares a rune.

Effects state their trigger and cleanup owner. A substantial effect is a
directory with a matching entry. Nested effect directories carry no document.

## Procedures

`procedures/` holds general procedures that are neither interactions nor effects:
formatting and display projections, guards, stable key derivation, normalization,
immutable tree and selection transforms.

A procedure clear inside its only caller stays there. Once it needs its own file,
it belongs here. A complex procedure is one directory directly beneath
`procedures/`:

```text
procedures/reconcile-selection/
├── reconcile-selection.ts
├── map-ranges.ts
└── restore-caret.ts
```

Procedure directories do not recurse. A helper that becomes independently complex
becomes a sibling directory beneath `procedures/`.

Nested procedure directories carry no document.

## Styling

A view owns its appearance. Component-scoped `<style>` blocks and utility classes
live with the component that renders them. A view has no stylesheet directory.

Views reference public tokens only — `--token-*` — never a private stage
namespace. See
[the styles directory standard](../styles-directory/styles-directory.md).

A value moves into `styles/semantic-tokens/` only when unrelated rendered owners share the
decision.

`simple-components/` is consumed, never edited. A primitive that must behave
differently is wrapped by a component in this view; one that is reused across
views and carries engineering of its own becomes a `unique-components/` entry.

## Boundaries and imports

A view may import:

- client-model doors;
- capability browser doors;
- simple components and style tokens;
- another view's `<view>.svelte` and `types.ts`;
- its own files.

A view may not import server-model code, capability server doors, route-generated
state, or any other file inside another view.

### Alias

Views reach each other through one alias, `$views`:

```ts
import Workspace from "$views/workspace/workspace.svelte";
```

One alias for the tree, not one per view. It is declared in `svelte.config.js`
when the first view arrives.

No relative imports.

## Documentation and templates

Templates live in [`templates/`](templates/templates.md). A generated document
keeps every required heading; `None` is acceptable when a section does not apply.

A document belongs to the directory that owns a concern and carries the complete
tree beneath it. Nested directories get no document.

| Document | Created when | Required content |
| --- | --- | --- |
| `<view>.md` | Every view | Purpose, public contract, dependencies, links to present directory documents, rendered states, accessibility, layout, and view-wide invariants |
| `components/components.md` | `components/` is created | Complete recursive component tree; responsibility, inputs, outputs, focus behavior, layout, and accessibility contract for each meaningful subtree; the keys any model-key selection covers |
| `interactions/interactions.md` | `interactions/` is created | Complete interaction tree; trigger, input, ordered flow, model/capability calls, procedures called, visible result, optimistic behavior, and recovery |
| `effects/effects.md` | `effects/` is created | Complete effect tree; trigger, observed values, setup, external resource, writes, cleanup, remount behavior, and procedures called |
| `shared/shared.md` | `shared/` is created | Values and context exposed, constructor, consumers, instance lifetime, mutation rules, and why the state is not a client model |
| `procedures/procedures.md` | `procedures/` is created | Complete procedure tree; purpose, callers, input, output, ordered algorithm, private helpers, mutation status, edge cases, errors, and invariants |

Files in a view's optional `docs/` directory are supporting material and have no
structural template.

Accessibility and interaction contracts governing every rendered surface live in
[`docs/frontend-design/`](../frontend-design/).

## Generation

```text
scripts/generation/views/
├── new-view.mjs
├── new-view-part.mjs
├── shared.mjs
└── test/
    └── generation.test.mjs
```

```text
pnpm new-view -- <view>
pnpm new-view-part -- <view> <concern> <name> [--complex]
```

`<concern>` is `components`, `interactions`, `effects`, `procedures`, or
`shared`. `shared` takes no name.

A command writes the entry, creates the concern document from its template if
this is the first entry, and adds the entry to that document's generated
inventory. Only the block between the inventory markers is rewritten.

Extensions follow the concern and are not options: components are `.svelte`,
effects are `.svelte.ts`, interactions and procedures are `.ts`.

A command validates names and the owning view, refuses an existing target rather
than overwriting it, plans every write before making one, restores original bytes
if the result does not lint, and runs view lint against what it wrote.

## Lint

```text
scripts/lint/views/
├── lint.mjs
├── rules.mjs
└── test/
    ├── build-fixtures.mjs
    ├── contract.test.mjs
    └── lint.test.mjs
```

`pnpm lint:views` checks `src/lib/views/`; `pnpm lint` runs it with the
capability, model, and style checks. Diagnostics sort by path and rule:

```text
src/lib/views/workspace/utils/format.ts  restrict-root-entries: 'utils/' is not a
  view concern — a named procedure belongs in procedures/
```

Rules are named, not numbered. Each name leads with a verb.

| Rule | Enforcement |
| --- | --- |
| `require-view-shape` | Every child of `views/` is kebab-case with matching `<view>.md` and `<view>.svelte`; all names beneath are kebab-case |
| `restrict-root-entries` | A view root holds only its root files and the named concern directories; no banned name appears anywhere in the view |
| `match-entry-names` | Every complex component, interaction, effect, and procedure directory holds an entry named for it; procedure directories do not recurse |
| `require-effect-runes` | Every entry beneath `effects/` is `.svelte.ts`; nothing beneath `interactions/` or `procedures/` is, or declares a rune |
| `require-concern-document` | Present concern directories hold their inventory document; nested directories hold no Markdown |
| `resolve-documented-paths` | Paths named in an inventory resolve, and authored entries appear in their inventory |
| `restrict-imports` | No server code, route internals, relative imports, or any file in another view but its root and `types.ts` |
| `reject-shared-singleton` | `shared/` exports constructors or context accessors, not an instantiated module singleton |
| `confine-tests` | View-owned tests appear only in `unit/`, `regression/`, or `non-functional/` |

Each rule has one valid fixture and focused broken fixtures. Contract tests hold
the rules table in this document, `RULE_NAMES`, and the reported names to each
other.

## Tests owned by a view

- `unit/` covers procedures, shared state, and isolated interactions and effects.
- `regression/` contains one test per fixed defect.
- `non-functional/` covers focus, keyboard operation, large collections, cleanup,
  and render/update behavior.

The vitest configuration uses the `node` environment with no component-render
harness. Until one exists, a view's testable surface is its procedures, its
shared-state constructors, and interactions callable with a substituted model.

End-to-end paths across routes, views, capabilities, and persistence belong in
the application end-to-end suite.
