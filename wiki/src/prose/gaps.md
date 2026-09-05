Everything below was found by reading the code against its own documents, or by what the extractor could not see. Nothing here is fixed by this wiki; the code wins, and the wiki says what the code does.

## Where documents and code disagree

- **`README.md` at the repository root** describes a `views/` tree, links `app/docs/*` standards (now under `docs/archive/app-docs/`), says `pnpm lint` runs "four linters" and that "nothing is connected yet". There are nine trees, 63 checks in nine groups, and the editors write through capabilities to the store.
- **[[file:app/src/lib/representation/store/store.md]]** says 35 tables and names `store.server.ts`. `tables.ts` declares 42; the store is opened by `model/server/store`.
- **[[file:app/src/lib/capabilities/slide-deck/slide-deck.md]]** says nothing here writes. `submitSlideDeckChanges` does.
- **[[file:app/src/lib/capabilities/workspace/workspace.md]]** is a placeholder; the capability has two procedures.
- **[[file:app/src/lib/surfaces/content/content.md]]** mentions `$lib/app-views/workspaces/`, which does not exist; the glob reads `categories/*/content`.
- **[[file:app/src/lib/model/client/workspace-state/workspace-state.md]]** says "Nothing here is persisted yet"; `restore`, `flush` and `methods/shared/submit.ts` persist the ledger through the workspace capability.
- **[[file:app/configuration/README.md]]** lists `representation.yaml` as "declared, not yet read"; [[file:app/src/lib/model/server/store/constructor.ts]] reads `representation.store.directory`. It also links a `rich-content/overview.md` that does not exist.
- **[[file:app/src/lib/styles/chromatic-themes/celestial/celestial.md]]** and **[[file:app/src/lib/styles/chromatic-themes/cyberpunk/cyberpunk.md]]** link `docs/design-preferences.md`, which is not in the repository.
- **[[file:app/src/test/keys-route.test.ts]]** carries a comment saying "65 of 91"; the vocabulary today is 13 content, 86 context and 109 inspector keys.
- **[[file:app/src/routes/demo/context/+page.svelte]]**, **[[file:app/src/routes/demo/inspector/+page.svelte]]** and **[[file:app/src/routes/demo/workspace/+page.svelte]]** glob `app-views/panels/**` and `app-views/workspaces/**`; neither directory exists, so the three routes render nothing.
- **`development-views/review`** has no route under `/demo`; it is reachable only through code.
- **`revisions.yaml`** declares `resources.rebaseWindow`, `consolidateAfter`, `historyDepth` and `checkpointEvery`; nothing under `src/` reads them, and change sets are written with `tier: "recent"` and never consolidated.
- **`semantic-overlay.yaml`** is read by nothing through the configuration object; the algorithm takes its configuration as an argument.
- **`general/function-builder`** is a general view with no key in the inspector vocabulary; the eight `general.*` keys have no files.

## What is not verified

- This wiki was not run against the application in a browser. Every claim about runtime behaviour is read from the code, not observed.
- The provider side of the semantic overlay — the Jina token field and the dense vectors — is outside `src/`; the alignment is verified against its unit tests, not against a live response.
- `pnpm build` was not run for the application as part of this wiki's verification; `pnpm lint` and `pnpm test` were.
- Which shadcn-svelte and bits-ui versions the vendored parts were generated from is not recorded in the tree; `components.json` names the target and `package.json` pins `bits-ui ^2.19.0`.

## What extraction does not see

- **Blurbs.** 443 of 971 files have no header comment, so their pages show role, imports, exports and tests but no description in the author's words.
- **Svelte component props.** The extractor records a `.svelte` file's imports and its export names but does not parse `$props()`, so a component's contract is read from its source on its page rather than tabulated.
- **`carousel-shelf`'s index** uses `export { Root, Item, … }` over default imports; the extractor reads that form now, but it is the one vocabulary index that does not use `export { default as X } from`.
- **Which procedure a step belongs to** is inferred from directories, and which test exercises which file from imports. A test that imports nothing from the file it means to cover is not counted as covering it.
- **Runtime values of tokens.** The design-system pages show declared values from the CSS and paint swatches with the live variables; they do not compute the resolved colour.

## Test gaps

The tests page derives coverage from imports. By tree, from the extraction: `surfaces` and `styles` have no test files; `components` has one (the tracer); `development-views` tests only `stack-builder`, `vocabulary`, `review` and `semantic-overlay` procedures; `runtime` tests the server root and the scope but not the client root; `capabilities/development` and `capabilities/store` have no tests of their own. Among model objects, `commands`, `tab-list` and `tab-views` have no tests. The full list, file by file, is on [[page:/tests#gaps|Tests]].
