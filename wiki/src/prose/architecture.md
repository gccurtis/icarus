## The direction of dependency

The trees form a line, not a web. `representation` imports nothing from any other tree ([[check:representation-imports-nothing-else]]). `capabilities` reaches server model objects, the server runtime root and other capabilities' indexes ([[check:capability-imports]]). `model` objects are built by `runtime` and reached through their index ([[check:object-is-entered-at-its-index]], [[check:constructor-is-called-by-the-runtime]]). `components` import none of `$capabilities`, `$model`, `$runtime` or `$representation` ([[check:component-takes-only-props]]). `styles` is CSS that nothing but the root layout imports ([[check:one-stylesheet-entry]]). `surfaces` may reach model objects, capabilities and components but never a route's internals or server code ([[check:surface-imports]]). `app-views` reach capabilities, components and workspace state and nothing else ([[check:view-imports-no-surface]]). `development-views` may import anything, and nothing shipped imports them ([[check:nothing-imports-development]]).

Every cross-file import is spelled through an alias ([[check:no-relative-imports]]), which is what makes every one of those rules decidable from the import specifier alone.

## Two processes, one home per module

A module runs in the browser, in the Node process, or in either. [[check:module-has-one-home]] decides which from the filename first — `.server.ts`, `.remote.ts`, `.svelte` — and from the directory second, and [[check:client-server-separation]] then checks that what a module imports, transitively, can run where the module runs. `node:*` appears in no client or shared module ([[check:node-is-server-only]]). The extractor records each file's home using the same resolver ([[file:app/scripts/lint/shared/home.mjs]]), and the file pages show it as a chip.

## The one crossing

There is exactly one kind of client→server edge in the repository: a capability's `index.remote.ts` ([[check:one-crossing]]). The browser imports `submitDocumentChanges` from [[file:app/src/lib/capabilities/document/index.remote.ts]]; SvelteKit turns the `command(...)` wrapper into a fetch; the same name on the server is the procedure in [[file:app/src/lib/capabilities/document/api/submit-document-changes/submit-document-changes.ts]], which opens with `requireScope()` ([[check:no-procedure-acts-outside-a-scope]]) and validates its input before acting ([[check:procedure-validates-first]]). The scope comes from [[file:app/src/lib/runtime/server/scope.server.ts]]: the session is resolved once per request in [[file:app/src/hooks.server.ts]], and the project token is read from the page's own pathname, `/app/<token>`.

## Two composition roots

[[file:app/src/lib/runtime/server/start.server.ts]] builds configuration, then observability, then the store, and holds the one instance behind `serverModel()`; `hooks.server.ts`'s `init` calls `initServerModel()` once before the first request, and `sveltekit:shutdown` calls `closeServerModel()`. [[file:app/src/lib/runtime/client/start.ts]] builds settings, browser storage, the three resource runtimes, the tab list and tab views, workspace state and commands, in that order, and [[file:app/src/routes/app/[project]/+layout.svelte]] is the one caller of `initClientModel()` ([[check:one-caller-of-the-initializer]]). The order is not a convention: [[check:objects-are-built-in-order]] reads the builder and refuses a constructor called before something it is passed.

## Routes

`src/routes` is small on purpose. `/` renders on the server. `/app/[project]` turns off server rendering ([[file:app/src/routes/app/[project]/+layout.ts]]), publishes an allowlist of configuration keys ([[file:app/src/routes/app/[project]/+layout.server.ts]]) and builds the client model. `/demo/*` mounts the development views. `/health` is an endpoint.

## Aliases

The alias block in [[file:app/svelte.config.js]] is generated from the tree by `pnpm aliases` and is the spelling every import uses. `$lib` is SvelteKit's own.

## Third-party packages

What `app/package.json` depends on, read off the file. The editors are ProseMirror and Konva; the charts are layerchart over SVG; the vendored components are shadcn-svelte over bits-ui; logging is pino.
