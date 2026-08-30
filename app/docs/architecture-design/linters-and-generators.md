# Linters and Generators for the Icarus Tree

*Icarus · src/lib · the state to build toward*

One check per invariant, named for the invariant it holds. Nothing here describes what exists — it describes what should, and where today's tree already breaks it.

## The tree

```text
capabilities/
├── capabilities.md
├── cast.ts
├── read.svelte.ts
└── <capability>/ ×14            has structure
components/
├── authored/
│   └── <vocabulary>/ ×8         has structure
├── vendor/
│   └── <component>/ ×43         has structure
└── development/
model/                           has structure
├── model.md
├── client/<object>/ ×7
└── server/<object>/ ×2
representation/
├── representation.md
├── data/
│   ├── types/<domain>/ ×11      has structure
│   └── behavior/<domain>/       has structure
└── store/                       has structure
runtime/                         has structure
├── runtime.md
├── client/
└── server/
styles/
├── app.css
├── chromatic-themes/
│   └── <theme>/ ×2              has structure
├── semantic-tokens/             has structure
└── x-integrations/
    └── <target>/ ×2             has structure
views/                           has structure
├── panels/                      has structure
│   ├── context/<subject>/
│   └── inspector/<subject>/
├── workspaces/<screen>/ ×9      has structure
├── modals/
├── development/<surface>/ ×7
└── <surface>/ ×8
```

## The tree

## capabilities

`capabilities/<capability>/`

### What it is

**A capability bridges the client and the server model.** One directory per subject. It is the only thing that exists on both sides of the process boundary, which is what makes one directory the whole audit.

The boundary is the index. What is on the right of it is a server model object, never storage — a capability holds nothing between calls, so it has nothing to open a file with.

**view · client model** (client) → **index.remote.ts** (the index) → **api/<procedure>** (server · validates first) → **model/server/<object>** (server)

### Invariants

- **A caller reaches a capability at its index and nowhere else.** If a panel can import a procedure, the index stops being the surface.
- **Input is checked before anything happens.** A procedure's first statement validates; a type is a claim, not a check.
- **Stored state is reached through a server model object.** A procedure asks the server graph for the object that owns the lifetime; it opens nothing itself.
- **It holds nothing between calls.** Two requests share a process; anything one leaves behind is the next one's bug.
- **It never reaches a view, a client model, or another capability's insides.**
- **The directory is the call tree.** A procedure with supporting steps is a directory holding them.
- **What it declares and what it does are separate.** `types/` is erased, `constants/` is the vocabulary the capability is made of, and `api/` is everything that runs.

### Layout it asserts

```text
<capability>/
├── <capability>.md
├── index.remote.ts              the index — remote functions only
├── errors.ts                    optional
├── types/<name>.ts              declares — erased
├── constants/<name>.ts          declares values — survives erasure
├── api/
│   ├── shared/<step>.ts         optional
│   └── <procedure>/
│       ├── <procedure>.ts       entry, named for its directory
│       └── <step>/<step>.ts     recursive
└── test/{unit,regression,non-functional}/
```

### Checks

**capability-is-entered-at-its-index** — No import from outside a capability names anything below its `index.ts`.

**capability-lists-its-procedures** — `index.ts` names what a capability offers. It imports each procedure, declares it, and names the types it speaks in. Nothing is defined here.

**procedure-validates-first** — Every `api/<procedure>` entry validates its argument before its first other statement.

**storage-through-a-model** — Nothing under `capabilities/` imports `$representation/store`. The object that owns the lifetime is the only way in.

**capability-imports**

- `server-object-index` — a server model object is named at its index, never a path inside it.
- `runtime-entry` — the server graph is reached through `start.server`.
- `no-client` — nothing here imports a view or a client model. 2 fail `opening` and `inspecting` take types from `view-state`.
- `no-sideways` — another capability is named at its index, never a path inside it.

**capability-holds-nothing**

- `no-module-state` — no mutable module-scope binding.
- `no-construction-at-load` — nothing is built when the module is imported.

**entry-matches-directory** — Every directory under `api/` holds a file of the same name, at every depth. Without it a procedure's entry point is a guess.

**capability-layout** — A capability holds its index, its types, its constants, and its procedures.

