# The View Directory

**Status:** Working design. The ownership categories and dependency direction
are proposed; grouping, registry shape, and some recursive documentation rules
remain open. This is intentionally not yet a generator template.

A view is a user-meaningful rendered surface. It owns a root component, its
private component tree, view-local state, and the procedures that turn user
interaction and external change into visible behavior.

The goal is exposure and separation of concerns: opening one view directory
should reveal what renders, what a user can do, what happens reactively, and what
supporting transformations keep those paths small.

## Location and grouping

No mandatory group is chosen yet.

The smallest useful form is:

```text
src/lib/views/<view>/
```

The standard can also permit optional grouping paths later:

```text
src/lib/views/<group>/<view>/
```

If groups are permitted, a grouping directory holds only other directories. It
does not own code, registries, or a barrel. This keeps grouping organizational
rather than architectural and lets a view move without changing its internal
shape.

The first real resource, activity, and inspection views should decide whether a
single level remains legible. A taxonomy should not be invented from placeholder
components.

## Proposed view template

```text
views/[<group>/]<view>/
├── <view>.md                       ownership, component tree, behavior trees
├── index.ts                        public door
├── <view>.svelte                   root component
├── types.ts                        optional public props/events and local types
├── state/                          optional view-instance state shared by children
│   ├── state.md
│   ├── types.ts
│   └── create-state.svelte.ts
├── components/
│   ├── components.md               component tree and ownership rules
│   ├── <simple-component>.svelte
│   └── <complex-component>/
│       ├── <complex-component>.md
│       ├── <complex-component>.svelte
│       ├── components/             recursive child component tree
│       ├── interactions/           interactions owned by this component
│       ├── effects/                effects owned by this component
│       └── support/                private support owned by this component
├── interactions/
│   ├── interactions.md
│   ├── <simple-interaction>.ts
│   └── <complex-interaction>/
│       ├── <complex-interaction>.md
│       ├── <complex-interaction>.ts
│       ├── <supporting-procedure>.ts
│       └── <supporting-procedure>/
│           ├── <supporting-procedure>.ts
│           └── <leaf-procedure>.ts
├── effects/
│   ├── effects.md
│   ├── <simple-effect>.svelte.ts
│   └── <complex-effect>/
│       ├── <complex-effect>.md
│       ├── <complex-effect>.svelte.ts
│       └── <supporting-procedure>.ts
├── support/
│   ├── support.md
│   └── <shared-procedure>.ts
├── docs/                            material belonging to no one subtree
└── test/
    ├── unit/
    ├── regression/
    └── non-functional/
```

Only the root component, its document, and its door are necessarily present.
Every optional directory is absent until the view has behavior of that kind.

## Exposure levels

The tree has four exposure levels.

1. `index.ts` is the external surface. It exports the root component and any
   public prop/event types.
2. `<view>.svelte` is the composition surface. It assembles the view but does not
   contain every interaction and effect implementation.
3. `components/` contains private rendered subtrees.
4. `interactions/`, `effects/`, `state/`, and `support/` contain non-rendering
   implementation, visible by responsibility rather than hidden in large script
   blocks.

Code outside the view imports only `index.ts`. No internal component or
procedure becomes reusable merely because another view can spell its path.

## The component tree

The filesystem mirrors component ownership.

A component remains one `.svelte` file when its markup, local state, and handlers
are understandable together:

```text
components/breadcrumb.svelte
```

A component becomes a directory when it owns child components, several named
interactions or effects, a substantial local state contract, or documentation of
its own:

```text
components/editor-toolbar/
├── editor-toolbar.md
├── editor-toolbar.svelte
├── components/
│   ├── format-control.svelte
│   └── insert-menu/
│       ├── insert-menu.md
│       └── insert-menu.svelte
├── interactions/
│   └── apply-format.ts
└── effects/
    └── restore-focus.svelte.ts
```

The entry component is always named after its directory. This rule repeats at
every depth. A directory signals that the component is a meaningful subtree;
the matching file provides one obvious place to enter it.

The root view document carries the complete component tree. A complex component
document explains the boundary of that subtree rather than restating its markup.
Whether every complex component document is required by lint remains open, but
the current preference is yes: choosing a directory is choosing an exposed
boundary worth explaining.

## Interaction procedures

An interaction begins with an intentional user act:

- activating a command;
- submitting or cancelling a form;
- selecting, resizing, reordering, or dropping something;
- committing an edit;
- requesting retry, refresh, or undo.

Components translate DOM events into application-shaped arguments and invoke an
interaction procedure. The procedure owns orchestration: admission of the local
input, calls to client model methods or capability browser doors, optimistic
state, recovery, and the result the component renders.

Event mechanics stay in the component. An interaction procedure should not need
to understand `MouseEvent`, element geometry, pointer capture, or a keyboard
code unless that mechanic is itself the behavior being modeled.

### Simple and complex interactions

A complete interaction is one file:

```text
interactions/toggle-inspector.ts
```

An interaction becomes a directory when it has supporting procedures or a
substantial contract:

```text
interactions/save-document/
├── save-document.md
├── save-document.ts
├── validate-draft.ts
├── build-command.ts
└── reconcile-result/
    ├── reconcile-result.ts
    └── restore-selection.ts
```

The entry file is named after the directory. Supporting procedures used only by
this interaction remain nested here. Nesting repeats when a supporting procedure
has a tree of its own.

Interactions are named for user intent—`saveDocument`, `applyStyle`,
`openResource`—rather than DOM events such as `handleClick`.

## Effect procedures

An effect begins because the environment or reactive graph changed, not because
a user invoked a command directly:

