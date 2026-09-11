## What this is

Icarus is a workspace: one browser tab holds a project, and inside it a row of tabs opens documents, presentations, spreadsheets, analyses, research threads, agents and templates. The application is a SvelteKit app under `app/`. Everything definitional lives under `app/src/lib`, sorted into nine trees, and a tiny `routes/` mounts them.

This wiki is about the code as it is. Every file under `app/src` has a page here, every one of the 63 lint checks is quoted in its own words, and every table, token, capability and view key is read off the tree by [[file:wiki/extract/extract.mjs|an extractor]] rather than typed in. Where a sentence could not be checked against the code it says so.

The trees are listed below in dependency order: the first depends on nothing, and each later one may reach the ones before it but never the ones after.

## The nine trees

Nine directories under `app/src/lib`. The order is the direction of dependency, and the lint checks under [[page:/checks|Lint checks]] are what keep it that way.

## Reading order

If you have an hour, open these in this order.

1. [[file:app/src/lib/representation/representation.md]] and then [[file:app/src/lib/representation/data/types/core/id.ts]], [[file:app/src/lib/representation/data/types/documents/body.ts]] and [[file:app/src/lib/representation/store/tables.ts]] — the vocabulary everything else speaks.
2. [[file:app/src/lib/runtime/client/start.ts]] and [[file:app/src/lib/runtime/server/start.server.ts]] — the two places an object graph is built. Both fit on one screen.
3. [[file:app/src/lib/model/client/workspace-state/types.ts]] — what a tab is, what a frame is, what the workspace can be asked to do.
4. [[file:app/src/lib/surfaces/app/app.svelte]] — the frame every view is rendered inside.
5. [[file:app/src/lib/app-views/categories/document-editor/content/document.svelte]] — one editor, end to end, with [[page:/algorithms/document-editor|its explanation]] beside you.
6. [[file:app/src/lib/capabilities/document/index.remote.ts]] and [[file:app/src/lib/capabilities/document/api/submit-document-changes/submit-document-changes.ts]] — the one way the browser reaches the server.
7. [[file:app/src/lib/styles/app.css]] — the cascade, in the order it is applied.
8. [[file:app/scripts/lint.mjs]] and any one file under `app/scripts/lint/` — the law, and how it is read.

## How this wiki is built

`wiki/extract/extract.mjs` loads the tree with the repository's own lint loader ([[file:app/scripts/lint/shared/tree.mjs]]), so it resolves imports the way the checks do. It writes nine JSON files under `wiki/src/data/`: every file with its tree, kind, role, home, imports and exports; every unit the lint helpers can find; the view vocabulary; the whole token system; the 63 checks with their `says` text; the generators; the test files and what they import; the configuration files. `wiki/src/` renders that in React. Prose is authored by hand and lives under `wiki/src/prose/`; every path, check, token and symbol it names is written as a marker that [[file:wiki/extract/check.mjs]] resolves against the extraction, so a renamed file fails the wiki's own check before it misleads anyone.