- `has-an-index` — a capability with no index has no surface.
- `permitted-entries` — nothing else sits at the root.

**tests-are-one-of-three-kinds** — Nothing under `test/` outside `unit/`, `regression/`, `non-functional/`.

### Generators

**new-capability** — The directory, an empty index, and `types/`. No `api/` — a capability with no procedure is a legal state.

**new-constant** — A file under `constants/`. Nothing is added to the index — an index exports remote functions only, so a constant a caller outside the capability needs is served by a procedure.

**new-procedure** — The procedure directory, the entry with its validator already calling it, the declaration added to the index, and a failing test.

## components

`components/authored/<vocabulary>/ · components/vendor/<component>/`

### What it is

Two vocabularies with opposite ownership. **authored** is ours and is checked for what it must not do. **vendor** is written by the shadcn CLI and is checked for evidence that someone edited it by hand.

Both hold the same claim: **a component knows only its props.** Give it the same props twice and it renders the same thing twice, wherever it is mounted from.

### Invariants

- **A component takes only props.** Not a capability, not a model object, not the runtime, not representation.
- **A vocabulary is entered at its index.** Its internal file names are its own business.
- **A vendored file is the CLI's output.** Its shape and its import spelling come from the tool, and the next regeneration overwrites anything else.

### Layout it asserts

```text
authored/<vocabulary>/
├── index.ts                     the whole export surface
├── <vocabulary>-<name>.svelte
└── <vocabulary>-<name>.ts       pure; optional

vendor/<component>/
├── index.ts
└── …                            whatever the CLI writes
```

### Checks

**component-takes-only-props** — No file under `components/` imports `$capabilities`, `$model`, `$runtime` or `$representation`.

**vocabulary-is-entered-at-index**

- `index-exists` — every vocabulary directory holds an `index.ts`.
- `no-deep-import` — no import from outside a vocabulary names a path below its index.

**file-is-named-for-its-directory** — Every file under `authored/` is kebab-case and prefixed by the directory it sits in.

**vendor-is-unedited** — No file under `vendored/` imports `$authored-components` or any first-party tree. The closest a check gets to "nobody touched it" without diffing the registry.

**vendor-keeps-its-own-spelling**

- `import-spelling` — imports inside `vendor/` are `$lib/components/vendor/…`, which is what the CLI writes.
- `matches-components-json` — that path is `aliases.ui`, so the CLI and the check cannot disagree about where the tree is.

### Generators

**new-component** — The `.svelte` file under a named vocabulary, and its export added to `index.ts`.

**new-vocabulary** — The directory and an empty `index.ts`.

**— for vendor** — None. `shadcn-svelte add` is the generator; a second one would be a second opinion about a tree we do not own.

## model

`model/{client,server}/<object>/`

### What it is

One directory per thing that owns state surviving a call. Definitional: it says what an object is and how it behaves, and never decides when one comes into existence. That decision is the runtime's.

**The split is by lifetime, not by tidiness.** The two halves take the same template and differ in how many of each thing exists and for how long.

Same template, two lifetimes. A client object may be reactive and reach the browser; a server object may do neither, and must not be reachable from a browser bundle at all.

**one browser tab** (7 objects) → **may hold runes** (definition.svelte.ts) → **released with the layout** (reverse construction order)

**one process** (2 objects) → **nothing per-user** (identity arrives per request) → **released on shutdown** (one-way)

### Invariants

- **Nothing constructs at module load.** A constructor returns a fresh object and caches nothing, so importing a module never produces a second instance of something the graph already holds one of.
- **An object is entered at its index.** Past it is a definition, a private type, or a method — none of which the object promised to keep stable.
- **The directory is the call tree.** A method is a file until it has supporting steps; then it is a directory named for its entry, holding them, recursively.
- **Runes are declared in the file extension.** A definition holding state the compiler must transform says so in its name.
- **An object exposes keys, never components.** What a key renders as is the view's decision, and a model that named a component would decide it twice.

### Layout it asserts

```text
<object>/
├── <object>.md
├── index.ts | index.server.ts    the index
├── types.ts                      interface and public values
├── definition.ts | .svelte.ts    holds the state
├── constructor.ts                returns a fresh object
├── methods/
│   ├── <method>.ts
│   ├── <method>/<method>.ts      recursive
│   └── shared/<step>.ts          optional
└── test/{unit,regression,non-functional}/
```

