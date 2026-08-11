---
title: "Export - Document to DOCX"
notion_page_id: "3acb6410e5028134aedfe63676d5418c"
notion_url: "https://app.notion.com/3acb6410e5028134aedfe63676d5418c"
project: "Taurus Yesod"
role: "Primary"
format: "Spec"
created: "2026-07-29 05:28:13Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Export - Document to DOCX

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Reviewed decision · Export only · Research refreshed: 2026-07-29.** This page defines how one immutable Taurus Document revision becomes a downloadable, editable `.docx`. It does not define DOCX import, round-trip reconstruction, collaborative history export, the editor UI, or page-locked delivery.
# Executive decision
Use [`docx`](https://www.npmjs.com/package/docx)[ 9.7.1](https://www.npmjs.com/package/docx) (`docx.js`, MIT), pinned exactly, as the default DOCX emitter in the same isolated TypeScript Office-export worker used by PPTX. Keep it behind a Taurus-owned `DocxRenderer` port. `docx.js` remains the strongest FOSS fit after the language-neutral review: its declarative API covers sections, page layout, headers, footers, paragraph/run styles, numbering, tables, images, hyperlinks, checkboxes, comments, math, fields, notes, and package generation without Microsoft Word.
The worker is a deployment cost, but not a hosted dependency: it runs inside the Taurus deployment, requires no Word installation, makes no external conversion call, and requires no software license key. That preserves on-premises and air-gapped operation.
Do not choose a Go library merely to avoid a subprocess. [`python-docx`](https://python-docx.readthedocs.io/) is mature for common Word content but would require lower-level XML work for portions of Taurus's generation surface. [`docxgo`](https://github.com/mmonterroca/docxgo) is substantially younger and carries a provenance-review burden. The official [Open XML SDK](https://github.com/dotnet/Open-XML-SDK) is the right independent validator and low-level escape hatch, not a high-level renderer. None is simpler overall than `docx.js`.
Keep [UniOffice](https://unidoc.io/unioffice/) as the commercial escape hatch if the FOSS spike exposes material gaps. It would remove the Node worker and provides one pure-Go API for DOCX, PPTX, and XLSX, but pricing is quote-based for offline production and the published Business tier's production-end-user ceiling is not appropriate for a broadly sold SaaS product. Obtain a Gold-or-higher quote and written deployment terms before considering adoption.
# Pagination contract: editable DOCX is not page-locked PDF
Taurus has a canonical page projection for its own editor and PDF export. That projection must **not** be copied into DOCX as a hard break after every derived page.
Word owns pagination when it opens an editable DOCX. It recalculates line wrapping and page breaks from the installed fonts, Word version, compatibility settings, page geometry, paragraph properties, and host layout engine. OOXML's `w:lastRenderedPageBreak` records where an application last calculated a break; it is historical metadata, not an instruction that forces future pagination. `w:pageBreakBefore` and explicit break runs force intentional author breaks, but they cannot freeze all incidental wrapping.
Therefore:
- DOCX preserves semantic editability, page geometry, paragraph constraints, and **explicit** Taurus page breaks.
- DOCX does not promise that the same derived row remains on the same numbered page as Taurus or PDF.
- The worker consumes the semantic Document export snapshot, not `DocumentPDFSnapshotV1`.
- The worker must not emit `w:lastRenderedPageBreak`.
- “Exact pages,” print submission, and approval copies use <mention-page url="https://app.notion.com/p/3acb6410e502817fbde1f33e76f61b82"/>.
- There is no misleading DOCX “appearance mode.” The supported modes are `balanced` and `strict`; both remain editable.
This boundary is what allows the DOCX to behave like a normal Word document instead of a collection of fixed page pictures or text boxes.
# Scope and fidelity contract
The export is a materialized projection of one exact Document revision.
- The exported file represents accepted display state at the pinned revision.
- Taurus formula atoms and prompt blocks export their accepted display value, not executable Taurus logic or hidden prompt state.
- Word pagination flows from page geometry and paragraph constraints. Taurus-derived pages are used only as a QA comparison, never serialized as one section or hard break per visible page.
- Explicit Taurus page breaks remain explicit Word page breaks.
- Export does not preserve ChangeSets, BaseSeq, collaborators, presence, undo stacks, evidence records, or revision history.
- Export does not promise that reopening the DOCX in Taurus reconstructs the original resource.
- A ready artifact must reopen without package repair, pass OOXML validation, and carry an explicit fidelity report.
The canonical source is the Taurus Omega Document model and runtime, especially [`model.go`](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/document/model.go), [`style.go`](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/document/style.go), [`layout.go`](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/document/layout.go), [`track.go`](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/document/track.go), and the [runtime model](https://github.com/gccurtis/taurus-omega/blob/main/docs/architecture/runtime-model.md). Current Omega export supports Markdown only; DOCX is a new adapter behind the existing capability boundary.
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
<td>[`docx.js`](https://github.com/dolanmiu/docx)[ 9.7.1](https://github.com/dolanmiu/docx)</td>
<td>MIT; TypeScript/JavaScript; Node or browser</td>
<td>Mature declarative API; strong feature surface; Buffer/stream output; no Office installation</td>
<td>Adds a Node execution unit; Word still owns final pagination</td>
<td>**Default**</td>
</tr>
<tr>
<td>[`docxgo`](https://github.com/mmonterroca/docxgo)</td>
<td>MIT; pure Go 1.23+</td>
<td>Deployment fit; sections, tables, images, fields, headers/footers, styles</td>
<td>Young ecosystem; provenance/legal review warranted</td>
<td>**Time-boxed alternative spike**</td>
</tr>
<tr>
<td>[UniOffice](https://unidoc.io/unioffice/)</td>
<td>Commercial; pure Go</td>
<td>One supported API for all three Office formats; offline and air-gapped</td>
<td>Quote pricing and tier/end-user terms</td>
<td>**Commercial fallback**</td>
</tr>
<tr>
<td>[Open XML SDK](https://github.com/dotnet/Open-XML-SDK)</td>
<td>MIT; .NET</td>
<td>Authoritative low-level OOXML API and validator</td>
<td>Explicitly not a high-level productivity API; adds .NET</td>
<td>**CI validator, not V1 renderer**</td>
</tr>
<tr>
<td>[Apache POI XWPF](https://poi.apache.org/components/document/index.html)</td>
<td>Apache-2.0; Java</td>
<td>Established OOXML ecosystem</td>
<td>Apache describes XWPF as only “moderately functional”; lower-level work and Java runtime</td>
<td>**Reject for V1**</td>
</tr>
</table>
Do not choose a single commercial library merely for uniformity. Each format has a different best emitter, and Taurus owns a replacement contract around each adapter.
# Export architecture
Export is a derived durable job. It never writes a Document ChangeSet and never reads a moving “latest” pointer after pinning.
```go
package officeexport

type Format string

const FormatDOCX Format = "docx"

type ExportRequest struct {
    ProjectID   string
    ResourceID  string
    Revision    int64
    Format      Format
    Options     ExportOptions
    IdempotencyKey string
}

type ExportOptions struct {
    FidelityMode    string // balanced | strict
    IncludeMetadata bool
}

type ExportWarning struct {
    Code       string
    ObjectID   string
    Severity   string // info | warning | material | blocking
    Message    string
}

type ExportArtifact struct {
    ContentType string
    Filename    string
    SHA256      string
    ByteSize    int64
    Warnings    []ExportWarning
}

type DocumentSnapshotReader interface {
    ReadDocumentRevision(ctx context.Context, projectID, documentID string, revision int64) (DocumentExportSnapshot, error)
}

type DocxRenderer interface {
    Render(ctx context.Context, invocation WorkerInvocation) (CandidateArtifact, error)
}

type WorkerInvocation struct {
    RequestPath  string
    SnapshotPath string
    AssetsPath   string
    OutputPath   string
    ResultPath   string
}
```
The Go job owns authorization, exact-revision pinning, idempotency, queueing, limits, asset materialization, subprocess lifetime, artifact validation, persistence, and delivery. It invokes the worker with `exec.CommandContext` and distinct argv elements—never through a shell.
```plain text
taurus-office-ts-worker render
  --format docx
  --request /attempt/request.json
  --snapshot /attempt/snapshot.json
  --assets /attempt/assets.json
  --output /attempt/artifact.docx
  --result /attempt/result.json
```
The TypeScript worker receives bounded, versioned JSON files and attempt-local media. It has no database, project store, provider key, network authority, shell, or canonical object-store credential. `assets.json` maps opaque `asset://<id>` references to files within the attempt directory; the worker rejects every other path or fetch scheme.
```typescript
export interface DocumentOfficeSnapshotV2 {
  schemaVersion: 2;
  projectId: string;
  documentId: string;
  revision: string; // decimal int64; never a JavaScript number
  name: string;
  page: PageLayout;
  layoutRules: LayoutRules;
  styles: readonly ResolvedOfficeStyle[];
  header?: ExportRow;
  footer?: ExportRow;
  rows: readonly ExportRow[];
  assets: readonly AssetDescriptor[];
}

export interface DocxWorkerResult {
  schemaVersion: 1;
  status: "ok" | "failed";
  exporter: "docx-js";
  exporterVersion: "9.7.1";
  sourceRevision: string;
  outputBytes: number;
  outputSha256: string;
  pageSetup: PageLayout;
  warningCounts: Record<string, number>;
  warnings: readonly ExportWarning[];
}
```
The snapshot contains semantic rows, blocks, resolved styles, accepted values, and explicit break intent. It deliberately excludes derived page membership. JSON schemas are generated or golden-tested from the Go/TypeScript DTOs, and all unknown schema versions fail closed.
Recommended placement:
```plain text
core/capability/document/          canonical Document model; no vendor import
core/integration/office/docx/      Go adapter and worker client
workers/office-ts/docx/            docx.js 9.7.1 mapping only
workers/office-ts/contracts/       generated/versioned JSON schemas
tests/fixtures/office/docx/        canonical and adversarial fixtures
```
# Canonical mapping
## Document and page setup
<table header-row="true">
<tr>
<td>Taurus</td>
<td>DOCX</td>
<td>Rule</td>
</tr>
<tr>
<td>`Document.Name`</td>
<td>core title + safe filename</td>
<td>The filename is presentation metadata, not identity.</td>
</tr>
<tr>
<td>`PageLayout.Width/Height` in points</td>
<td>section page size in twips</td>
<td>`twips = points × 20`. Preserve custom sizes.</td>
</tr>
<tr>
<td>page margins in points</td>
<td>section margins in twips</td>
<td>Preserve each margin independently.</td>
</tr>
<tr>
<td>default typography</td>
<td>Normal style defaults</td>
<td>Resolve semantic tokens before emitting.</td>
</tr>
<tr>
<td>header/footer rows</td>
<td>default section header/footer</td>
<td>Reuse the same row renderer; disallow unsupported nested page breaks.</td>
</tr>
<tr>
<td>`LayoutRules`</td>
<td>paragraph/table constraints where representable</td>
<td>Emit warnings for rules without a Word analogue.</td>
</tr>
</table>
Taurus pages are derived. Create one Word section for the normal document unless a future canonical model introduces explicit section changes. Do not freeze every currently visible page with hard breaks.
```typescript
const pointsToTwips = (points: number): number => Math.round(points * 20);

function sectionProperties(page: PageLayout) {
  return {
    page: {
      size: {
        width: pointsToTwips(page.widthPt),
        height: pointsToTwips(page.heightPt),
      },
      margin: {
        top: pointsToTwips(page.marginTopPt),
        right: pointsToTwips(page.marginRightPt),
        bottom: pointsToTwips(page.marginBottomPt),
        left: pointsToTwips(page.marginLeftPt),
      },
    },
  };
}
```
## Rows and tracks
A one-block row emits the block directly. A multi-block row is a horizontal layout construct; Word has no semantic equivalent. Encode it as a borderless, fixed-width table with one cell per track.
1. Resolve normalized track weights and usable content width.
2. Subtract gaps from the usable width.
3. Allocate cell widths deterministically using largest-remainder rounding.
4. Represent gaps as cell margins where possible; otherwise use narrow gap cells.
5. Render each block inside its track cell.
6. Apply `cantSplit`/keep constraints when Taurus requires the row to remain together.
7. Emit `DOCX_TRACK_LAYOUT_APPROXIMATED` if Word's layout engine can change wrapping materially.
```typescript
function allocateTwips(total: number, weights: readonly number[]): number[] {
  const exact = weights.map((weight) => total * weight / 100);
  const widths = exact.map(Math.floor);
  let remaining = total - widths.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let i = 0; i < remaining; i++) widths[order[i].index]++;
  return widths;
}
```
## Block mapping
<table header-row="true">
<tr>
<td>Taurus block</td>
<td>Word representation</td>
<td>Notes</td>
</tr>
<tr>
<td>body text</td>
<td>paragraph using resolved body style</td>
<td>Preserve paragraph alignment, spacing, indent, line height where Word supports it.</td>
</tr>
<tr>
<td>heading 1–6</td>
<td>Heading 1–6 paragraph style</td>
<td>Use outline levels so Word navigation and TOC work.</td>
</tr>
<tr>
<td>code</td>
<td>paragraph with a custom Code style</td>
<td>Monospace, preserved whitespace, optional shading; split very long runs safely.</td>
</tr>
<tr>
<td>callout</td>
<td>one-cell table or bordered/shaded paragraph</td>
<td>Prefer one-cell table when the callout needs padding/background.</td>
</tr>
<tr>
<td>list</td>
<td>Word numbering definition + list paragraphs</td>
<td>Stable numbering definition per list; preserve nesting and ordered start.</td>
</tr>
<tr>
<td>checklist item</td>
<td>interactive checkbox content control when reliable; glyph fallback</td>
<td>Use `docx.js` checkbox support only after Office/LibreOffice tests.</td>
</tr>
<tr>
<td>divider</td>
<td>paragraph bottom border</td>
<td>Do not use a raster line.</td>
</tr>
<tr>
<td>image</td>
<td>inline DrawingML image</td>
<td>Preserve point dimensions, aspect policy, and alt text; warn on unsupported source type.</td>
</tr>
<tr>
<td>prompt</td>
<td>ordinary rendered paragraph(s)</td>
<td>Export accepted display atoms only; omit prompt configuration and model state.</td>
</tr>
</table>
`RowStyle.PageBreak` becomes a page break before the row's first paragraph. `KeepWithNext` maps to Word's paragraph keep-with-next setting on every paragraph that must remain attached.
## Atoms, marks, and hyperlinks
Atoms and marks do not map one-to-one to Word runs because marks can begin and end inside text atoms. Build a sorted boundary set from:
- every atom boundary;
- every mark start and end byte offset;
- every hyperlink boundary;
- every formula/display substitution boundary.
Sweep consecutive intervals, resolve the active mark set, and emit the smallest stable run sequence. Coalesce adjacent runs only when all resolved properties and hyperlink targets are identical.
```plain text
boundaries := atom starts/ends ∪ mark starts/ends
sort and deduplicate boundaries

for each [boundaries[i], boundaries[i+1]):
    text := accepted display text in interval
    marks := all marks covering interval
    props := resolveMarks(styleCascade, marks)
    emit TextRun(text, props)

coalesce adjacent runs with identical props and relationship target
```
Supported mark mapping:
<table header-row="true">
<tr>
<td>Mark</td>
<td>Word run/relationship</td>
</tr>
<tr>
<td>bold, italic, underline, strike</td>
<td>direct run formatting</td>
</tr>
<tr>
<td>superscript, subscript</td>
<td>vertical alignment</td>
</tr>
<tr>
<td>font family/size/color/highlight</td>
<td>resolved run properties</td>
</tr>
<tr>
<td>inline code</td>
<td>character style plus monospace fallback</td>
</tr>
<tr>
<td>link</td>
<td>external or internal hyperlink relationship</td>
</tr>
</table>
Reject or sanitize unsafe protocols. Never let a link cause the exporter to fetch remote content.
## Style registry
Materialize the Taurus style cascade before writing:
```plain text
built-in semantic default
  → StyleRegistry definition
  → StyleRef
  → block override
  → mark/run override
```
Generate deterministic Word style IDs from Taurus style IDs. Built-in headings map to Word heading styles; other semantic styles become custom paragraph or character styles. Resolve semantic color, spacing, padding, border, background, and tone tokens to concrete values in the snapshot so the exporter does not import design-system code.
## Formula and prompt materialization
Formula atoms are Taurus runtime values, not necessarily mathematical notation. Export:
1. accepted current result when state is resolved;
2. last-good display result plus `DOCX_FORMULA_LAST_GOOD` when the current evaluation is failed but the resource is displaying last-good;
3. a visible error label only when the Taurus editor itself displays that error at the pinned revision.
Do not export expression text, dependency IDs, prompt instructions, model/provider metadata, or hidden history unless a future explicit “developer export” mode is approved.
# Failure and loss policy
<table header-row="true">
<tr>
<td>Condition</td>
<td>Balanced mode</td>
<td>Strict mode</td>
</tr>
<tr>
<td>unsupported typography metric</td>
<td>substitute approved font; warn</td>
<td>block if layout impact exceeds threshold</td>
</tr>
<tr>
<td>multi-track wrap differs</td>
<td>emit borderless layout table; warn</td>
<td>block on material geometry mismatch</td>
</tr>
<tr>
<td>unsupported image type</td>
<td>transcode locally to PNG/JPEG; warn</td>
<td>block if exact representation required</td>
</tr>
<tr>
<td>unresolved asset</td>
<td>block</td>
<td>block</td>
</tr>
<tr>
<td>formula/prompt last-good</td>
<td>materialize and warn</td>
<td>block when current accepted state is not authoritative</td>
</tr>
<tr>
<td>unsafe/external relationship</td>
<td>strip or convert to plain text; warn</td>
<td>block</td>
</tr>
<tr>
<td>comment/revision history</td>
<td>omit by default</td>
<td>block only if explicitly requested and unsupported</td>
</tr>
</table>
Stable warning codes should include the Document/Row/Block/Atom identity and never require parsing human prose.
# Security, privacy, and operational limits
- Authorize `(actor, project, resource, revision, export)` before pinning and again before delivery.
- Pass media by bounded bytes or attempt-scoped signed read grants; the worker receives no general object-store credential.
- Disable network egress. Remote image URLs and external templates are not fetched.
- Limit rows, blocks, atoms, mark boundaries, image pixels, decoded bytes, output bytes, CPU time, memory, and temporary disk.
- Sanitize filenames and set the exact DOCX MIME type: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
- Reopen the generated ZIP; reject path traversal, duplicate critical parts, malformed relationships, macros, ActiveX, embedded packages, and unapproved external relationships.
- Logs contain IDs, revision, counts, timings, exporter version, warning codes, byte size, and checksum prefix—not document text, prompt content, links, or media.
# Validation and acceptance corpus
Use [ECMA-376 / ISO 29500](https://ecma-international.org/publications-and-standards/standards/ecma-376/) as the format authority. In CI, validate generated packages with the MIT [Open XML SDK](https://github.com/dotnet/Open-XML-SDK) `OpenXmlValidator`; Microsoft documents that it can validate a complete `OpenXmlPackage`. The SDK is validation infrastructure, not the runtime renderer.
Every fixture must pass:
1. package reopen and relationship validation;
2. Open XML schema validation;
3. semantic inspection of page size, margins, styles, list levels, hyperlinks, tables, headers/footers, image count and alt text;
4. assertion that only explicit Taurus breaks become forced Word page breaks and no `w:lastRenderedPageBreak` is emitted;
5. headless rendering to PDF/images in a pinned QA environment, compared as an editable-flow fidelity check rather than an exact page-membership assertion;
6. Microsoft Word spot checks for the release corpus;
7. LibreOffice Writer compatibility checks;
8. deterministic output comparison after normalizing allowed volatile package metadata.
Minimum corpus:
- every heading level and semantic typography token;
- overlapping marks across multiple atoms and Unicode grapheme boundaries;
- ordered, bullet, nested, and checklist lists;
- code, callout, divider, image, prompt, formula result, and hyperlink blocks;
- headers, footers, page breaks, keep-with-next, custom page size, and margins;
- one-, two-, and three-track rows with extreme width ratios;
- long text, CJK, RTL, emoji, missing fonts, and fallback fonts;
- large documents and media-limit failures;
- malicious links, filenames, ZIP metadata, and oversized assets.
V1 is accepted when a coding agent can implement the adapter from this page, every supported block has a deterministic mapping, silent material loss is impossible, and the representative corpus opens without repair in Word and LibreOffice.
# Implementation sequence
1. Pin `docx` 9.7.1, Node, TypeScript, the lockfile, and the worker image in the SBOM.
2. Freeze `DocumentOfficeSnapshotV2`, JSON Schema, request/result manifests, warning codes, options, and limits.
3. Implement the shared file-based worker client with `exec.CommandContext`, cancellation, no-egress isolation, and attempt cleanup.
4. Build pure mapping unit tests, then implement page/style/run/list primitives and block renderers.
5. Implement manifest-only asset injection and reject arbitrary paths and fetches.
6. Add Go durable-job orchestration, exact-revision pinning, idempotency, checksum, validation, sealing, and delivery.
7. Add independent Open XML validation, relationship policy inspection, rendered QA, Word release checks, and LibreOffice compatibility checks.
8. Keep the adapter replaceable; seek a UniOffice quote only after recording a blocking, reproducible `docx.js` gap.
# Sources
- [Taurus Omega Document model](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/document/model.go), [style model](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/document/style.go), [layout model](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/document/layout.go), and [runtime model](https://github.com/gccurtis/taurus-omega/blob/main/docs/architecture/runtime-model.md)
- <mention-page url="https://app.notion.com/p/3acb6410e502817fbde1f33e76f61b82"/>
- [`docx.js`](https://docx.js.org/)[ documentation](https://docx.js.org/), [9.7.1 package](https://www.npmjs.com/package/docx), [API](https://docx.js.org/api/), and [MIT repository](https://github.com/dolanmiu/docx)
- [`docxgo`](https://github.com/mmonterroca/docxgo)[ repository and license/provenance statement](https://github.com/mmonterroca/docxgo)
- [UniOffice product](https://unidoc.io/unioffice/) and [pricing](https://unidoc.io/pricing/)
- [Microsoft Open XML SDK](https://github.com/dotnet/Open-XML-SDK) and [`OpenXmlValidator`](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.validation.openxmlvalidator.validate)
- [Microsoft ](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.lastrenderedpagebreak)[`w:lastRenderedPageBreak`](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.lastrenderedpagebreak)[ reference](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.lastrenderedpagebreak) and [`w:pageBreakBefore`](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.pagebreakbefore)[ reference](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.pagebreakbefore)
- [Apache POI XWPF status](https://poi.apache.org/components/document/index.html) and [Apache-2.0 license](https://poi.apache.org/legal.html)
- [ECMA-376 Office Open XML](https://ecma-international.org/publications-and-standards/standards/ecma-376/)
- [SOL X 78 — Export Pipeline: Office & Native Rendering](https://app.notion.com/p/39ab6410e5028161afcbedc98c3bb809) and [SOL Y 104 — Open-Source Library Decision Matrix](https://app.notion.com/p/39ab6410e50281f18edbd7538ac2e17e)

