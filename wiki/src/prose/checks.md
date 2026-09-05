## How a check works

A check is one file under `app/scripts/lint/<tree>/`, exporting `{ name, says, subjects?, run(tree) }` ([[file:app/scripts/lint/shared/check.mjs]]). `says` is the invariant in the author's words and is quoted on every page here exactly as written; `subjects` names the distinct reasons a check can fail, so a finding says which one broke. `run` is a function over a `Tree` ([[file:app/scripts/lint/shared/tree.mjs]]) rather than a script, which is what lets [[file:app/scripts/test/lint.test.mjs]] point every check at a deliberately broken copy of the package and prove it fires — one mutation per check, listed in [[file:app/scripts/test/mutations.mjs]]. A rule with a typo'd condition never fires, and a linter that never fires reports success forever.

`pnpm lint` ([[file:app/scripts/lint.mjs]]) runs the trees in a fixed order — capabilities, components, model, representation, runtime, styles, surfaces, views, across — and reports `63 checks · 63 clean · 0 findings` when nothing is wrong. `pnpm lint surfaces views` runs some trees; `pnpm lint surface-imports` runs one check wherever it lives. Adding a check is adding a file; there is no register.

The sections below are the trees in lint order. Each check page quotes `says`, lists its subjects, shows the mutation that proves it, and explains — in this wiki's words, not the linter's — what goes wrong when the check is allowed to fail.

## capabilities

### capability-holds-nothing

A server process answers many requests. A module-scope `let` or a `new Map()` built at import is shared by all of them, so the first request's leftovers become the second request's answer — a cache that returns another user's rows, or a counter that survives a deploy only on the instance that happened to be warm.

### capability-imports

Reaching into a server object's files rather than its index couples a procedure to the object's private layout; reaching a client model from the server pulls tab state into the process; naming another capability's step rather than its index makes a change to that step a change to two capabilities. Each subject is one of those, and each would pass the type checker.

### capability-layout

The four permitted entries are what makes a capability readable from its listing: index, types, constants, procedures. A fifth directory is somewhere a helper hides, and a capability without an index has no surface at all — nothing can call it, and nothing notices.

### capability-lists-its-procedures

An index that defines a value of its own is a procedure that bypasses the `api/` directory: it runs without an entry file, without the scope gate the next check reads for, and without a place a validator could sit.

### entry-matches-directory

A procedure directory whose entry is not named for it makes the entry point a guess. `submit-document-changes/submit-document-changes.ts` is where the linter, the index and a reader all look; anything else has to be found by opening every file.

### no-procedure-acts-outside-a-scope

A procedure that does not open with `requireScope()` acts on whatever project the payload names, for whoever sent it. The scope is the authorization — a `Scope` only exists because [[file:app/src/lib/runtime/server/scope.server.ts]] resolved one for a project the asking user holds a handle to — so skipping it is not a missing check but the absence of the only one.

### nothing-reaches-inside-a-capability

An import that names `capabilities/document/api/shared/leader` from a view is a browser bundle that now contains server code, and a coupling to a file the capability is free to rename. The index is the contract; everything below it is the capability's own.

### procedure-validates-first

An input acted on before it is checked is an input that has already reached the store by the time the check runs. `validateSubmitDocumentChanges(input)` is the second line of every entry so that nothing between the gate and the validator can touch a table.

### storage-through-a-model

`$representation/store` is the path algebra and the table declarations, not a store; a capability that imported it and opened the directory itself would hold a second set of files beside the one the server model holds, and the two would disagree the moment either wrote.

### tests-are-one-of-three-kinds

A test directly under `test/` or in a fourth kind cannot be selected by kind, so `pnpm test` runs it whether or not the run is meant to exercise non-functional cases. The three names are the whole taxonomy the suite understands.

## components

### component-takes-only-props

A component that reads `workspaceState()` cannot be rendered on a demo page, cannot be tested with made-up data, and decides for its caller what it shows. Props in and events out is what makes the vocabulary catalogue possible at all.

### vendor-is-unedited

A vendored part that imports an authored component is a shadcn file the next `shadcn-svelte add` will overwrite, taking the edit with it silently. Everything shadcn does to a part is done by the CLI, or not at all.

### vendor-keeps-its-own-spelling

The CLI writes relative imports and `$vendored-components/…`, which is what `components.json`'s `aliases.ui` says. A part respelled with a first-party alias is a part that diverges from the tool's output and stops being regenerable; the second subject keeps the check and the CLI agreeing about where the tree is.

### vocabulary-is-entered-at-index

A deep import into `panel/panel-row.svelte` freezes that file name; a vocabulary without an index has no public surface and has to be read file by file. The index is where a part is renamed once.

## model

### constructor-is-called-by-the-runtime

A second caller of `createWorkspaceState` is a second workspace: two ledgers, two active tabs, and a surface that reads one while a command writes the other. The runtime builds each object once and everything else asks for that one.

### method-entry-matches-directory

A method family like `methods/flush/` holds `flush.ts`; without it there is no way to tell which of `coalesce.ts`, `rebase.ts` and `flush.ts` is the method and which are its steps.