### Checks

**nothing-builds-at-module-load**

- `no-construction` — no constructor call runs when a module is imported.
- `no-module-state` — no mutable module-scope binding anywhere under `model/`. Holding an instance is the runtime's job.

**object-is-entered-at-its-index** — An import from outside an object names its `index`, never a path below it.

**constructor-is-called-by-the-runtime** — Nothing outside `runtime/` and the object's own files imports a `constructor.ts`. A second caller is a second instance of something meant to be one.

**method-entry-matches-directory** — Every method directory holds a file of the same name, at every depth.

**runes-match-the-extension**

- `runes-need-svelte-ts` — a file declaring a rune is `.svelte.ts`, or the rune is never compiled.
- `svelte-ts-needs-runes` — a `.svelte.ts` file declares one, or it is paying for a transform it does not use.

**object-exposes-no-component**

- `no-component-type` — no model type names or imports a Svelte `Component`.
- `no-svelte-file` — no model file is a `.svelte`.

**object-layout**

- `required-files` — the index, types, definition and constructor all exist.
- `permitted-root-entries` — nothing else sits at the object root; what an object does lives under `methods/`.
- `index-matches-environment` — a server object's index carries `.server`, so a browser import of it fails at build rather than at runtime.

**method-tree-paths-resolve** — Where a method document draws a call tree, every path in it exists.

**tests-are-one-of-three-kinds** — Nothing under `test/` outside the three named directories.

### Generators

**new-model-object** — Document, types, definition, constructor and index. Adds the field to the runtime's aggregate and the call to its builder, in dependency order. Refuses a cycle.

**new-method** — A method file, or a directory with its entry when the method already has steps.

## representation

`representation/data/{types,behavior}/<domain>/ · representation/store/`

### What it is

Everything the system knows, in one vocabulary belonging to neither process. Split by what a file *is*, not what it is about: **types** compiles to nothing, **behavior** is pure functions over it, and **store** says what a table is on disk without opening one.

Every arrow points one way, and the chain stops here. Nothing in this tree imports any other tree, and opening one of these tables is a lifetime — which is somebody else's.

**data/types** (declares · erased) → **data/behavior** (pure functions) → **store** (tables, reads, writes)

### Invariants

- **A file declares or computes, never both.** A mixed file is where importing a type quietly pulls a runtime value into a bundle that should not have one.
- **Nothing here runs.** No filesystem, no environment, no framework, no clock — which is what makes every file safe for either process to take.
- **The domain graph is declared and acyclic.**
- **The store describes; it does not hold.** Opening a file is a lifetime, and lifetimes are the runtime's.

### Layout it asserts

```text
data/
├── types/<domain>/<name>.ts      no runtime export
└── behavior/<domain>/<name>.ts   pure

store/
├── tables.ts                     table declarations
├── store.server.ts               what a read and a write are
└── admission.ts                  a name is not yet a path
```

### Checks

**types-emit-nothing** — A file under `types/` produces no runtime export — **checked against compiled output**, because a re-export that survives erasure is invisible in source.

**behavior-is-pure**

- `no-framework` — no Svelte, no SvelteKit, no rune.
- `no-node` — no `node:*`, so the file is loadable in a browser.
- `no-server-module` — nothing whose name marks it as the server's.
- `no-ambient-state` — no clock, no environment, no global read.

**representation-imports-nothing-else** — No file in this tree imports any other tree. A vocabulary that depended on a consumer would not be one.

**domain-graph-is-declared**

- `declaration-matches-imports` — a domain imports exactly the domains it declares it may.
- `no-cycle` — the real graph is acyclic.

**store-opens-nothing** — No file under `store/` touches the filesystem or holds a handle.

**representation-layout** — Every file is under `data/types/`, `data/behavior/` or `store/`. There is no fourth place, so no file can be ambiguous about which rules apply to it.

### Generators

**new-domain** — A directory under `types/` with its import declaration and one file. The matching `behavior/` directory only when asked — most domains never have one.

**new-table** — A table declaration, its name in `TABLE_NAMES`, and its row type. Three edits that must agree, which is what a generator is for.

