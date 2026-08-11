---
title: "Import - DOCX to Document"
notion_page_id: "3acb6410e50281038192e08fc89b605a"
notion_url: "https://app.notion.com/3acb6410e50281038192e08fc89b605a"
project: "Taurus Yesod"
role: "Primary"
format: "Spec"
created: "2026-07-29 05:49:08Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Import - DOCX to Document

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Reviewed decision · Import only · Research refreshed: 2026-07-29.** Use a file-based TypeScript worker to turn one hostile `.docx` into a versioned, parser-neutral JSON draft plus bounded assets and diagnostics. Go remains the sole authority that decodes, validates, assigns canonical IDs, creates the Document base, records provenance, and commits. Import is intentionally lossy and never promises round-trip fidelity.
# Executive decision
Use [`mammoth`](https://www.npmjs.com/package/mammoth)[ 1.12.0](https://www.npmjs.com/package/mammoth), pinned exactly, in the existing isolated TypeScript Office worker. Mammoth is BSD-2-Clause and deliberately converts Word documents to simple semantic HTML rather than attempting to reproduce every Word formatting detail. That bias matches the Taurus import contract: headings should become headings, lists should become lists, images should become image blocks, and unsupported Word behavior should disappear rather than leak into the canonical model.
Parse Mammoth's HTML fragment with [`parse5`](https://github.com/inikulin/parse5) and translate an allowlisted AST directly into a Taurus-owned `DocumentImportDraft`. Never render or persist Mammoth's HTML. Mammoth explicitly states that it does not sanitize its output, so the importer must reject dangerous URLs, disable external-file access and embedded style maps, isolate parsing, and enforce ZIP, memory, CPU, image, and node-count limits.
Keep [`python-docx`](https://github.com/python-openxml/python-docx) as a narrowly scoped alternative only if a later requirement justifies higher-fidelity section, header, footer, or page-layout intake. It is MIT and reads existing DOCX files, but it would add Python and more low-level numbering/style reconstruction to preserve features the V1 Taurus contract is willing to skip. Do not combine both parsers in V1.
Keep [UniOffice](https://unidoc.io/unioffice/) as a commercial fallback only if the FOSS implementation fails a real customer corpus. It is pure Go and supports offline deployment, but pricing and production terms are quote-based. A commercial dependency is not justified merely to retain unsupported Word constructs.
# Governing import law
The importer follows five rules:
1. **Create, never merge.** V1 creates a new Document. It never mutates or overwrites an existing resource.
2. **Meaning before appearance.** Preserve readable content, semantic hierarchy, lists, basic marks, links, and images. Preserve layout only where the current Document model has a direct representation.
3. **No invented equivalents.** If a Word feature has no clear Taurus analogue, skip it. Do not hide OOXML inside metadata, rasterize whole pages, or create prompt/formula behavior from ordinary Word content.
4. **Best effort is observable.** A skipped feature normally produces a stable diagnostic and does not fail the import. Invalid packages, security failures, configured-limit violations, or a document with no meaningful importable content do fail.
5. **The result is canonical Taurus state.** After commit, DOCX is provenance, not authority. Normal Document operations, revisions, validation, and access rules govern the imported resource.
The canonical destination is the current Taurus Omega Document model, including `DocumentBase`, rows, tracks, blocks, atoms, marks, styles, headers/footers, and revisioned ChangeSets. The runtime boundary is the [Taurus Omega runtime model](https://github.com/gccurtis/taurus-omega/blob/main/docs/architecture/runtime-model.md).
# Library decision
<table header-row="true">
<tr>
<td>Candidate</td>
<td>License/runtime</td>
<td>Strengths</td>
<td>Material concern</td>
<td>Decision</td>
</tr>
<tr>
<td>[`mammoth`](https://github.com/mwilliamson/mammoth.js)[ 1.12.0](https://github.com/mwilliamson/mammoth.js)</td>
<td>BSD-2-Clause; TypeScript/JavaScript</td>
<td>Reads DOCX; semantic headings/lists/tables/images/links/marks; custom style maps; deliberately ignores non-semantic detail</td>
<td>No sanitization; does not expose all section/layout detail</td>
<td>**Default**</td>
</tr>
<tr>
<td>[`parse5`](https://github.com/inikulin/parse5)</td>
<td>MIT; TypeScript/JavaScript</td>
<td>Standards-based, non-browser HTML parser; lets Taurus enforce a small allowlist</td>
<td>Adds a second small dependency</td>
<td>**AST boundary**</td>
</tr>
<tr>
<td>[`python-docx`](https://pypi.org/project/python-docx/)[ 1.2.0](https://pypi.org/project/python-docx/)</td>
<td>MIT; Python</td>
<td>Reads and updates DOCX; exposes sections, headers, footers, paragraphs, tables, styles</td>
<td>Adds Python; list/numbering and arbitrary OOXML still need careful reconstruction</td>
<td>**Future targeted alternative**</td>
</tr>
<tr>
<td>[UniOffice](https://unidoc.io/unioffice/)</td>
<td>Commercial; pure Go</td>
<td>One offline Go API and vendor support</td>
<td>Quote-based licensing and deployment terms</td>
<td>**Commercial fallback**</td>
</tr>
<tr>
<td>[Open XML SDK](https://github.com/dotnet/Open-XML-SDK)</td>
<td>MIT; .NET</td>
<td>Complete low-level package access and validation</td>
<td>Not a high-level semantic importer</td>
<td>**Fixture/validator tool, not parser**</td>
</tr>
</table>
Do not use LibreOffice headless conversion as the canonical import path. It adds a large office runtime, broad attack surface, nondeterministic layout dependencies, and an unnecessary intermediate format.
# Runtime architecture
DOCX import is a deferred durable job. Uploaded bytes are hostile ZIP/XML input and may contain many images, relationships, or pathological structures. The request path stores an immutable source File, enqueues the job, and returns a job ID.
```plain text
POST /documents/import?format=docx
  → access gate resolves (user, project)
  → File capability stores immutable source + SHA-256
  → enqueue document.import.docx
  → inspect package and enforce limits
  → isolated TypeScript worker: DOCX → Mammoth HTML + media
  → parse5 allowlisted AST → DocumentImportDraft
  → validate canonical draft and assets
  → one capability-owned create/import transaction
  → register Resource + provenance + diagnostics
```
The Document capability must not import Mammoth, parse5, or worker types. Those belong to an integration adapter.
```plain text
core/capability/document/             canonical aggregate and import port
core/integration/office/docx/import/  Go job adapter, validation, DTO mapping
workers/office-ts/docx-import/        Mammoth + parse5 only
workers/office-ts/contracts/          versioned import DTOs
tests/fixtures/office/docx-import/    golden, lossy, hostile, and limit fixtures
```
# Process and JSON boundary
The parser worker never writes Taurus persistence objects and never sends vendor objects, HTML, or unbounded JSON over stdout. Go materializes one attempt directory, launches the pinned executable directly with `exec.CommandContext`, and exchanges only versioned files:
```plain text
taurus-office-ts-worker import --format docx \
  --request /attempt/request.json \
  --source /attempt/input/source.docx \
  --output /attempt/output \
  --result /attempt/result.json
```
The command is invoked without a shell. Standard output and error are bounded operational logs only. The worker writes `result.json` last, after every referenced draft and asset file has been closed and hashed; that file is the completion sentinel.
```json
{
  "schemaVersion": 2,
  "format": "docx",
  "sourceSha256": "<hex>",
  "parser": {"name": "mammoth", "version": "1.12.0"},
  "draft": {"uri": "draft://document.json", "sha256": "<hex>", "bytes": 12345},
  "assets": [
    {"id": "asset-1", "uri": "asset://asset-1", "sha256": "<hex>", "mediaType": "image/png", "bytes": 2048}
  ],
  "diagnostics": [],
  "counts": {"rows": 8, "blocks": 41, "assets": 1}
}
```
`document.json` is a worker DTO, not `document.DocumentBase`. It contains source-local locators and temporary references but no ResourceID, FileID, revision, project, author, database key, or worker path. Go maps it into a capability-owned import proposal only after validating the result envelope.
```go
type DocxWorkerResultV2 struct {
    SchemaVersion int               `json:"schemaVersion"`
    Format        string            `json:"format"`
    SourceSHA256  string            `json:"sourceSha256"`
    Parser        ParserIdentity    `json:"parser"`
    Draft         CheckedFileRef    `json:"draft"`
    Assets        []CheckedAssetRef `json:"assets"`
    Diagnostics   []ImportDiagnostic `json:"diagnostics"`
    Counts        map[string]int64  `json:"counts"`
}

func decodeDocxWorkerResult(r io.Reader, maxBytes int64) (DocxWorkerResultV2, error) {
    dec := json.NewDecoder(io.LimitReader(r, maxBytes))
    dec.DisallowUnknownFields()
    var out DocxWorkerResultV2
    if err := dec.Decode(&out); err != nil { return out, err }
    if err := requireJSONEOF(dec); err != nil { return out, err }
    return out, validateDocxWorkerEnvelope(out)
}
```
Before mapping, Go verifies:
1. schema version, format, source digest, parser name/version, policy version, and attempt identity;
2. every referenced URI uses the owned `draft://` or `asset://` scheme and resolves beneath the attempt root;
3. no absolute path, `..`, symlink escape, duplicate logical ID, undeclared file, or digest/size/media mismatch exists;
4. the generated JSON Schema, byte/count/depth limits, source-locator grammar, diagnostics, and asset manifest all validate;
5. the draft contains no project-selected identity or executable behavior.
Only then does Go create project-scoped Files, substitute their FileIDs, assign deterministic canonical IDs from the source hash and locators, construct `document.ImportDraft`, and call the Document capability. The worker can propose content; it cannot authorize or commit it.
# Capability contracts
```go
package officeimport

type ImportRequest struct {
    ProjectID      string
    UserID         string
    SourceFileID   string
    SourceSHA256   string
    Format         string // docx
    IdempotencyKey string
}

type SourceLocator struct {
    PartPath  string // e.g. word/document.xml
    Paragraph int
    Table     int
    Row       int
    Cell      int
    Relation  string
}

type ImportDiagnostic struct {
    Code       string
    Severity   string // info | warning | material | blocking
    Locator    SourceLocator
    Message    string
    Count      int
}

type ImportReceipt struct {
    ImportID       string
    ResourceID     string
    Revision       int64
    SourceFileID   string
    SourceSHA256   string
    ImportedCounts map[string]int
    Diagnostics    []ImportDiagnostic
}

type DocxWorker interface {
    Parse(ctx context.Context, invocation WorkerInvocation) (CheckedDocxWorkerResult, error)
}

type DocxDraftMapper interface {
    Map(ctx context.Context, result CheckedDocxWorkerResult, policy DocxImportPolicy) (DocumentImportDraft, error)
}

type DocumentImporter interface {
    CreateImportedDocument(
        ctx context.Context,
        scope document.Scope,
        author document.Author,
        draft document.ImportDraft,
        provenance document.ImportProvenance,
    ) (document.Document, error)
}
```
The parser returns a Taurus-owned draft, not HTML or vendor objects:
```go
type DocumentImportDraft struct {
    SchemaVersion int
    SuggestedName string
    Base          document.DocumentBase
    Assets        []ImportedAsset
    Diagnostics   []ImportDiagnostic
    SourceStats   SourceStats
}

type ImportedAsset struct {
    TempID      string
    MediaType   string
    Filename    string
    SHA256      string
    Bytes       []byte // bounded; stream/spool above configured threshold
    WidthPX     int
    HeightPX    int
    AltText     string
}
```
Asset `TempID` values are replaced with project-scoped FileIDs before canonical validation. The imported Document never points at worker paths or data URIs.
# Format-specific worker DTO
```typescript
export interface DocxImportRequestV2 {
  schemaVersion: 2;
  sourceSha256: string;
  mappingPolicyVersion: string;
  limits: {
    maxUncompressedBytes: number;
    maxXmlBytes: number;
    maxParagraphs: number;
    maxAstNodes: number;
    maxImages: number;
    maxImageBytes: number;
    maxTotalMediaBytes: number;
  };
}

export interface DocxDocumentDraftV2 {
  schemaVersion: 2;
  suggestedName: string;
  rows: readonly ImportRow[];
  styles: readonly ImportStyle[];
  assets: readonly ImportAssetToken[];
  diagnostics: readonly ImportDiagnostic[];
  sourceStats: Readonly<Record<string, number>>;
}
```
Recommended Mammoth entry point:
```typescript
import mammoth from "mammoth";

const result = await mammoth.convertToHtml(
  { path: invocation.sourcePath },
  {
    includeEmbeddedStyleMap: false,
    includeDefaultStyleMap: true,
    externalFileAccess: false,
    styleMap: [
      "p[style-name='Title'] => h1:fresh",
      "p[style-name='Subtitle'] => p.subtitle:fresh",
      "p[style-name='Code'] => pre:fresh",
      "p[style-name='Quote'] => blockquote:fresh",
    ],
    convertImage: mammoth.images.imgElement(async (image) => {
      const bytes = Buffer.from(await image.read());
      return await stageImage(bytes, image.contentType);
    }),
  },
);

const draft = htmlFragmentToDocumentDraft(result.value, result.messages);
```
`stageImage` enforces type, byte, dimension, decompression, and cumulative-media limits before returning an attempt-local opaque token. It never creates a remote URL. Mammoth warnings are normalized into Taurus diagnostic codes rather than copied as unstable user-facing strings.
# HTML allowlist and sanitization
Mammoth HTML is only an intermediate parser output. Parse it as data and accept:
- block tags: `p`, `h1`–`h6`, `ul`, `ol`, `li`, `pre`, `blockquote`, `table`, `thead`, `tbody`, `tr`, `td`, `th`, `img`, `br`, `hr`;
- inline tags: `strong`, `b`, `em`, `i`, `u`, `s`, `del`, `sup`, `sub`, `a`, `span`;
- attributes: `href` on `a`, attempt-local asset token and `alt` on `img`, a small Taurus-generated class set used by the style map.
Everything else is unwrapped to text or skipped. Event handlers, `style`, `srcset`, arbitrary classes, IDs, SVG/XML, forms, scripts, iframes, object/embed elements, and unknown URI schemes are discarded.
```typescript
const allowedLink = (raw: string): string | undefined => {
  const value = raw.trim();
  if (value.startsWith("#")) return value;
  const url = new URL(value);
  return ["https:", "http:", "mailto:"].includes(url.protocol)
    ? url.toString()
    : undefined;
};
```
External relationships remain disabled even when their visible link text is imported. A valid `https`, `http`, or `mailto` hyperlink may be retained as a mark; Taurus never dereferences it during import.
# Canonical mapping
## Paragraphs and headings
<table header-row="true">
<tr>
<td>DOCX semantic result</td>
<td>Taurus destination</td>
<td>Rule</td>
</tr>
<tr>
<td>ordinary paragraph</td>
<td>text block, body subkind</td>
<td>Preserve text, basic paragraph alignment, and supported marks.</td>
</tr>
<tr>
<td>Heading 1–6</td>
<td>text block, heading 1–6 subkind</td>
<td>Clamp deeper or custom heading levels to the nearest supported level.</td>
</tr>
<tr>
<td>Title/Subtitle style</td>
<td>heading/body style token</td>
<td>Title maps to H1; subtitle maps to body with a generated semantic style.</td>
</tr>
<tr>
<td>blank paragraph</td>
<td>empty body block only when it separates meaningful blocks</td>
<td>Collapse repeated decorative blanks.</td>
</tr>
<tr>
<td>line break</td>
<td>newline inside the current text atom</td>
<td>Do not create a new block.</td>
</tr>
<tr>
<td>horizontal rule</td>
<td>divider block</td>
<td>Only when produced by an explicit supported semantic mapping.</td>
</tr>
<tr>
<td>page/section break</td>
<td>skipped</td>
<td>Taurus pagination is derived; V1 does not synthesize page state.</td>
</tr>
</table>
Paragraph-local direct formatting is reduced to marks. Global Word style definitions are not copied wholesale. Create only the semantic styles referenced by imported blocks, resolve font fallbacks, and deduplicate equivalent styles.
## Text and marks
Convert text to UTF-8 atoms and byte-offset marks:
<table header-row="true">
<tr>
<td>Word/Mammoth inline</td>
<td>Taurus mark</td>
</tr>
<tr>
<td>bold/strong</td>
<td>bold</td>
</tr>
<tr>
<td>italic/emphasis</td>
<td>italic</td>
</tr>
<tr>
<td>underline</td>
<td>underline only when explicitly mapped; Mammoth ignores it by default</td>
</tr>
<tr>
<td>strike/delete</td>
<td>strike</td>
</tr>
<tr>
<td>superscript/subscript</td>
<td>superscript/subscript</td>
</tr>
<tr>
<td>hyperlink</td>
<td>link mark after protocol validation</td>
</tr>
<tr>
<td>inline code style</td>
<td>inline-code mark when supplied by the Taurus style map</td>
</tr>
</table>
Word bookmarks become local link targets only when both target and reference survive the import. Fields, citations, cross-references, content controls, equations, and dynamic values are imported as visible text if Mammoth supplies it; their executable semantics are dropped.
Adjacent text fragments with identical marks are coalesced. Offsets are computed from the final normalized UTF-8 bytes, never from UTF-16 code units.
```go
func appendRun(dst *TextAtomBuilder, text string, marks []MarkKind) {
    start := dst.ByteLen()
    dst.AppendNormalized(text)
    end := dst.ByteLen()
    if start != end {
        dst.AddMarks(start, end, marks)
    }
}
```
## Lists
`ul` and `ol` become canonical list blocks. Nested list depth becomes list-item level. Preserve ordered versus unordered and checkbox state only when Mammoth emits an unambiguous checkbox input/result through an owned style mapping. Word numbering definitions, custom glyphs, restart metadata, and picture bullets are presentation details and are not canonicalized.
- Preserve list item text and nesting.
- Use default Taurus bullet/number presentation.
- Keep a supported explicit ordered start if available; otherwise start at 1.
- Flatten nesting beyond the configured maximum and record `DOCX_LIST_DEPTH_CLAMPED`.
- Malformed lists become ordinary body paragraphs rather than failing the import.
## Tables
The current Document model has rows and tracks but no semantic table block. Use one intentionally narrow approximation:
- A simple rectangular table with no nested table and at most the configured track count becomes one Document row per source row and one track per cell.
- Use equal track weights. Mammoth intentionally ignores Word table-format details such as grid widths and borders.
- Each cell may contain text/list blocks supported by a track.
- Borders, cell fills, repeat-header behavior, formulas, sorting, vertical merge behavior, and table semantics are not preserved.
- For merged, nested, or over-limit tables, preserve readable cell text as sequential body blocks prefixed only when needed for clarity; record `DOCX_TABLE_FLATTENED`.
This is a content-preserving layout approximation, not a claim that Taurus has imported a Word table.
## Images
Embedded PNG, JPEG, GIF first frame, and safe SVG may become File resources and image blocks after inspection. Unsupported or corrupt formats are skipped.
- Never fetch linked images.
- Hash and deduplicate identical bytes within the attempt.
- Preserve alt text when present.
- Convert pixel dimensions to points using the configured import DPI when explicit physical dimensions are unavailable.
- Apply configured maximum dimensions and downscale only as an explicit derived-asset operation; never mutate the immutable source.
- If an inline image occurs inside a text paragraph and the model cannot represent it inline, split the paragraph around a separate image block and record `DOCX_INLINE_IMAGE_LIFTED`.
## Styles, layout, headers, and footers
V1 intentionally does not import:
- section changes, paper size, margins, columns, orientation, gutters, or page numbering;
- headers and footers;
- Word themes, arbitrary style inheritance, tab stops, text effects, borders, shading, watermarks, or floating positions;
- footnotes/endnotes as special structures;
- comments, tracked changes, revisions, reviewers, or document protection.
Visible body text emitted by Mammoth remains eligible for import. Unsupported metadata and behavior are skipped without hidden preservation.
# Explicitly skipped features
<table header-row="true">
<tr>
<td>Source feature</td>
<td>V1 behavior</td>
<td>Diagnostic</td>
</tr>
<tr>
<td>macros, ActiveX, embedded/OLE objects</td>
<td>reject non-`.docx` macro-enabled inputs or skip embedded object</td>
<td>`DOCX_ACTIVE_CONTENT_REJECTED`</td>
</tr>
<tr>
<td>tracked changes and comments</td>
<td>import accepted visible text when exposed; drop review state</td>
<td>`DOCX_REVIEW_STATE_DROPPED`</td>
</tr>
<tr>
<td>fields, TOC, citations, dynamic references</td>
<td>retain visible result text only</td>
<td>`DOCX_FIELD_MATERIALIZED`</td>
</tr>
<tr>
<td>footnotes/endnotes</td>
<td>drop special structure; optionally retain body text only if parser exposes it safely</td>
<td>`DOCX_NOTE_STRUCTURE_DROPPED`</td>
</tr>
<tr>
<td>equations</td>
<td>retain parser-exposed plain text; otherwise skip</td>
<td>`DOCX_EQUATION_DROPPED`</td>
</tr>
<tr>
<td>floating text boxes/shapes</td>
<td>retain text as ordinary paragraph when exposed; drop geometry</td>
<td>`DOCX_FLOATING_LAYOUT_DROPPED`</td>
</tr>
<tr>
<td>charts/SmartArt/diagrams</td>
<td>skip</td>
<td>`DOCX_GRAPHIC_DROPPED`</td>
</tr>
<tr>
<td>external images/files</td>
<td>never read or fetch</td>
<td>`DOCX_EXTERNAL_RELATIONSHIP_DROPPED`</td>
</tr>
<tr>
<td>password-protected/encrypted package</td>
<td>reject in V1</td>
<td>`DOCX_ENCRYPTED_UNSUPPORTED`</td>
</tr>
</table>
Do not add a strict mode that fails merely because unsupported features exist. This import surface is intentionally best effort.
# Planning, limits, and failure policy
Before conversion, inspect the ZIP central directory without expanding it:
```go
type OfficeZipLimits struct {
    MaxCompressedBytes   int64
    MaxUncompressedBytes int64
    MaxEntryBytes        int64
    MaxEntries           int
    MaxCompressionRatio  float64
    MaxXMLBytes          int64
    MaxMediaBytes        int64
}
```
Reject:
- incorrect content type or missing required Word package parts;
- encrypted packages;
- path traversal, duplicate normalized entry paths, symbolic-link-like entries, or ZIP bombs;
- XML with disallowed DTD/entity behavior;
- limit overflow;
- a worker crash/timeout;
- a completed draft with no meaningful text, divider, or accepted image.
Do not fail for a single unsupported shape, field, style, or image. Skip it and continue.
# Diagnostics
Codes are stable API values. Messages may improve without changing the code.
```go
const (
    DiagDocxParagraphStyleSimplified  = "DOCX_PARAGRAPH_STYLE_SIMPLIFIED"
    DiagDocxTableFlattened            = "DOCX_TABLE_FLATTENED"
    DiagDocxInlineImageLifted         = "DOCX_INLINE_IMAGE_LIFTED"
    DiagDocxFieldMaterialized         = "DOCX_FIELD_MATERIALIZED"
    DiagDocxGraphicDropped            = "DOCX_GRAPHIC_DROPPED"
    DiagDocxExternalRelationDropped   = "DOCX_EXTERNAL_RELATIONSHIP_DROPPED"
)
```
Coalesce repeated diagnostics by code and nearest useful source locator. The user-facing receipt should answer:
- what resource was created;
- how many paragraphs, headings, lists, tables, and images were imported;
- what was skipped or simplified;
- whether any material content could not be represented.
# Commit, persistence, and concurrency
Import does not append one ChangeSet per paragraph. It builds and validates the complete draft, then creates one canonical aggregate.
```go
func (d *Documents) CreateImported(
    scope Scope,
    author Author,
    draft ImportDraft,
    provenance ImportProvenance,
) (Document, error) {
    // 1. validate project-scoped FileIDs and canonical base
    // 2. compute deterministic draft hash
    // 3. start SQLite transaction
    // 4. idempotency lookup by (project, source SHA, importer version, key)
    // 5. insert document at Revision=0, BaseSeq=0
    // 6. insert provenance + diagnostics + resource-catalog record
    // 7. commit
}
```
The new Document begins with `Revision == 0` and `BaseSeq == 0`; its imported state is the base snapshot. Subsequent human and agent edits use normal ChangeSets. If the existing Document service requires an initial sequence, use one server-owned `apply_import_result` ChangeSet consistently across all resource imports; do not replay granular source operations.
The job is at-least-once. Idempotency is keyed by project, source FileID/SHA-256, parser contract version, mapping-policy version, and caller idempotency key. Repeating the same job returns the same resource and receipt. Reusing a key for different inputs is a conflict.
The source File remains immutable and project-scoped. Provenance stores source FileID, source hash, importer/library versions, mapping-policy version, timestamps, and aggregate diagnostic counts. It does not store the full untrusted HTML intermediate.
# Security and privacy
- Launch the pinned Node executable directly with `exec.CommandContext`; never invoke a shell or accept user-controlled argv.
- Run the worker with no network, database, project store, Office application, provider keys, reusable credentials, or ambient filesystem access.
- Use an attempt-scoped read-only input path and bounded attempt-scoped output directory.
- Set CPU, wall-clock, memory, file-count, output-byte, and process limits.
- Disable Mammoth external file access and embedded style maps.
- Sanitize links and parse HTML into an allowlisted AST; never inject it into a browser.
- Validate image signatures, dimensions, decompression cost, and decoded pixel count.
- Reject path traversal and unsafe ZIP relationships before the worker.
- Treat all worker diagnostics and filenames as untrusted text when logging.
- Store source and derived assets through the File capability so `(user, project)` authorization and deduplication remain authoritative.
# Validation and tests
Use four fixture tiers:
1. **Canonical mapping fixtures:** headings, body, marks, links, nested lists, simple tables, images, blank lines.
2. **Loss fixtures:** fields, comments, tracked changes, footnotes, text boxes, charts, SmartArt, complex tables, unsupported images.
3. **Producer corpus:** current Word, LibreOffice, Google Docs download, and Pages-exported DOCX.
4. **Adversarial fixtures:** ZIP bombs, duplicate entries, traversal names, malformed relationships/XML, huge images, dangerous URLs, excessive nesting, timeouts.
Every golden fixture asserts the canonical `DocumentBase`, asset hashes, stable diagnostic codes, and deterministic IDs—not generated HTML strings.
```go
func TestDocxImportIsDeterministic(t *testing.T) {
    first := importFixture(t, "semantic-content.docx")
    second := importFixture(t, "semantic-content.docx")
    require.Equal(t, first.CanonicalHash(), second.CanonicalHash())
    require.Equal(t, first.Diagnostics, second.Diagnostics)
}

func TestDocxImportDropsActiveAndExternalContent(t *testing.T) {
    got := importFixture(t, "hostile-relationships.docx")
    require.NoExternalAssetURLs(t, got)
    require.ContainsDiagnostic(t, got, "DOCX_EXTERNAL_RELATIONSHIP_DROPPED")
}
```
Acceptance criteria:
- supported content imports to a valid editable Document;
- reruns are deterministic and idempotent;
- no parser output bypasses canonical validation or File capability ingestion;
- unsupported features do not block otherwise useful imports;
- dangerous inputs fail before any visible resource is created;
- no partial Document is visible;
- the receipt accurately summarizes imported, simplified, and dropped content.
# Implementation sequence
1. Implement common Office package inspection, source hashing, diagnostics, provenance, durable jobs, attempt directories, and the file-based worker client.
2. Freeze `DocxImportRequestV2`, `DocxWorkerResultV2`, the parser-neutral document schema, URI rules, manifests, diagnostics, and limits.
3. Pin Node, Mammoth 1.12.0, and parse5; record hashes, licenses, SBOM, worker image, and the no-egress profile.
4. Add `CreateImportedDocument` as a Document capability operation and transactional canonical-base store path.
5. Implement paragraph, heading, mark, link, list, image, divider, semantic-style, and source-locator mapping.
6. Add the narrow table-to-rows/tracks approximation and complex-table flattening.
7. Add strict Go decoding, JSON Schema validation, digest/path validation, FileID substitution, deterministic ID assignment, and canonical proposal validation.
8. Add idempotency, resource-catalog registration, receipts, cancellation, process limits, and the golden/producer/adversarial corpus.
9. Compare `python-docx`, Apache POI, or commercial tooling only against measured blocking fixtures.
# Sources and related Taurus specifications
- [`mammoth`](https://github.com/mwilliamson/mammoth.js)[ 1.12.0 repository and supported-feature/security documentation](https://github.com/mwilliamson/mammoth.js)
- [GitHub advisory for the external-file traversal fixed in Mammoth 1.11.0](https://github.com/advisories/GHSA-rmjr-87wv-gf87)
- [`mammoth`](https://www.npmjs.com/package/mammoth)[ current npm package](https://www.npmjs.com/package/mammoth)
- [`parse5`](https://github.com/inikulin/parse5)[ repository](https://github.com/inikulin/parse5)
- [`python-docx`](https://python-docx.readthedocs.io/en/stable/)[ documentation](https://python-docx.readthedocs.io/en/stable/)
- [Taurus Omega runtime model](https://github.com/gccurtis/taurus-omega/blob/main/docs/architecture/runtime-model.md)
- [Current Omega Document import/export handler](https://github.com/gccurtis/taurus-omega/blob/main/core/handlers/document/importexport.go)
- [Export - Document to DOCX](https://app.notion.com/p/3acb6410e5028134aedfe63676d5418c)