### method-tree-paths-resolve

The method documents draw call trees naming files. A path that no longer exists in one of them is documentation that will be argued from as though it were law — the failure mode every colocated document is meant to avoid.

### nothing-builds-at-module-load

A module that constructs at import time hands out a different instance to every importer that happens to load it first, and a mutable module-scope binding in a model directory is the runtime's one job done twice. Both subjects say the same thing from two sides.

### object-exposes-no-component

A model that names a Svelte component decides twice what a key renders as — once in the model and once in the view — and the two drift. Keys travel; components stay in view trees.

### object-is-entered-at-its-index

An import of `workspace-state/methods/open` from a surface bypasses the interface in `types.ts` and calls a step with the object's internal state as its first argument. The index is where an object promises what it does.

### object-layout

The four required files are the object's identity: index, types, definition, constructor. Anything else at the root is a method that escaped `methods/`. The third subject — a server object's index carries `.server` — is what makes a browser import of it fail at build rather than when the filesystem is first touched.

### runes-match-the-extension

`$state` in a `.ts` file is never compiled: the assignment happens, nothing reacts, and the bug is that a panel does not update. The reverse — a `.svelte.ts` with no rune — is a transform paid for and not used, and a file whose name promises reactivity it does not have.

### tests-are-one-of-three-kinds

The same rule as in capabilities: `unit`, `regression` and `non-functional` are the whole taxonomy, and a test elsewhere cannot be selected by kind.

## representation

### behavior-is-pure

Behaviour runs in the browser and on the server and must give the same answer in both. A `node:` import breaks the browser bundle; a rune makes a pure function depend on a component's lifetime; a clock or an environment read makes two calls disagree. The four subjects are those four ways of being impure.

### domain-graph-is-declared

[[file:app/configuration/representation.yaml]] declares which domains each domain may import. An undeclared import is a dependency nobody agreed to; a cycle is a type that cannot be understood without itself. The check reads the real imports and compares.

### representation-imports-nothing-else

A vocabulary that depended on a consumer would not be one: the moment `representation` imports `model`, every tree that speaks the vocabulary has imported the model too, and the layering collapses from the bottom.

### representation-layout

A file outside `data/types/`, `data/behavior/` or `store/` is one the other checks do not see — neither `types-emit-nothing` nor `behavior-is-pure` would run over it.

### store-opens-nothing

A handle opened under `store/` is a lifetime with no owner: nothing closes it on shutdown and nothing prevents a second one. Opening the directory is the server store object's job, once, at startup.

### types-emit-nothing

A type file that survives compilation is a runtime import from a tree that promised to be erased. Checked against compiled output because `export { X } from` of a type survives erasure invisibly in source.

## runtime

### accessor-refuses-twice

`clientModel()` on the server and `clientModel()` before the layout ran are different mistakes, and the error message is the diagnosis. The same for `serverModel()` mid-shutdown versus before `init`. An accessor that returned `undefined` would push the diagnosis to whatever dereferenced it.

### builder-is-not-exported

An exported `buildClientModel` is a second way to make a graph, and a test that used it would assert on something the application never holds. `initClientModel` returns what it built, so nothing needs the builder.

### framework-only-at-the-root

An object below the root that reads `$app/state` has taken its identity from the current route; it cannot be built for a second project, and it cannot be constructed in a test without a router.

### graph-matches-its-aggregate

A field named in `ClientModel` and never assigned is `undefined` at runtime under a type that says otherwise; a field returned and never declared is invisible to every consumer. Assigned twice is a field whose value depends on line order.

### objects-are-built-in-order

`createWorkspaceState` takes `tabList` and `tabViews`; constructed before them it would hold nothing. The check reads `const x = createX(a, b)` lines and refuses a use before a definition, a constructor called twice, or a cycle — which is why the construction order shown on the runtime page is trustworthy.

### one-caller-of-the-initializer

Two calls to `initClientModel` are two graphs, and every accessor returns the second; the surfaces mounted under the first read a model that no longer receives updates.

### one-holder-of-the-instance

A second module caching the instance is a second graph the moment either is rebuilt — a project switch, a test — and nothing tells them apart.

### runtime-layout

The runtime is a fixed list of files because anything added here holds state or composes objects, and either is a decision the rest of the checks assume was made deliberately.

## styles

### consumers-see-public-tokens-only

A component that names `--palette-blue-normal` has reached behind the boundary: the value it found is one theme's, and switching to cyberpunk leaves it blue. A literal colour is the same mistake without the variable. The second subject keeps vendored parts on shadcn's bridge vocabulary so no first-party alias ends up in a file the CLI regenerates.

### generated-css-is-inert

`generated.css` is the shadcn CLI's output and has to stay exactly where `components.json` says so the CLI can overwrite it. If it were imported, its theme block would fight `bridge.css`; if its header were gone, someone would edit it.

### literal-colours-in-themes-only

A hex value anywhere but `<theme>/<theme>.css` is a colour a theme switch cannot reach. Everything downstream names a variable; only the ramps hold values.

### one-stylesheet-entry