## runtime

`runtime/{client,server}/`

### What it is

The only tree that executes. One file per environment, read top to bottom: compose the graph, hold it, hand it out, and on the server, close it.

The one caller is the `/app` layout on the client and the `init` hook on the server. Everything else calls the accessor.

**build<Env>Model** (not exported · holds nothing) → **init<Env>Model** (one caller · assigns the instance) → **<env>Model()** (guards, then returns) → **close<Env>Model** (server only · one-way)

### Invariants

- **There is one published way to stand up a graph.** A second one produces two graphs over one storage key, and neither is wrong on its own.
- **One place holds the instance.**
- **The graph is assembled in dependency order**, every object constructed once, every aggregate field assigned once, no cycle.
- **The accessor refuses rather than returns nothing.** Before build and after shutdown, in different words — they are different mistakes.
- **The two halves never meet.** A browser bundle that reached the server graph would ship the filesystem with it.

### Layout it asserts

```text
client/                          server/
├── client.md                    ├── server.md
├── start.ts                     ├── start.server.ts
├── types.ts                     ├── types.ts
└── test/                        ├── scope.server.ts
                                 └── test/
```

### Checks

**builder-is-not-exported** — No `build<Env>Model` leaves its module. The initializer returns what it built, so nothing needs a second way in.

**one-holder-of-the-instance**

- `state-only-in-start` — a mutable module-scope binding appears in `start*`.
- `no-state-elsewhere` — and nowhere else in the repository.

**one-caller-of-the-initializer** — Exactly one module calls `init<Env>Model`, and it is the layout or the hook. Two callers is two graphs, one of which is unreachable.

**graph-matches-its-aggregate**

- `declared-is-built` — every field `types.ts` names is returned by the builder.
- `built-is-declared` — and nothing else is.
- `assigned-once` — no field is written twice.

**objects-are-built-in-order**

- `after-dependencies` — an object is constructed after everything it is passed.
- `constructed-once` — each object constructor is called exactly once.
- `no-cycle` — the dependency graph is acyclic.

**accessor-refuses-twice**

- `client-guards-browser` — reaching a tab's graph from the server is a category error, and says so.
- `client-guards-absence` — reaching it before the layout ran is a question of order, and says that instead.
- `server-guards-shutdown` — a request arriving mid-drain hears "shutting down", not "not built".
- `server-guards-absence` — and one arriving before `init` hears the opposite.

**framework-only-at-the-root** — Only `start*` imports `$app/*`. An object taking its identity from ambient routing is one that cannot be built twice.

**runtime-layout** — Only the named files exist. Something new here is a decision, not an addition.

### Generators

**— none** — Twelve files that change when the graph changes. `new-model-object` edits them, which is where that work belongs.

## styles

`styles/chromatic-themes/<theme>/ · semantic-tokens/ · x-integrations/<target>/`

### What it is

Four stages, each naming values from the one behind it and never reaching forward. A consumer sees the last stage only.

Only the third stage is public. A component naming anything to the left of it has reached behind the boundary, and the value it found changes when a theme does.

**chromatic-themes** (--palette-* --theme-*) → **slots** (--chromatic-*) → **semantic-tokens** (--token-* · public) → **x-integrations** (tailwind · shadcn)

### Invariants

- **A literal colour exists in exactly one place** — a theme file. Anywhere else it is a value a theme switch cannot reach.
- **A stage declares its own namespace and no other.**
- **References point backward.** A stage reads the stage behind it, never ahead, and never past the public boundary.
- **One entry.** Two entry points is two cascade orders, and which one wins depends on load order.
- **Generated CSS is inert.**

### Checks

**literal-colours-in-themes-only** — A colour is written in `<theme>/<theme>.css` and named everywhere else.

**stage-owns-its-namespace** — Themes declare `--palette-*` and `--theme-*`, slots `--chromatic-*`, tokens `--token-*`, integrations none of them.

**references-point-backward**

- `stage-reads-behind-it` — a theme reads its own palette, slots read theme values, tokens read theme or chromatic values. Never forward.
- `integration-reads-public-only` — an integration names public tokens and nothing behind them.

**one-stylesheet-entry**

