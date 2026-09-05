## How a generator works

Every `pnpm new-*` command is a script under `app/scripts/generation/<tree>/`, built on two shared modules: [[file:app/scripts/generation/shared/plan.mjs]] and [[file:app/scripts/generation/shared/cli.mjs]]. A generator collects everything it intends to write into a plan first, then writes; a plan refuses to overwrite an existing file; and `--dry-run` prints the plan without touching the tree. What a generator writes is what the checks expect to find — [[file:app/scripts/test/generation.test.mjs]] runs every generator into a temporary copy of the package and lints the result.

The commands below are read from `app/package.json` and each script's own header, so the usage lines are the ones the script prints.

## The commands

One command per kind of unit the checks know about, and each writes exactly what its checks will read. `pnpm new-capability` writes the directory, an empty index and `types/` — no `api/`, because a capability with no procedure is a legal state. `pnpm new-procedure` writes the procedure directory, an entry already gated and validating, the declaration in the index, and a failing test. `pnpm new-model-object` writes the document, types, definition, constructor and index, then adds the field to the runtime's aggregate and the call to its builder after everything it depends on. `pnpm new-method` adds a method file, or promotes one to a directory when a step is named. `pnpm new-view` writes a leaf on one of a category's three surfaces and adds the key — a content view is reachable as soon as it exists, a context or inspector view needs its hand-written key. `pnpm new-surface` writes a document and a root component with the grid skeleton. `pnpm new-theme` reads the token list off the default theme so the new one declares exactly what the others declare. `pnpm new-token` declares one token in one domain. `pnpm new-domain`, `pnpm new-table`, `pnpm new-constant`, `pnpm new-component`, `pnpm new-vocabulary` and `pnpm new-concern-entry` do what their names say; each description below is the script's own.

## The rewriters

Three commands change existing files rather than adding new ones. `pnpm category-keys` ([[file:app/scripts/generation/representation/categories.mjs]]) regenerates [[file:app/src/lib/representation/data/behavior/workspace/categories.ts]] from the category tree, and `-- --check` fails when the file and the tree disagree — which is what [[check:key-vocabulary-matches-the-tree]] reads. `pnpm aliases` ([[file:app/scripts/generation/across/aliases.mjs]]) writes the alias block in `svelte.config.js` off the tree. `pnpm imports` ([[file:app/scripts/generation/across/imports.mjs]]) rewrites every import in `src/` to its canonical alias spelling, the most specific alias whose target contains the file.

`pnpm seed` ([[file:app/scripts/seed.mjs]]) is not a generator but belongs beside them: it copies the committed `seed/*.json` tables into the directory the store reads, refusing to overwrite without `--force`.

## What proves them

`pnpm test:scripts` runs `node --test` over `scripts/test/*.test.mjs` and `scripts/generation/*/test/*.test.mjs`. [[file:app/scripts/test/generation.test.mjs]] proves every generator's output passes the checks that govern where it wrote; [[file:app/scripts/test/lint.test.mjs]] proves every check fires against its mutation; [[file:app/scripts/generation/representation/test/categories.test.mjs]] proves the category vocabulary is the category tree. This suite is separate from `pnpm test`, which is Vitest over `src/`; see [[page:/tests|Tests]].