Two entry points is two cascade orders, and which wins depends on load order. `app.css` imports every authored stage file once, contiguously, default theme first, slots after every theme — and the root layout is the one importer.

### references-point-backward

Slots reading a token, or a token reading an integration, is a cycle in the cascade — a value defined in terms of something defined after it. Integrations reading a chromatic slot rather than a token is the boundary crossed from the other side.

### stage-owns-its-namespace

`--palette-*` and `--theme-*` are a theme's, `--chromatic-*` the slot table's, `--token-*` the semantic domains'. A token file declaring `--chromatic-x` is a slot no theme declared, resolving under one theme and not another.

### styles-layout

A stylesheet at the root beside `app.css` is one `one-stylesheet-entry` cannot place in a stage; a token domain turned into a directory is a domain the token loader would no longer find.

### themes-agree-with-each-other

A token present in celestial and missing in cyberpunk resolves to nothing under cyberpunk. Beyond the same-set rule: exactly one theme binds `:root` and it agrees with `app.html`; dark themes match Tailwind's dark variant; every colour role declares all seven slots as direct aliases; and the meaning roles — success green, danger red, attention amber, inactive grey — stay pinned, so red never stops meaning failed.

## surfaces

### concern-is-one-of-five

A `utils/` directory is a place a file goes when nobody decided what it is for. The five concerns are the whole taxonomy: components, effects, interactions, procedures, shared.

### documented-paths-resolve

A concern document naming a file that is gone is the same failure `method-tree-paths-resolve` prevents in the model: a document that has stopped being true and will be read anyway.

### effects-declare-runes

An effect written in a `.ts` file has a `$effect` that never runs. A rune in `procedures/` is a pure function that has stopped being one.

### nothing-imports-development

A shipped surface importing a demo component takes the demo's dependencies with it into the bundle and makes a review tool part of the product.

### shared-hands-out-no-instance

An instance exported from `shared/` outlives the mount that used it and is handed to the next one — two tabs of the same category share a store neither built.

### surface-imports

Server code in a surface is a filesystem import in the browser; a route's `$types` is a coupling to where the surface happens to be mounted; a file below another surface's root is a coupling to that surface's private layout.

### surface-shape

A surface whose root component is not named for it has an entry point that has to be guessed. `context/context.svelte` is where the frame, the linter and a reader all look.

### view-takes-ids-and-callbacks

Content that arrives as a prop is content two surfaces can disagree about — the inspector showing a title the content pane has since changed. A view takes an id and reads the one record.

## views

### key-vocabulary-matches-the-tree

A view file the vocabulary does not name is a view nothing can open: no rail entry, no `showContent`, no persisted tab can reach it. The vocabulary is generated from the tree by `pnpm category-keys`, and this check is what fails when the two are out of step.

### runtime-through-workspace-state

Two views attaching a runtime to the same document each hold an edit buffer, and the second's flush is refused as stale against the first's revision. `view.documentRuntime(id)` on workspace state is the one attachment.

### view-imports-no-other-category

A view importing another category's procedure makes a change to that category a change to two. If two categories need the same thing it lives under `general/`, or each holds a copy.

### view-imports-no-surface

A view importing another view shows it without the workspace knowing, so the record of what is open is wrong. A view importing the surface it is rendered in is a cycle. Beyond capabilities, components and workspace state a view needs nothing — the third subject is the whole allowlist.

## across

### client-server-separation

A client module that transitively reaches a `.server.ts` file puts `node:fs` and the configuration — including the development project token — into the browser bundle. A server module reaching client code carries one tab's state into a process shared by everyone.

### module-has-one-home

A module neither rule places — not a framework suffix, not a directory with a stated home — has no stated process, so `client-server-separation` cannot decide what it may import.

### names-are-kebab-case

`Panel.svelte` and `panel.svelte` resolve to the same file on a case-insensitive filesystem and to two files on a case-sensitive one. Checked per dot-separated segment so `definition.svelte.ts` passes.

### no-relative-imports

A relative import is one whose target cannot be read from the specifier; every other import check here decides from the specifier alone, so `../` is the one spelling they cannot judge. `pnpm imports` rewrites them.

### node-is-server-only

`node:*` in a client or shared module fails the browser build — or, worse, is polyfilled into something that behaves differently.

### one-crossing

A second kind of client→server edge is a second place to audit for scope and validation. With one — a capability's `index.remote.ts` — `no-procedure-acts-outside-a-scope` and `procedure-validates-first` cover every request the server can receive.

## The shared helpers

The helpers under `app/scripts/lint/shared/` are the vocabulary the checks are written in, and the extractor behind this wiki imports the same ones. `tree.mjs` loads the tree and resolves imports through the alias block; `trees.mjs` finds the units (capabilities, objects, vocabularies, surfaces, categories, domains, themes, integrations); `home.mjs` places a module in a process; `css.mjs` parses stylesheets; `styles.mjs` knows the stages, roles and slots; `keys.mjs` reads the view vocabulary; `docs.mjs` finds the paths a document names; `procedures.mjs`, `runtime.mjs`, `views.mjs`, `graph.mjs`, `module-load.mjs`, `render-worker.mjs` and `check.mjs` do what their names say.