- `single-entry` — the root layout imports `app.css` once, and nothing else imports a stylesheet.
- `every-file-reachable` — every authored stage file is imported by `app.css` exactly once, so nothing is silently absent.
- `import-order` — imports are contiguous and in stage order, default theme first, slots after every theme.

**consumers-see-public-tokens-only**

- `authored-consumer` — no private stage variable, no internal stylesheet import, no literal colour.
- `registry-consumer` — a vendored component uses shadcn's bridge vocabulary, so a first-party alias never reaches it.

**themes-agree-with-each-other**

- `same-token-set` — every theme declares the same tokens, and exactly one binds `:root`.
- `registration-matches` — the default agrees with `app.html`, and dark themes match Tailwind's `dark` variant.
- `complete-role-families` — every colour role declares all seven slots, each a direct alias whose slot matches.
- `meaning-hues-pinned` — meaning roles hold their fixed hues, and no role spans two chromatic families.

**generated-css-is-inert** — The shadcn output is the exact `components.json` target, carries its quarantine header, and is imported by nothing.

**styles-layout** — Only `app.css` and the three stage directories at the root; token domains stay files rather than becoming directories.

### Generators

**new-theme** — A chromatic theme with every declared token present, and its registration in `app.css` and `app.html`.

**new-token** — A semantic token across every theme at once, so a token that exists in one and not another is unreachable rather than possible.

## views

`views/ — shared by every surface`

### What it is

Everything a person looks at. Four kinds — a stack, the centre of a screen, chrome that persists across every screen, and a surface for inspecting the other three — and one contract all of them keep.

### Invariants

- **A layout is a named grid.** `grid-template-areas` with regions named for what they hold, so what appears where survives a reorder of the markup.
- **Data comes from a capability, never a prop.** A prop carries a callback, or an id its parent alone knows. Content arriving as a prop is content two surfaces can disagree about.
- **A concern declares what it is by extension.** Everything under `effects/` holds runes; nothing under `procedures/` or `interactions/` does.
- **Shared state dies with the mount.** A module singleton would outlive the surface and be handed to the next one.
- **No surface reaches inside another.** Its root and its types, or nothing.
- **Nothing imports a development surface.** It may import anything; the trade only holds in one direction.

### Layout it asserts

```text
views/
├── panels/                       own structure — below
├── workspaces/                   own structure — below
├── modals/<modal>.svelte
├── development/<surface>/
└── <surface>/
    ├── <surface>.md
    ├── <surface>.svelte
    ├── types.ts
    ├── components/ effects/ interactions/ procedures/ shared/
    └── test/{unit,regression,non-functional}/
```

### Checks

**surface-is-a-named-grid** — Every surface lays itself out with `grid-template-areas` and named regions. 15 fail 7 shell surfaces, 6 development surfaces, 2 workspaces.

**view-takes-ids-and-callbacks** — A prop is a callback or an id, never the thing being displayed. Content arriving as a prop is content two surfaces can disagree about.

**concern-is-one-of-five**

- `permitted-root-entries` — a surface root holds its document, its component, its types, and the five concerns.
- `banned-names` — no `utils/`, `helpers/`, `stores/`, `index.ts`: names that hide what a file is for.

**effects-declare-runes**

- `effects-are-svelte-ts` — everything under `effects/` is compiled, or its runes never run.
- `others-declare-no-rune` — nothing under `procedures/` or `interactions/` holds one.

**shared-hands-out-no-instance** — `shared/` constructs nothing at module load and exports nothing already made. An instance here outlives the mount and is handed to the next one, so two tabs share it.

**surface-imports**

- `no-server-code` — nothing marked as the server's reaches a rendered surface.
- `no-route-internals` — no generated route type or route-local module.
- `no-reaching-inside` — another surface is named at its root or its types, never below.

**surface-shape** — A surface directory holds a root component named for it, so the entry point is never a guess.

**nothing-imports-development** — Nothing outside `development/` imports a development surface. It may import anything; the trade only holds in one direction.

**documented-paths-resolve** — Where a concern document names a path, that path exists.

### Generators

**new-surface** — Document and root component, with the grid skeleton in place. Takes which tree it is for.

**new-concern-entry** — One entry under a named concern, with the extension that concern requires.

