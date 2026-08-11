# transfer.ts

The per-kind **file-transfer table**: which resource kinds can move through a file, and how —
and, beside it, the **export-format list** every download surface in the app offers. Created
in workstream D (catalog L4) to take document knowledge out of the shell's `ResourcesPanel`.

## The seam

`ResourcesPanel` is a *generic* shell surface — it renders any project's resource list — but it
used to import `exportDocumentMarkdown`/`importMarkdownFile` directly and filter on
`kind === 'document'`: exactly the "shell becomes a coupling point for all features" failure the
panel-system design warned about. Now the panel consumes this table and names no kind; adding
transfer support for a new kind (say, slides) is an entry here, not a shell edit.

Each entry can declare:

- **`import`** — the file-input `accept` pattern, the modal copy, the picker/busy labels, and a
  `run(file)` that resolves to the created resource (`{id, name, kind}`) so the panel can open
  its tab and toast.
- **`export`** — the modal copy and a `run(id, name)` that triggers the download itself.

The panel derives everything from the two accessors: `importers` (the static list of kinds that
can import) and `exporterFor(kind)`.

## Why a static table, not a contribution store

The panel-system design chose stage-published contribution stores (`surface.ts`) over central
registries — but that pattern assumes a live stage to publish the contribution. Import/export is
**project-level**: importing a Markdown file must work with no document tab open at all, so
there is no stage to ask. A static capability-of-the-kind table is the honest shape; it lives
beside `kinds.ts`, the other static per-kind table (icons/tones/labels).

## Today's single entry

`document`: import accepts `.md`/`.markdown` and runs Omega's two-step import
(`POST /files` then `POST /documents/import` via `$systems/documents/io`); export downloads the
raw Markdown from `GET /documents/:id/export`. Only Markdown round-trips — pdf/docx are
long-term deferred (`docs/roadmap/deferred-pdf-docx-import-export.md`).

## The shared export-format list

The second thing this module owns is the menu itself: `ExportFormat` and the `exportFormats`
array, the formats the UI offers for a document, in menu order.

```ts
export const exportFormats: ExportFormat[] = [
  { id: 'md', label: 'Markdown (.md)', name: 'Markdown', built: true },
  { id: 'docx', label: 'Word (.docx) — soon', name: 'Word', built: false },
  { id: 'pdf', label: 'PDF (.pdf) — soon', name: 'PDF', built: false },
  { id: 'tdoc', label: 'Taurus (.tdoc) — soon', name: 'Taurus document', built: false }
];
```

Only Markdown has a serializer today. Word and PDF are the deferred pair above, and `.tdoc` —
the native Taurus document — has no writer yet. The three unbuilt formats are still listed,
because the menu is where a user looks to learn what is *possible*; but each carries "soon"
inside its own `label`, so the state is legible before anyone clicks, and picking one calls
`unbuiltFormatMessage(format)` — "Word export isn’t built yet — Markdown is the only format
that works today." — instead of downloading something fake. That is what the extra fields are
for: `built` is the flag every caller branches on, and `name` is the short noun that reads
correctly in the sentence.

**One table, every download surface.** The editor's Export menu (`DocumentStage`), the
resource row's Download menu and the bulk Export dialog (`ResourceTable` / `ExportDialog`),
and the shell top bar's Export menu all map over this array, so the offered set cannot drift
between them. Each surface used to invent its own list — and two of them handed unbuilt
formats to a generic serializer that wrote a placeholder file, so choosing "Markdown" landed
a real `.md` in Downloads whose only content was a note saying export was not connected.

A format list belongs here rather than in `data/` for the same reason the kind table does: the
menu's honesty depends on knowing which kinds have an `ExportSpec`, and that is exactly what
`exporterFor` answers.