- subscribing and unsubscribing;
- synchronizing a title, cookie, or external imperative widget;
- restoring focus after rendered state changes;
- refreshing a remote query when an observed identity changes;
- measuring an element after layout;
- attaching and cleaning up observers or global listeners.

Effects live separately because their trigger and cleanup semantics are
different from interactions. Mixing them makes a component script impossible to
audit: a reader cannot tell what runs on user intent, what runs during rendering,
and what owns external cleanup.

An effect entry uses `.svelte.ts` when it contains Svelte runes. It must expose
its cleanup ownership explicitly. A complex effect becomes a directory by the
same recursive entry rule as an interaction.

Effect procedures do not become a second hidden state system. Durable or
cross-view state belongs to a client model object; an effect only synchronizes
that state with a rendered or external concern.

## Support procedures

`support/` holds pure or side-effect-free-enough procedures used across two or
more component, interaction, or effect owners inside the view:

- display projections and formatting;
- view-specific guards;
- stable key derivation;
- normalization of presentation-only values;
- immutable tree transforms used by multiple view paths.

A procedure used by one interaction or effect stays nested under that owner. A
procedure used by one component stays beside or beneath that component. It moves
to root `support/` only when a second owner needs it and the view can state the
invariant it preserves.

`support/` is not a `utils/` directory. A file with no named owner or invariant
has not yet earned promotion.

Support with its own complex subtree may use the same directory-plus-entry rule.
Whether root support needs one directory per complex procedure or remains flat
until examples demand it is still open.

## View-local state

Most presentation state stays in the smallest component that owns it. Examples
are an open disclosure, an input draft before commit, hover state, and a local
validation message.

`state/` is reserved for state that several components in one mounted view must
share. It is constructed with the view instance and dies when that view is
destroyed.

State does not belong here when it:

- must survive replacement of the root view;
- coordinates two different views or shell zones;
- is persisted as a user preference or workbench snapshot;
- owns a subscription or resource whose lifetime is independent of the view.

Those cases belong to `model/client/`.

View-local state is not exported through `index.ts`. Child access should use
props, snippets, or a context owned by the root view rather than a module
singleton.

## Model and capability boundaries

A view may consume:

- `model/client` doors;
- capability browser doors;
- simple component doors;
- style roles and tokens;
- its own internal tree.

A view may not consume:

- `model/server`;
- capability server doors or internal procedures;
- another view's internals;
- route-generated `$types` or route state.

Routes hand data and parameters into view props. A view does not discover which
URL mounted it.

Long-lived synchronization may be delegated to a client model object. A
one-interaction capability call may remain in the view interaction that owns it.
The deciding question is lifetime, not a blanket rule that all remote calls sit
on one side.

## Registries

Registries mapping stable model keys to Svelte components belong to the view
layer. Examples include:

- resource kind to work-surface view;
- activity key to context-panel view and icon;
- inspection kind to inspector view.

The client model owns the active key and validates that it is meaningful. The
registry owns component resolution. This preserves the dependency direction:
model objects never import the components that render them.

The exact registry location remains open. Current candidates are:

```text
views/registries/
```

or a registry beside the shell zone that consumes it. The decision should also
consider dynamic imports so adding many inspector views does not eagerly place
all of them in the application shell's client chunk.

## Documentation

`<view>.md` should include:

- purpose and user-visible boundary;
- public props, events, and snippets;
- capability and client-model dependencies;
- component tree with real paths;
- interaction tree;
- effect tree and cleanup ownership;
- view-local state and why it is not model state;
- loading, empty, failure, stale, and permission states;
- focus, keyboard, and accessibility behavior;
- responsive and overflow behavior;
- invariants spanning the rendered tree.

`components.md`, `interactions.md`, `effects.md`, `state.md`, and `support.md`
explain their directory's shared rules and list its entries. A complex
interaction, effect, or component document owns the detailed tree beneath that
entry.

## Tests

- `unit/` covers support procedures, state, and isolated interaction/effect
  behavior.
- `regression/` holds one file per fixed visual or behavioral defect.
- `non-functional/` covers focus order, keyboard operation, large collections,
  effect cleanup, and render/update behavior.
- Full user paths across routes, views, remote functions, and persistence belong
  in the eventual end-to-end suite rather than being simulated inside every
  view directory.

The component tree should be tested through behavior and accessible output, not
through assertions that private component names exist.

## Likely lint rules

Once the design is exercised by real views, lint can reasonably enforce:

1. A view has `<view>.md`, `index.ts`, and `<view>.svelte`.
2. Only named optional directories appear at the view root.
3. A complex component directory contains a matching `.svelte` entry.
4. A complex interaction/effect/support directory contains a matching entry.
5. Paths named in component, interaction, and effect trees resolve.
6. Imports from outside a view target its door only.
7. Views cannot import server doors or route internals.
8. Test files sit under the view's `test/`.

Judgment remains necessary for whether a component or procedure deserved a
directory, whether support has a genuine shared invariant, and whether state was
classified at the correct lifetime.

## Decisions still open

1. Whether `views/` stays flat or permits optional grouping directories.
2. Whether registries live at `views/registries/` or beside their shell owners.
3. Whether registries load view components eagerly or through typed dynamic
   imports.
4. Whether every complex component requires its own document.
5. Whether `state/` standardizes one factory/context shape or remains owned by
   each view.
6. Whether effects containing no runes use `.ts` while rune effects use
   `.svelte.ts`, or all effect entries use the latter for a uniform shape.
7. Whether a procedure shared by several views is promoted to a simple component,
   a client model object, or a future explicitly owned presentation library.
8. Which first real views should serve as the reference implementations before a
   generator and linter freeze the template.
