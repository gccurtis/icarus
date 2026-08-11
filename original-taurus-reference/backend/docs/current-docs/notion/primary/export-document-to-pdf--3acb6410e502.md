---
title: "Export - Document to PDF"
notion_page_id: "3acb6410e502817fbde1f33e76f61b82"
notion_url: "https://app.notion.com/3acb6410e502817fbde1f33e76f61b82"
project: "Taurus Yesod"
role: "Primary"
format: "Spec"
created: "2026-07-29 13:45:14Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Export - Document to PDF

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Decision:** implement Document → PDF as a durable Taurus Omega export job that pins an exact Document revision, asks the Document capability for a canonical print snapshot, and invokes a sandboxed Python/WeasyPrint worker. Go owns identity, authorization, revision selection, job state, assets, validation, and artifact persistence. The worker owns deterministic painting only.
# Purpose
This specification defines a production path for exporting a Taurus Document to PDF. It is intended to be sufficiently concrete for a coding agent to implement the first complete slice without rediscovering runtime boundaries, pagination rules, library choices, or security constraints.
The exported PDF is a static representation of one authorized, immutable resource revision. Export must not mutate the Document, emit a ChangeSet, advance the canonical head, evaluate prompts, or depend on whichever revision is current when a worker eventually starts.
# Recommendation
Use one replaceable PDF-renderer integration:
- **Default renderer:** Python 3.12 with **WeasyPrint 69.0**, pinned together with Pango, Fontconfig, HarfBuzz, FreeType, and the Taurus font bundle.
- **Structural validator:** **qpdf 12.3.x** using `--check`, followed by Taurus policy inspection.
- **Fallback benchmark:** Chromium through Playwright, maintained in the compatibility corpus but not shipped as the primary renderer.
- **Future alternative:** Typst if later accessibility, archival, or throughput requirements justify a second Taurus-to-layout compiler.
- **Commercial escape hatch:** Prince may be evaluated only if a measured corpus demonstrates that the open-source path cannot satisfy an enterprise requirement.
WeasyPrint is the best default because it is BSD-licensed, built specifically for paged HTML/CSS output, supports CSS Paged Media, embeds and subsets fonts, preserves SVG as vector content, and can produce tagged and PDF/A-family variants. It is not a browser and does not require LibreOffice or Microsoft Office. The implementation must not confuse “the renderer supports a profile flag” with “the resulting file is compliant”; archival and accessibility profiles require independent validation.
Direct PDF libraries are not the default. ReportLab, pdfkit-style primitives, Go PDF libraries, and low-level qpdf APIs would make Taurus own line breaking, glyph shaping, pagination, drawing, links, outlines, and accessibility serialization twice. The Document capability should own semantic layout decisions, while WeasyPrint should own PDF painting and font shaping.
# Scope
## Version 1
- Export one Document resource at one exact revision.
- Preserve the canonical page size, margins, page membership, headers, footers, rows, tracks, styles, text marks, links, images, accepted formulas, and accepted prompt display state.
- Preserve vector text and SVG where possible.
- Generate headings as PDF outline entries where the model provides a heading hierarchy.
- Generate an unencrypted PDF with no attachments, forms, JavaScript, launch actions, or external file references.
- Return structured warnings for fallbacks, overflow, unsupported fonts, and excluded dynamic state.
- Store and serve the artifact using the existing project-scoped job and file boundaries.
## Explicit non-goals
- Importing PDF.
- Exporting comments, presence, selection, undo history, rejected prompt candidates, provider reasoning, evidence payloads, or revision history.
- Re-running formulas or prompts.
- Letting the worker fetch network resources.
- Accepting resource content as raw HTML or CSS.
- Signing or encrypting PDFs in version 1.
- Claiming PDF/A or PDF/UA compliance before an independent validator and accessibility review are integrated.
# Taurus runtime placement
The operation is a **deferred durable job** in the Taurus Omega runtime model:
1. A project-scoped command authorizes the user and resolves the requested Document resource.
2. The command pins an exact revision. “Latest” may be accepted at the API edge, but it must be resolved to a number before the job is committed.
3. The Document capability creates an immutable `DocumentPDFSnapshotV1`.
4. The job materializes a bounded attempt directory containing request JSON, snapshot JSON, and an asset manifest.
5. Go invokes the renderer directly—never through a shell—and enforces deadline, CPU, memory, process, filesystem, and network limits.
6. Go validates the result, computes its digest, stores the derived artifact, and publishes completion.
7. The download endpoint authorizes the caller again and returns the stored artifact.
```plain text
Alpha
  │ POST export request
  ▼
Omega command handler
  ├─ authorize(user, project, resource)
  ├─ resolve exact revision
  ├─ create idempotent durable job
  └─ enqueue
        │
        ▼
PDF export worker
  ├─ resolve DocumentPDFSnapshotV1
  ├─ materialize allowlisted assets
  ├─ exec taurus-pdf-worker render (no shell)
  ├─ qpdf + Taurus policy validation
  ├─ hash and store artifact
  └─ complete job / publish event
```
This follows the project-scoped ownership and deferred-job rules in the [Omega runtime model](https://github.com/gccurtis/taurus-omega/blob/main/docs/architecture/runtime-model.md).
# Integration contracts
The capability-specific snapshot belongs to the Document capability. The subprocess protocol belongs to a shared PDF export integration package.
```go
package pdfexport

type ResourceKind string

const (
	ResourceDocument    ResourceKind = "document"
	ResourceSlides      ResourceKind = "slides"
	ResourceSpreadsheet ResourceKind = "spreadsheet"
)

type Profile string

const (
	ProfileStandard   Profile = "standard"
	ProfileArchive    Profile = "archive"
	ProfileAccessible Profile = "accessible"
)

type ExportRequest struct {
	SchemaVersion  int            `json:"schemaVersion"`
	ProjectID      string         `json:"projectId"`
	ResourceKind   ResourceKind   `json:"resourceKind"`
	ResourceID     string         `json:"resourceId"`
	Revision       int64          `json:"revision"`
	SnapshotSHA256 string         `json:"snapshotSha256"`
	Options        Options        `json:"options"`
	IdempotencyKey string         `json:"idempotencyKey"`
	TraceID        string         `json:"traceId"`
}

type Options struct {
	Profile              Profile `json:"profile"`
	IncludeLinks         bool    `json:"includeLinks"`
	IncludeDocumentTitle bool    `json:"includeDocumentTitle"`
	Language             string  `json:"language,omitempty"`
}

type Renderer interface {
	Render(ctx context.Context, invocation Invocation) (Result, error)
}

type Invocation struct {
	RequestPath  string
	SnapshotPath string
	AssetsPath   string
	OutputPath   string
	ResultPath   string
}

type Result struct {
	SchemaVersion int         `json:"schemaVersion"`
	Status        string      `json:"status"`
	PageCount     int         `json:"pageCount"`
	OutputBytes   int64       `json:"outputBytes"`
	OutputSHA256  string      `json:"outputSha256"`
	Warnings      []Diagnostic `json:"warnings"`
	Metrics       Metrics     `json:"metrics"`
}

type Diagnostic struct {
	Code       string `json:"code"`
	Message    string `json:"message"`
	ResourceID string `json:"resourceId,omitempty"`
	Page       int    `json:"page,omitempty"`
	RowID      string `json:"rowId,omitempty"`
	BlockID    string `json:"blockId,omitempty"`
}
```
The integration implementation must use `exec.CommandContext`. Every argument is a separate argv element.
```go
func (r *SubprocessRenderer) Render(
	ctx context.Context,
	inv pdfexport.Invocation,
) (pdfexport.Result, error) {
	cmd := exec.CommandContext(
		ctx,
		r.binary,
		"render",
		"--request", inv.RequestPath,
		"--snapshot", inv.SnapshotPath,
		"--assets", inv.AssetsPath,
		"--output", inv.OutputPath,
		"--result", inv.ResultPath,
	)
	cmd.Dir = r.emptyWorkingDirectory
	cmd.Env = r.fixedEnvironment()
	cmd.Stdout = io.Discard
	cmd.Stderr = io.LimitWriter(r.diagnosticLog, r.maxDiagnosticBytes)

	if err := r.sandbox.Run(cmd, r.limits); err != nil {
		return pdfexport.Result{}, classifyProcessError(err)
	}
	return readAndValidateResult(inv.ResultPath)
}
```
# Canonical Document print snapshot
The current Document model already owns page layout and derives pages through `Paginate(Base)`. PDF export must preserve that ownership. The renderer must not independently decide that a row belongs on a different page because a font engine measured a glyph differently.
Add an explicit capability projection:
```go
type DocumentPDFSnapshotV1 struct {
	SchemaVersion int                  `json:"schemaVersion"`
	DocumentID    string               `json:"documentId"`
	Revision      int64                `json:"revision"`
	Title         string               `json:"title"`
	Language      string               `json:"language,omitempty"`
	PageLayout    PDFPageLayout        `json:"pageLayout"`
	Pages         []DocumentPDFPage    `json:"pages"`
	Styles        []ResolvedPDFStyle   `json:"styles"`
	Assets        []PDFAssetReference  `json:"assets"`
	Outline       []PDFOutlineEntry    `json:"outline,omitempty"`
}

type PDFPageLayout struct {
	WidthPt        float64 `json:"widthPt"`
	HeightPt       float64 `json:"heightPt"`
	MarginTopPt    float64 `json:"marginTopPt"`
	MarginRightPt  float64 `json:"marginRightPt"`
	MarginBottomPt float64 `json:"marginBottomPt"`
	MarginLeftPt   float64 `json:"marginLeftPt"`
}

type DocumentPDFPage struct {
	Index      int                `json:"index"`
	Header     []DocumentPDFRow   `json:"header,omitempty"`
	Body       []DocumentPDFRow   `json:"body"`
	Footer     []DocumentPDFRow   `json:"footer,omitempty"`
	UsedHeight float64            `json:"usedHeightPt"`
}

type DocumentPDFRow struct {
	RowID          string             `json:"rowId"`
	HeightPt       float64            `json:"heightPt"`
	TrackWidthsPt  []float64          `json:"trackWidthsPt"`
	TrackGapPt     float64            `json:"trackGapPt"`
	Tracks         []DocumentPDFTrack `json:"tracks"`
}

type DocumentPDFTrack struct {
	Blocks []DocumentPDFBlock `json:"blocks"`
}

type DocumentPDFBlock struct {
	BlockID  string          `json:"blockId"`
	Kind     string          `json:"kind"`
	StyleID  string          `json:"styleId,omitempty"`
	Lines    []PDFTextLine   `json:"lines,omitempty"`
	Image    *PDFImage       `json:"image,omitempty"`
	Callout  *PDFCallout     `json:"callout,omitempty"`
	Language string          `json:"language,omitempty"`
	AltText  string          `json:"altText,omitempty"`
}

type PDFTextLine struct {
	HeightPt float64      `json:"heightPt"`
	Runs     []PDFTextRun `json:"runs"`
}

type PDFTextRun struct {
	Text          string  `json:"text"`
	StyleID       string  `json:"styleId"`
	Link          string  `json:"link,omitempty"`
	BaselineShift float64 `json:"baselineShiftPt,omitempty"`
}
```
`ResolveDocumentPDFSnapshot` should:
1. Read the exact Base and revision requested by the job.
2. Resolve style inheritance and typography into concrete values.
3. Call canonical pagination and record page membership by stable row ID.
4. Resolve headers and footers for every page.
5. Perform canonical line breaking and emit lines/runs, or reject export if a block cannot fit its assigned bounds.
6. Resolve accepted formula and prompt display atoms to printable runs without executing anything.
7. Emit logical outline entries from heading blocks.
8. Emit asset references only; the File integration materializes bytes separately.
The strongest contract is to serialize canonical line breaks. If that work is deferred, the first implementation may serialize page membership and block bounds, but it must treat renderer overflow as an error rather than silently repaginating.
# Document-to-PDF mapping
<table header-row="true">
<tr>
<td>Taurus Document concept</td>
<td>PDF projection</td>
<td>Rule</td>
</tr>
<tr>
<td>`PageLayout`</td>
<td>PDF MediaBox and fixed page container</td>
<td>Preserve point dimensions and margins exactly.</td>
</tr>
<tr>
<td>Derived page</td>
<td>One PDF page</td>
<td>Never let the renderer move a row to another page.</td>
</tr>
<tr>
<td>Header/footer rows</td>
<td>Fixed page header/footer regions</td>
<td>Resolve per page before invoking the renderer.</td>
</tr>
<tr>
<td>Row and tracks</td>
<td>Fixed grid with point widths</td>
<td>Preserve track widths, gaps, and row height.</td>
</tr>
<tr>
<td>Body/heading text</td>
<td>Tagged paragraphs/headings when enabled</td>
<td>Escape text; use canonical lines and marks.</td>
</tr>
<tr>
<td>Code</td>
<td>Preformatted block</td>
<td>Preserve whitespace; use bundled monospace font.</td>
</tr>
<tr>
<td>Callout</td>
<td>Styled block with optional icon</td>
<td>No interactive behavior.</td>
</tr>
<tr>
<td>List</td>
<td>Semantic list plus fixed indentation</td>
<td>Preserve numbering/bullets and hierarchy.</td>
</tr>
<tr>
<td>Divider</td>
<td>Vector rule</td>
<td>Use SVG or CSS border.</td>
</tr>
<tr>
<td>Image</td>
<td>Manifest asset</td>
<td>Preserve crop/fit; require alt text warning when absent.</td>
</tr>
<tr>
<td>Formula atom</td>
<td>Accepted display text</td>
<td>Do not evaluate the formula.</td>
</tr>
<tr>
<td>Prompt atom</td>
<td>Accepted display text</td>
<td>Exclude prompt, candidates, evidence, and provider state.</td>
</tr>
<tr>
<td>Hyperlink mark</td>
<td>PDF link annotation</td>
<td>Allow only approved schemes.</td>
</tr>
<tr>
<td>Heading hierarchy</td>
<td>PDF outline</td>
<td>Stable target anchors based on block IDs.</td>
</tr>
<tr>
<td>Comments/presence/history</td>
<td>Omitted</td>
<td>Never part of a static export.</td>
</tr>
</table>
# Worker protocol
The worker is a versioned executable or container image. Large payloads should be referenced by files rather than passed through command-line arguments or a single stdin buffer.
```plain text
taurus-pdf-worker render
  --request /attempt/request.json
  --snapshot /attempt/snapshot.json
  --assets /attempt/assets.json
  --output /attempt/artifact.pdf
  --result /attempt/result.json
```
Example request:
```json
{
  "schemaVersion": 1,
  "projectId": "project_123",
  "resourceKind": "document",
  "resourceId": "document_456",
  "revision": 91,
  "snapshotSha256": "sha256:…",
  "options": {
    "profile": "standard",
    "includeLinks": true,
    "includeDocumentTitle": true,
    "language": "en-US"
  },
  "idempotencyKey": "pdf:document:456:91:…",
  "traceId": "trace_…"
}
```
The asset manifest maps opaque `asset://` URLs to files inside the attempt directory:
```json
{
  "schemaVersion": 1,
  "assets": [
    {
      "id": "asset_7",
      "uri": "asset://asset_7",
      "path": "assets/asset_7.bin",
      "mediaType": "image/png",
      "sha256": "sha256:…",
      "bytes": 482911
    }
  ]
}
```
# Rendering implementation
The Python worker generates Taurus-owned HTML and CSS from typed data. User strings are escaped; style values come from enums or validated numeric/color fields. No raw user HTML, CSS, URL, template, or filesystem path reaches WeasyPrint.
```python
from pathlib import Path
from weasyprint import HTML, CSS

def render_document(request, snapshot, assets, output_path: Path) -> dict:
    fetcher = ManifestFetcher(assets)  # accepts asset:// only
    html = build_document_html(snapshot)
    css = build_document_css(snapshot.pageLayout)

    options = {
        "optimize_images": True,
        "pdf_tags": request["options"]["profile"] == "accessible",
    }
    variant = requested_variant(request["options"]["profile"])
    if variant:
        options["pdf_variant"] = variant

    HTML(
        string=html,
        base_url=None,
        url_fetcher=fetcher,
    ).write_pdf(
        target=output_path,
        stylesheets=[CSS(string=css)],
        **options,
    )
    return inspect_basic_output(output_path)
```
```css
@page {
  size: var(--page-width) var(--page-height);
  margin: 0;
}

.page {
  box-sizing: border-box;
  position: relative;
  width: var(--page-width);
  height: var(--page-height);
  break-after: page;
  overflow: hidden;
}

.row {
  display: grid;
  height: var(--row-height);
  grid-template-columns: var(--track-widths);
  column-gap: var(--track-gap);
}
```
Generated templates should prefer fixed dimensions, block layout, simple grid/table layout, and SVG. Do not depend on browser-only JavaScript, 3D transforms, or elaborate CSS Grid behavior.
# Fonts and deterministic output
The renderer image must pin:
- Python and WeasyPrint.
- Pango, Fontconfig, HarfBuzz, FreeType, and image-decoding libraries.
- The Taurus UI/print fonts: IBM Plex families where licensed and an explicit Noto fallback set for supported scripts.
- HTML/CSS template version.
- locale and timezone (`UTC` unless the snapshot already contains formatted values).
All font files included in the image must have licenses compatible with product distribution. A user-selected font is used only if Omega can materialize an approved, licensed font asset. Otherwise export uses the deterministic fallback and reports `FONT_FALLBACK`.
Byte-for-byte stability is a useful cache property but not a permanent API guarantee across renderer upgrades. Golden files are keyed by the entire render fingerprint.
# Concurrency, idempotency, and persistence
The export job pins `Revision`. It never reads a moving head after enqueue.
```go
type ExportFingerprintInput struct {
	ProjectID            string
	ResourceKind         string
	ResourceID           string
	Revision             int64
	SnapshotSHA256       string
	OptionsCanonicalJSON []byte
	RendererVersion      string
	TemplateVersion      string
	FontBundleVersion    string
}
```
The digest of the canonical structure is the idempotency and cache key. Duplicate requests may join the same running job or reuse a validated artifact. A renderer upgrade creates a new fingerprint.
The artifact record should include:
- project, resource kind, resource ID, and revision;
- requestor and authorization context;
- job and attempt IDs;
- options, snapshot digest, artifact digest, page count, byte count;
- renderer, template, font bundle, and validator versions;
- warnings and validation status;
- storage key, expiry/retention policy, and creation timestamp.
The artifact is derived data. It does not replace the resource Base and does not participate in ChangeSet reconciliation.
# Security boundaries
WeasyPrint’s default URL behavior can read files and fetch network resources; Taurus must replace that behavior.
- Run as an unprivileged user in a disposable sandbox/container.
- Disable outbound network.
- Mount only the attempt directory read-only, except for the exact output/result paths.
- Permit only manifest-backed `asset://<opaque-id>` reads.
- Reject `file:`, `http:`, `https:`, `ftp:`, UNC paths, absolute paths, relative traversal, and unbounded `data:` URIs in the renderer.
- Escape all user strings.
- Generate CSS from validated values; reject NaN, infinity, negative dimensions, extreme sizes, and unrecognized color/font tokens.
- Enforce request, snapshot, asset, image-pixel, page-count, output-size, CPU, memory, open-file, and wall-clock limits.
- Never pass secrets, database credentials, project storage credentials, or provider tokens to the subprocess.
- Do not invoke a shell.
- Treat SVG as active input: sanitize it upstream or generate it from trusted Taurus chart/equation renderers.
- Redact user content from ordinary logs. Diagnostics use stable IDs and codes.
# Validation and PDF policy
Validation occurs after the renderer exits and before persistence:
1. Require a regular file within the attempt directory and enforce byte limit.
2. Require the PDF header and terminal structure.
3. Run `qpdf --check artifact.pdf`; exit `0` is required. Warnings (`3`) are a policy decision and should fail in production until explicitly allowlisted.
4. Inspect the object graph for encryption, embedded files, AcroForms, JavaScript, launch actions, remote-go-to actions, external file specifications, and disallowed URI schemes.
5. Verify page count and MediaBox against the snapshot.
6. Verify metadata contains only intended fields.
7. Compute SHA-256 after validation.
8. In CI, rasterize with a pinned test-only PDF renderer and compare visual fixtures.
qpdf validates PDF syntax and structure, not visual correctness or standards compliance. Keep these gates separate.
# Output profiles
<table header-row="true">
<tr>
<td>Profile</td>
<td>Version 1 behavior</td>
<td>Compliance statement</td>
</tr>
<tr>
<td>`standard`</td>
<td>Unencrypted PDF, vector text/SVG, embedded subset fonts, links and outline when enabled</td>
<td>Supported default</td>
</tr>
<tr>
<td>`archive`</td>
<td>Render PDF/A-2b candidate, then require a dedicated PDF/A validator</td>
<td>Experimental until validation is integrated</td>
</tr>
<tr>
<td>`accessible`</td>
<td>Render tagged PDF candidate using semantic HTML and alt text, then require PDF/UA validation and manual testing</td>
<td>Experimental; do not advertise compliance</td>
</tr>
</table>
Document is the strongest candidate for accessible output because headings, paragraphs, lists, links, language, and alt text map naturally to semantic HTML. Missing alt text, ambiguous reading order, or unsupported semantic blocks must produce actionable warnings or fail a strict accessible request.
# Errors and observability
Use stable error families:
- `PDF_EXPORT_UNAUTHORIZED`
- `PDF_EXPORT_REVISION_NOT_FOUND`
- `PDF_EXPORT_SNAPSHOT_INVALID`
- `PDF_EXPORT_ASSET_MISSING`
- `PDF_EXPORT_FONT_FALLBACK`
- `PDF_EXPORT_CANONICAL_OVERFLOW`
- `PDF_EXPORT_LIMIT_EXCEEDED`
- `PDF_EXPORT_RENDER_TIMEOUT`
- `PDF_EXPORT_RENDER_FAILED`
- `PDF_EXPORT_STRUCTURAL_INVALID`
- `PDF_EXPORT_POLICY_REJECTED`
- `PDF_EXPORT_PROFILE_INVALID`
Metrics should include queue latency, snapshot time, asset bytes, render time, peak worker memory, validation time, pages, output bytes, warning counts, failures by code, and cache hits. Trace fields use project/resource/job/attempt/revision IDs without raw content.
# Test plan
## Contract tests
- JSON schema compatibility and unknown-field behavior.
- Revision pinning and “latest” resolution at enqueue time.
- Idempotency under retries and concurrent duplicate requests.
- Cancellation and timeout handling.
- Asset manifest traversal and scheme rejection.
## Capability tests
- Canonical page row IDs exactly match `Paginate(Base)`.
- Header/footer selection and page count.
- Row height, track width, page break, and keep-with-next behavior.
- Accepted formula/prompt display values are exported without evaluation.
- Missing or unaccepted dynamic values follow one documented placeholder policy.
## Rendering corpus
- headings, paragraphs, mixed marks, lists, code, callouts, dividers;
- headers, footers, page numbers, multiple page sizes and margins;
- tracks and long content at boundary conditions;
- images, SVG, Unicode, RTL, CJK, emoji fallback, ligatures;
- internal/external links and outline destinations;
- very long documents and maximum allowed image dimensions.
## Assertions
- exact page count and MediaBox;
- page-to-row membership;
- text extraction for expected strings;
- link and outline destinations;
- no forbidden PDF objects/actions;
- visual regression within a bounded perceptual threshold;
- deterministic result for identical pinned dependencies and fingerprint.
# Delivery sequence
1. Define shared PDF request/result schemas and the renderer integration port.
2. Add `ResolveDocumentPDFSnapshotV1` with exact revision semantics.
3. Serialize canonical page membership, styles, assets, and outline.
4. Add canonical line/run projection; make overflow fatal until it exists.
5. Implement the sandboxed Python/WeasyPrint worker and manifest-only fetcher.
6. Implement qpdf and Taurus policy validation.
7. Store/download the derived artifact through project-scoped authorization.
8. Build the golden corpus and benchmark WeasyPrint against Chromium.
9. Add accessible/archive profiles only after validators exist.
# Acceptance criteria
- An authorized user can request and download a PDF for an exact Document revision.
- Concurrent edits after enqueue do not affect the result.
- Page membership matches the Document capability’s canonical pagination.
- No export mutation or ChangeSet is produced.
- The worker has no network, credentials, database access, or arbitrary filesystem access.
- Identical fingerprints reuse the same validated artifact.
- Unsupported or lossy behavior is surfaced through structured diagnostics.
- Output passes structural and policy validation.
# Sources
- [Taurus Omega runtime model](https://github.com/gccurtis/taurus-omega/blob/main/docs/architecture/runtime-model.md)
- [Taurus Document model](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/document/model.go)
- [Taurus Document layout and pagination](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/document/layout.go)
- [Taurus Document styles](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/document/style.go)
- [Current Document import/export handler](https://github.com/gccurtis/taurus-omega/blob/main/core/handlers/document/importexport.go)
- [Export - Document to DOCX](https://app.notion.com/p/3acb6410e5028134aedfe63676d5418c)
- [WeasyPrint 69.0 documentation](https://doc.courtbouillon.org/weasyprint/stable/)
- [WeasyPrint API and supported features](https://doc.courtbouillon.org/weasyprint/stable/api_reference.html)
- [WeasyPrint source and BSD-3-Clause license](https://github.com/Kozea/WeasyPrint)
- [Playwright ](https://playwright.dev/docs/api/class-page)[`page.pdf`](https://playwright.dev/docs/api/class-page)[ reference](https://playwright.dev/docs/api/class-page)
- [Typst PDF reference](https://typst.app/docs/reference/pdf/)
- [qpdf CLI validation reference](https://qpdf.readthedocs.io/en/stable/cli.html)
- [qpdf source and Apache-2.0 license](https://github.com/qpdf/qpdf)

