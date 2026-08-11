# Markdown import and export (BR-IMPORT / BR-EXPORT)

With a file store in place (record 0065-adjacent 0065? see 0065-doc-scoped; file
store landed just before this), documents can be created from an uploaded
Markdown file and serialized back to Markdown.

## Document-level Markdown: `core/capability/document/markdown_document.go`

- **`ExportMarkdown(base)`** serializes a document to Markdown — each
  text-bearing block on one line under its kind's prefix (`#`..`######`
  headings, `>` quote, plain paragraph), blocks separated by a blank line.
  Non-text blocks (prompt, image) are skipped. Inline styling reuses
  `RenderBlockMarkdown`, so bold/italic/code/strike/links round-trip.
- **`parseMarkdownRows(md, newID)`** parses Markdown into rows — one block per
  row. Blocks split on blank lines; the first line's prefix chooses the kind;
  inline runs are parsed by `ParseBlockMarkdown`.
- Service methods **`Documents.ExportMarkdown(projectID, id)`** (resolves +
  serializes, project-scoped) and **`Documents.ImportMarkdown(projectID, name,
  markdown, actor)`** (parses + runs the normal create path, so ids, validation,
  and Activity behave as for any created document).

## Handlers: `core/handlers/document/importexport.go`

- **`Export`** streams the document as `text/markdown` via the new
  `endpoint.Response.Raw`. `?format=` defaults to markdown; anything else is a
  400 (pdf/docx are follow-ups).
- **`ImportHandlers.Import`** reads an uploaded file (via the file service) and
  creates a document from its Markdown; it bridges the file and document
  capabilities. The document name defaults to the file name with its `.md`
  extension dropped.

## Routes

- `GET /documents/:documentID/export?format=markdown` (sync).
- `POST /documents/import { fileId, name? }` (registered when the file store is
  present; edit access).

## Image blocks

The document image block's `ImageData.FileID` now resolves to a real uploaded
file — the file store provides the ids that block referenced. No document change
was needed; the capability that was missing is the one this phase and its
predecessor added.

## Tests

- **Unit** (`markdown_document_test.go`): import structure (heading/paragraph/
  quote kinds + bold/italic marks on the paragraph), deterministic export, and an
  import→export round-trip that preserves headings and bold inline.
- **Integration** (`dev-test/import-export/run.sh`, no model, always runs): upload
  a Markdown file → import (kinds `heading_1,paragraph,heading_2,quote`, bold
  mark, extension-stripped name) → export reproduces the headings, quote, and
  bold; an unsupported format is a 400.
