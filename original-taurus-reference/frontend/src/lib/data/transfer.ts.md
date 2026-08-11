# src/lib/data/transfer.ts — breakdown

Companion to [transfer.ts](transfer.ts). **Project-level** export: the whole workspace as one
`.taurus` package, plus the small blob-download helper that puts a file in the browser's
Downloads. Everything left in this file is real — it writes the project's actual identity,
tabs, and panel selections.

## Module doc

### What lives here, what moved, and what was deleted

```ts
import type { Project } from './projects';
import type { Workspace } from './workspace';
import { slug } from '$lib/utils';

/**
 * PROJECT-level export: the whole workspace as one package.
 *
 * What it writes is real — the project's identity plus its actual tabs and
 * panel selections, in Taurus's own `.taurus` container.
 *
 * Per-RESOURCE export does NOT live here. That is the per-kind table in
 * `features/shared/transfer.ts`, which the editor's Export menu, the resource
 * rows' Download menu, and the shell top bar all read, so the formats they
 * offer cannot drift apart.
 *
 * This file used to also carry `exportTab` / `TAB_FORMATS`, which wrote a
 * **placeholder file for every format** — choosing Markdown downloaded a real
 * `.md` whose entire content was a sentence saying export was not connected.
 * Both are deleted: a file that lands in Downloads looking like an export but
 * holding none of your content is worse than no button at all.
 */
```

The module doc draws the line this file now sits on. **Project** export is its whole job.
**Resource** export is not here at all — it lives in the per-kind transfer table at
`features/shared/transfer.ts`, which owns both the format list and the per-kind exporters, so
the editor bar and the resource rows cannot offer different sets. The shell top bar reads neither: its Export menu is fully mocked while that control is redesigned.

The deletion is the point of the rest of the comment. `TabFormat`, the `TAB_FORMATS` list, and
`exportTab` used to live here and gave the shell top bar a four-entry per-tab export menu
(`.taurus` / `.md` / `.txt` / `.json`) backed by a generic serializer that had no content to
serialize. Every branch produced a stub — the Markdown one wrote `# Title` and the sentence
"(Placeholder — content export isn't connected for this resource yet.)", the `.taurus` one a
container with a `null` content slot — and the browser saved it under a real extension. That
is a worse failure than a missing feature, because the file looks like a successful export
until you open it. All three are gone; a caller that wants a resource export now goes through
`exporterFor` in the per-kind table, and formats without a serializer say so in the menu
instead of producing a file.

`slug` is imported from the shared `$lib/utils` module — the private copy that once lived here
is gone.

## Download helper

### Blob download (exported)

```ts
export function downloadText(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
```

`downloadText` writes a `Blob` and triggers a browser download through a temporary anchor,
revoking the object URL immediately after the synthetic click. It is the one download
mechanic in the app: `exportProject` below uses it, and so does the document exporter behind
the per-kind table. Only the *mechanic* was ever real in the old placeholder path — that is
why it survives the deletion unchanged.

## Export project

### The Taurus package

```ts
/** Export the whole project as a Taurus package (its current frontend state). */
export function exportProject(project: Project, ws: Workspace): void {
  const pkg = {
    kind: 'taurus.project',
    version: 1,
    project: { id: project.id, name: project.name, icon: project.icon, visibility: project.visibility },
    tabs: ws.tabs,
    panels: { context: ws.context, inspector: ws.inspector }
  };
  downloadText(`${slug(project.name)}.taurus`, JSON.stringify(pkg, null, 2), 'application/json');
}
```

A project always exports as a single `.taurus` **package** — a JSON bundle of the project
metadata plus the current workspace (tabs + panel state), tagged with a `kind` and a `version`
so a future importer can recognize it. It writes real, meaningful frontend state.

**It is currently unwired.** The shell top bar was its only caller, and that whole menu is now
mocked pending a decision on what a project-level export should be — possibly a Share, possibly
an archive plus a package. The function is kept rather than deleted because it works and is the
obvious thing to re-attach once the shape is settled. Document *content* would join the package
when resource serialization is wired into it.