## views · panels

`views/panels/{context,inspector}/<subject>/`

### What it is

A vertical stack, one file per key. **`context/` and `inspector/` are the same shape** and take the same checks — both are flat `<subject>/<key>.svelte`, no nested directories and no other file kind, across all 199 leaves. What separates them is which stack they appear in, and nothing in the tree.

### Invariants

- **It renders alone.** No client instance, no route, no parent threading content down. This is the claim the tree is built on, and the thing that lets 199 leaves be reviewed one at a time.
- **Its path is its key.** The key vocabulary is generated from these paths, so a key naming no file cannot compile.
- **It holds no concerns.** 199 leaves have never needed one.

### Layout it asserts

```text
panels/{context,inspector}/<subject>/<key>.svelte
```

### Checks

**panel-renders-alone** — Every leaf server-renders with an empty prop bag. The 213-leaf test, promoted from a test to a check.

**panel-holds-no-concerns** — A subject directory holds `.svelte` files and nothing else.

**panel-imports-no-other-view**

- `no-other-panel` — a panel shows another panel by key, so view state stays the one record of what is open.
- `no-surface` — a panel is rendered inside a surface; reaching back out to one is a cycle.
- `no-other-tree` — capabilities, components, view state and modals; a panel needs nothing else.

**key-vocabulary-matches-the-tree**

- `every-file-has-a-key` — a leaf the vocabulary does not name is unreachable.
- `every-key-has-a-file` — a key naming no leaf renders nothing at all.

### Generators

**new-panel** — The leaf at the path its key names. Runs the key generator after.

**view-state-keys** — The key unions, read off these paths. `--check` in CI, writer on demand.

## views · workspaces

`views/workspaces/<screen>/`

### What it is

The centre of one screen. One file per screen-and-subscreen the key vocabulary declares — which is what makes it a different contract from a panel rather than a larger one.

### Invariants

- **One exists for every screen the vocabulary declares**, at the path it names. The filesystem is the registry; a map beside it would be a second list of what exists.
- **It reaches a resource runtime through view state**, never by attaching one itself — two attachments to one resource is two edit buffers.
- **It renders alone**, like a panel.

### Layout it asserts

```text
workspaces/<screen>/workspace.svelte              one centre
workspaces/<screen>/workspace-<subscreen>.svelte one per state
```

### Checks

**workspace-exists-for-every-screen**

- `declared-resolves` — every screen-and-subscreen the vocabulary names resolves to a file, or that screen renders blank.
- `file-is-declared` — every file resolves to a declared screen, or it is unreachable.

**workspace-renders-alone** — Server-renders with an empty prop bag, like a panel.

**runtime-through-view-state** — No workspace attaches a resource runtime itself.

### Generators

**new-workspace** — The file, its key, and a `grid-template-areas` skeleton carrying the specification's region names.

## Across every tree

### Invariants

- **A module belongs to one process and says which by where it sits.** Client, server, or both. A both-module imports only both-modules.
- **One name for one target.** Each tree is reached through one alias, and the alias map has one copy — a second copy is a second answer to where a file is.

### Checks

**module-has-one-home**

- `by-filename` — a framework suffix decides first, because the toolchain already enforces it.
- `by-tree` — otherwise the directory decides.
- `unresolved-is-a-failure` — a module neither rule reaches has no stated home, and every other check here assumes it has one.

**client-server-separation**

- `client-takes-no-server-code` — or the browser bundle carries the filesystem and the secrets.
- `server-takes-no-client-code` — or the process carries state belonging to one tab.
- `shared-takes-only-shared-code` — a module either process may load can only load what either process may load.

**node-is-server-only** — `node:*` appears in no client or both module.

**one-crossing** — The only client→server edge in the repository is a capability index. One crossing can be audited; five cannot.

**no-relative-imports** — Every cross-file import is spelled through an alias — which is what makes every import check above decidable from the specifier alone.

**names-are-kebab-case** — Checked per dot-separated segment. Case is the one naming difference that resolves on one filesystem and fails on another.

### Generators

**aliases** — The alias block in `svelte.config.js`, read off the tree. `--check` in CI, writer on demand — so a second map cannot exist.

---

*Icarus · src/lib · 7 trees · main at c437341*
