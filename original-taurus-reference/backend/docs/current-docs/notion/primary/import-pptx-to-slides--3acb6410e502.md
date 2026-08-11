---
title: "Import - PPTX to Slides"
notion_page_id: "3acb6410e5028108b8bdc90ce4eeec9c"
notion_url: "https://app.notion.com/3acb6410e5028108b8bdc90ce4eeec9c"
project: "Taurus Yesod"
role: "Primary"
format: "Spec"
created: "2026-07-29 05:49:08Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Import - PPTX to Slides

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Reviewed decision · Import only · Research refreshed: 2026-07-29.** Use a file-based Python worker to turn one hostile `.pptx` into a versioned, parser-neutral JSON deck draft plus bounded assets and diagnostics. Go remains the sole authority that decodes, validates, assigns stable IDs/ranks, creates the Deck base, records provenance, and commits. Import is a static best-effort projection; animations and unsupported PowerPoint behavior are dropped.
# Executive decision
Use [`python-pptx`](https://pypi.org/project/python-pptx/)[ 1.0.2](https://pypi.org/project/python-pptx/) as the default PPTX parser in an isolated Python import worker. It is MIT, runs on Linux without PowerPoint, and provides a mature high-level read model for slide geometry, z-ordered shapes, text, pictures, tables, charts, groups, and notes. Taurus stores slide geometry in integer EMUs, which matches the units exposed by `python-pptx`; ordinary object placement can therefore be imported without unit loss.
The importer reconstructs a static Taurus deck. **Animations are permanently out of scope and are always dropped.** Transitions, timing, triggers, media playback, narration, and slide-show behavior are also dropped in V1. The importer does not preserve these features as hidden XML and does not promise later recovery.
Keep [ShapeCrawler 0.79.4](https://github.com/ShapeCrawler/ShapeCrawler) as a future .NET alternative only if a fixture spike demonstrates a blocking `python-pptx` gap in static object parsing. Do not select a newer or broader parser on feature claims alone; the replacement must beat `python-pptx` on the Taurus corpus, licensing, security, maintenance, and deployment cost.
Keep [UniOffice](https://unidoc.io/unioffice/) as the commercial pure-Go fallback if customer decks expose material static-fidelity gaps. Do not use PptxGenJS for import: it is the selected exporter, not a PPTX parser.
# Governing import law
1. V1 creates a new Deck and never merges into an existing one.
2. Import the static content that maps cleanly to `Deck → SlideSection → Slide → VisualObject`.
3. Slides remain unnamed. The server assigns stable SlideIDs and ordered ranks; it never synthesizes names from titles or Office metadata.
4. Unsupported content is skipped with stable diagnostics. A single unsupported object never blocks an otherwise useful deck.
5. Do not rasterize an entire slide as a substitute for an editable object model.
6. Import completes only after the whole canonical draft and every accepted asset validate.
The canonical destination is [Model — Slides Capability & Runtime Contract](https://app.notion.com/p/3abb6410e50281df8762c162e9a6eb13). The runtime and access boundary is the [Taurus Omega runtime model](https://github.com/gccurtis/taurus-omega/blob/main/docs/architecture/runtime-model.md).
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
<td>[`python-pptx`](https://python-pptx.readthedocs.io/en/stable/)[ 1.0.2](https://python-pptx.readthedocs.io/en/stable/)</td>
<td>MIT; Python</td>
<td>Reads and updates PPTX; EMU geometry; z-ordered shapes; text, pictures, tables, charts, groups, notes</td>
<td>Does not cover every PowerPoint feature; isolated Python worker required</td>
<td>**Default**</td>
</tr>
<tr>
<td>[ShapeCrawler 0.79.4](https://github.com/ShapeCrawler/ShapeCrawler)</td>
<td>MIT; .NET</td>
<td>High-level PowerPoint object model over Open XML SDK</td>
<td>Adds .NET and must prove a corpus advantage</td>
<td>**Future comparison spike**</td>
</tr>
<tr>
<td>[UniOffice](https://unidoc.io/unioffice/)</td>
<td>Commercial; pure Go</td>
<td>Unified offline API and vendor support</td>
<td>Quote-based license/terms</td>
<td>**Commercial fallback**</td>
</tr>
<tr>
<td>[Open XML SDK](https://github.com/dotnet/Open-XML-SDK)</td>
<td>MIT; .NET</td>
<td>Complete low-level OOXML access and validation</td>
<td>Large owned mapping surface; not a productivity-level importer</td>
<td>**Validator/forensics only**</td>
</tr>
<tr>
<td>[`PptxGenJS`](https://github.com/gitbrent/PptxGenJS)</td>
<td>MIT; TypeScript/JavaScript</td>
<td>Strong PPTX generation</td>
<td>Not an importer</td>
<td>**Export only**</td>
</tr>
</table>
# Runtime architecture
PPTX import is a deferred durable job:
```plain text
POST /slides/import?format=pptx
  → authorize (user, project)
  → persist immutable source File + SHA-256
  → enqueue slides.import.pptx
  → inspect package and enforce ZIP/media/XML limits
  → isolated Python worker parses static presentation
  → worker emits versioned DeckImportDraft + bounded assets
  → Go adapter normalizes IDs/ranks and validates canonical model
  → File capability ingests accepted media
  → Slides capability creates one Deck transactionally
  → Resource registration + provenance + diagnostics
```
```plain text
core/capability/slides/                canonical model and import port
core/integration/office/pptx/import/   Go job adapter, DTO validation, commit
workers/office-py/pptx-import/         python-pptx parser only
workers/office-py/contracts/           versioned JSON/NDJSON DTOs
tests/fixtures/office/pptx-import/     golden, lossy, producer, hostile fixtures
```
The worker has no database or project authority. It receives an attempt-local read-only path and writes a bounded draft plus asset files to an attempt-local output directory.
# Process and JSON boundary
The Python process is an untrusted parser adapter, not a Slides service. It does not receive project, user, database, object-store, or canonical identity authority. Go invokes the pinned executable directly with `exec.CommandContext`, never through a shell:
```plain text
taurus-office-py-worker import --format pptx \
  --request /attempt/request.json \
  --source /attempt/input/source.pptx \
  --output /attempt/output \
  --result /attempt/result.json
```
The worker writes bounded asset files and a parser-neutral `deck.json`, then atomically writes `result.json` last as the completion sentinel. Standard output and error are bounded operational logs only.
```json
{
  "schemaVersion": 2,
  "format": "pptx",
  "sourceSha256": "<hex>",
  "parser": {"name": "python-pptx", "version": "1.0.2"},
  "draft": {"uri": "draft://deck.json", "sha256": "<hex>", "bytes": 45678},
  "assets": [
    {"id": "asset-7", "uri": "asset://asset-7", "sha256": "<hex>", "mediaType": "image/png", "bytes": 4096}
  ],
  "diagnostics": [],
  "counts": {"slides": 12, "objects": 87, "assets": 6}
}
```
`deck.json` contains canvas geometry, source-order slides, source-local object paths, static object payloads, notes, asset tokens, and diagnostics. It contains no Taurus DeckID, SlideID, SectionID, VisualObjectID, FileID, revision, rank token, project, author, database key, or Python path.
```go
type PptxWorkerResultV2 struct {
    SchemaVersion int                `json:"schemaVersion"`
    Format        string             `json:"format"`
    SourceSHA256  string             `json:"sourceSha256"`
    Parser        ParserIdentity      `json:"parser"`
    Draft         CheckedFileRef      `json:"draft"`
    Assets        []CheckedAssetRef   `json:"assets"`
    Diagnostics   []ImportDiagnostic `json:"diagnostics"`
    Counts        map[string]int64    `json:"counts"`
}

func decodePptxWorkerResult(r io.Reader, maxBytes int64) (PptxWorkerResultV2, error) {
    dec := json.NewDecoder(io.LimitReader(r, maxBytes))
    dec.DisallowUnknownFields()
    var out PptxWorkerResultV2
    if err := dec.Decode(&out); err != nil { return out, err }
    if err := requireJSONEOF(dec); err != nil { return out, err }
    return out, validatePptxWorkerEnvelope(out)
}
```
Go verifies the schema/format/source/parser/policy identity, validates the generated JSON Schema, enforces all counts and geometry bounds, and resolves only owned `draft://` and `asset://` URIs beneath the attempt root. It rejects absolute paths, `..`, symlink escapes, duplicate IDs, undeclared files, digest/size/media mismatches, non-finite numbers, unknown object kinds, trailing JSON, and worker-supplied canonical identities.
After accepted media become project-scoped Files, Go substitutes FileIDs and derives deterministic canonical identities from `(source SHA-256, source slide locator, source object path, kind)`. The Slides capability assigns canonical ranks and validates the complete `slides.ImportDraft` before a single transaction makes the Deck visible.
# Capability and worker contracts
```go
type PptxImportRequest struct {
    ProjectID      string
    UserID         string
    SourceFileID   string
    SourceSHA256   string
    IdempotencyKey string
}

type PptxSourceLocator struct {
    SlideOrdinal int
    ShapePath    []int // nested group ordinals
    PartPath     string
    RelationID   string
}

type DeckImportDraft struct {
    SchemaVersion int
    SuggestedName string
    Canvas        slides.Canvas
    Theme         slides.DeckTheme
    Sections      []slides.SlideSection
    Slides        []slides.ImportSlide
    Assets        []ImportedAsset
    Diagnostics   []ImportDiagnostic
}

type SlidesImporter interface {
    CreateImportedDeck(
        ctx context.Context,
        scope slides.Scope,
        author slides.Author,
        draft slides.ImportDraft,
        provenance slides.ImportProvenance,
    ) (slides.Deck, error)
}
```
```python
@dataclass(frozen=True)
class PptxImportRequestV2:
    schema_version: Literal[2]
    source_sha256: str
    mapping_policy_version: str
    max_slides: int
    max_shapes: int
    max_text_bytes: int
    max_media_bytes: int
    max_image_pixels: int
    max_group_depth: int

@dataclass(frozen=True)
class PptxDeckDraftV2:
    schema_version: Literal[2]
    suggested_name: str
    width_emu: int
    height_emu: int
    slides: list["ImportSlide"]
    assets: list["ImportAssetToken"]
    diagnostics: list["ImportDiagnostic"]
```
Stable canonical IDs are assigned in Go. Use a deterministic namespace over source hash, source part, and source-local path so a retry produces the same IDs before idempotent commit:
```go
func ImportedObjectID(sourceSHA, locator, kind string) string {
    return UUIDv5(importNamespace, sourceSHA+"\x00"+locator+"\x00"+kind)
}
```
Ranks derive from source order and are then canonicalized by the Slides capability. Slide IDs remain stable if their position changes after import.
# Static deck mapping
## Deck, canvas, slides, and sections
<table header-row="true">
<tr>
<td>PowerPoint</td>
<td>Taurus</td>
<td>Rule</td>
</tr>
<tr>
<td>presentation filename/core title</td>
<td>Deck name suggestion</td>
<td>Sanitize; fall back to `Imported presentation`.</td>
</tr>
<tr>
<td>`slide_width`, `slide_height`</td>
<td>canvas EMUs</td>
<td>Preserve exact positive values within configured bounds.</td>
</tr>
<tr>
<td>slide ordinal</td>
<td>Slide rank</td>
<td>Assign deterministic rank in source order.</td>
</tr>
<tr>
<td>PowerPoint slide ID</td>
<td>provenance locator only</td>
<td>Generate a Taurus stable ID; Office IDs are not trusted as global identity.</td>
</tr>
<tr>
<td>hidden slide</td>
<td>hidden state when reliably exposed</td>
<td>Otherwise import visible and warn; never drop its content silently.</td>
</tr>
<tr>
<td>PowerPoint sections</td>
<td>unsectioned in V1</td>
<td>`python-pptx` has no stable high-level section API; do not add fragile private-XML parsing only for grouping.</td>
</tr>
<tr>
<td>slide layout/master</td>
<td>simplified layout intent</td>
<td>Import content-bearing placeholders and simple background/theme values; do not reconstruct the full Office master graph.</td>
</tr>
</table>
Slides are unnamed by contract. Do not use a title placeholder as a slide name.
## Z-order and shape traversal
`python-pptx` documents that `slide.shapes` is ordered from backmost to frontmost. Traverse in that order and assign stable `ZRank` values.
```python
def import_shape_tree(shape_tree, parent_transform, locator):
    for ordinal, shape in enumerate(shape_tree):
        path = locator + [ordinal]
        absolute = compose_transform(parent_transform, frame_of(shape))
        if shape.shape_type == MSO_SHAPE_TYPE.GROUP:
            yield import_group_or_flatten(shape, absolute, path)
        else:
            yield import_static_shape(shape, absolute, path)
```
Prefer a canonical group object when every child and transform is supported. Otherwise flatten children into the slide using composed absolute frames, retain their relative z-order, and record `PPTX_GROUP_FLATTENED`.
Reject invalid or overflowed geometry. Clamp tiny floating-point artifacts at the worker boundary, but preserve integer EMUs wherever the source provides them.
# Visual object mapping
<table header-row="true">
<tr>
<td>PPTX shape/object</td>
<td>Taurus `VisualObject`</td>
<td>V1 rule</td>
</tr>
<tr>
<td>text box/content placeholder</td>
<td>`text`</td>
<td>Preserve text blocks, paragraphs, runs, bullets, alignment, insets, and basic fit policy.</td>
</tr>
<tr>
<td>AutoShape</td>
<td>`shape`</td>
<td>Preserve supported preset, fill, line, rotation, and contained text.</td>
</tr>
<tr>
<td>connector/line</td>
<td>`line`</td>
<td>Preserve endpoints/frame, line style, and supported arrowheads.</td>
</tr>
<tr>
<td>picture</td>
<td>`image`</td>
<td>Extract embedded bytes through File capability; preserve frame, crop when exposed, rotation, and alt text.</td>
</tr>
<tr>
<td>table</td>
<td>`table`</td>
<td>Preserve rectangular cells, spans, text, fills, borders, and row/column geometry within limits.</td>
</tr>
<tr>
<td>supported native chart</td>
<td>`chart`</td>
<td>Reconstruct a typed Taurus chart only when chart type, categories, series, and bindings are fully readable.</td>
</tr>
<tr>
<td>group</td>
<td>`group` or flattened children</td>
<td>Preserve group only when transform semantics validate.</td>
</tr>
<tr>
<td>equation</td>
<td>plain text if exposed; otherwise skip</td>
<td>Do not invent an image or formula expression.</td>
</tr>
<tr>
<td>OLE/embed/SmartArt/3D/model/media</td>
<td>skip</td>
<td>No editable Taurus analogue in V1.</td>
</tr>
</table>
## Text
Use paragraphs and runs exposed by each shape's text frame. Empty placeholders with no user-visible content are skipped.
Map:
- run font family, size, bold, italic, underline, strike, color;
- paragraph alignment, level, bullet/number intent, spacing where unambiguous;
- vertical anchor, text-frame margins, word wrap, and supported fit intent;
- valid `https`, `http`, and `mailto` hyperlinks;
- line breaks and paragraphs;
- theme font/color references after resolving them to concrete values.
Do not import comments, review authors, fields, dynamic date/slide-number placeholders, or prompt behavior. A dynamic field may become its visible cached text only.
```python
def text_run(run) -> ImportTextRun:
    return ImportTextRun(
        text=normalize_text(run.text),
        font=resolved_font(run.font),
        hyperlink=safe_hyperlink(run),
    )
```
If a text shape contains unsupported inline objects, preserve the readable text around them and diagnose the omitted portion.
## Shapes, fills, and lines
Map only well-defined static paint:
- solid fill;
- simple supported gradient when the Taurus paint model can represent it exactly enough;
- no fill;
- solid line, width, opacity, dash, and common arrowheads;
- simple supported shadow if the destination model already defines it.
Pattern fills, picture fills not exposed as ordinary pictures, complex gradients, artistic effects, bevel, glow, soft edges, 3D extrusion, and custom geometry are dropped or simplified. Do not create raster snapshots for ordinary unsupported decorations.
Unknown AutoShape geometry may become a rectangle containing preserved text only when that remains honest and useful; otherwise skip it.
## Images
`python-pptx` exposes picture bytes through the image blob. The worker stages bytes; Go ingests them through the File capability.
- Validate magic bytes independently from extension/content type.
- Enforce compressed bytes, decoded pixels, dimensions, and cumulative media limits.
- Preserve PNG/JPEG/GIF first frame and safe SVG according to the shared image policy.
- Never resolve external image relationships.
- Deduplicate identical bytes within the attempt by SHA-256.
- Preserve alt text when it is exposed; otherwise leave it empty rather than deriving it from filenames.
- Import supported crop rectangles; skip artistic effects and recoloring.
## Tables
Import native PowerPoint tables when:
- dimensions and cell count are below limits;
- merge spans are internally consistent;
- every cell has supported text;
- geometry is non-negative and bounded.
Preserve cell text, spans, basic fills, borders, padding, alignment, row heights, and column widths. Drop formulas, embedded charts, unsupported diagonal borders, and complex theme effects. A malformed table is skipped as one object; it does not fail the deck.
## Charts
Import a chart only when all of the following hold:
- its chart type maps to a current Taurus `ChartSpec`;
- categories and every series value can be read without executing Excel;
- the data is static or references the chart's embedded workbook cache;
- series count and point count are within limits;
- axis, legend, title, and number-format semantics have a supported subset.
Area, bar/column, line, pie/doughnut, scatter, and simple combo charts are candidates. 3D, stock, surface, radar variants without a Taurus equivalent, pivot charts, external-workbook bindings, trendlines, error bars, and custom extensions are skipped.
```python
def import_chart(shape, locator):
    chart = shape.chart
    chart_type = map_supported_chart_type(chart.chart_type)
    if chart_type is None:
        return dropped("PPTX_CHART_TYPE_DROPPED", locator)
    series = read_cached_series(chart)
    if series is None:
        return dropped("PPTX_CHART_DATA_UNAVAILABLE", locator)
    return ImportChartObject(type=chart_type, series=series)
```
Do not call Office or a spreadsheet engine to calculate chart data. If cached data is absent or ambiguous, skip the chart.
## Notes
Import speaker notes exposed through `notes_slide.notes_text_frame` into the slide's notes `TextBlock`. Remove empty placeholder text and PowerPoint boilerplate. Preserve basic paragraphs and marks; drop note-page layout, headers, footers, images, review comments, and timing.
# Permanent animation exclusion
Animations are not a degraded feature; they are outside the Taurus Slides product model.
- Ignore animation timing trees, effects, triggers, motion paths, build sequences, morph data, and media triggers.
- Do not store source animation XML in provenance or extension metadata.
- Do not rasterize animation endpoints.
- Do not fail the import because animations exist.
- Emit one coalesced `PPTX_ANIMATIONS_DROPPED` diagnostic with affected-slide count when detected during package inspection.
Transitions, autoplay, rehearsal timing, kiosk behavior, narration, audio, and video playback are similarly dropped in V1. They may use separate diagnostic codes, but none becomes canonical state.
# Other explicitly skipped features
<table header-row="true">
<tr>
<td>Source feature</td>
<td>V1 behavior</td>
<td>Diagnostic</td>
</tr>
<tr>
<td>slide sections</td>
<td>all slides import unsectioned</td>
<td>`PPTX_SECTIONS_DROPPED`</td>
</tr>
<tr>
<td>full master/layout inheritance</td>
<td>import content-bearing placeholders and simple resolved styling only</td>
<td>`PPTX_MASTER_SIMPLIFIED`</td>
</tr>
<tr>
<td>comments/review metadata</td>
<td>drop</td>
<td>`PPTX_REVIEW_STATE_DROPPED`</td>
</tr>
<tr>
<td>SmartArt/diagram</td>
<td>skip</td>
<td>`PPTX_SMARTART_DROPPED`</td>
</tr>
<tr>
<td>OLE/embedded package</td>
<td>skip; never execute or extract recursively</td>
<td>`PPTX_EMBED_DROPPED`</td>
</tr>
<tr>
<td>audio/video/narration</td>
<td>skip</td>
<td>`PPTX_MEDIA_DROPPED`</td>
</tr>
<tr>
<td>macros/ActiveX</td>
<td>reject macro-enabled formats; skip active content</td>
<td>`PPTX_ACTIVE_CONTENT_REJECTED`</td>
</tr>
<tr>
<td>password-protected package</td>
<td>reject in V1</td>
<td>`PPTX_ENCRYPTED_UNSUPPORTED`</td>
</tr>
<tr>
<td>external relationships</td>
<td>never fetch</td>
<td>`PPTX_EXTERNAL_RELATIONSHIP_DROPPED`</td>
</tr>
<tr>
<td>custom XML/extensions</td>
<td>skip</td>
<td>`PPTX_EXTENSION_DROPPED`</td>
</tr>
</table>
# Package inspection, limits, and failure policy
Inspect before Python:
```go
type PptxImportLimits struct {
    OfficeZipLimits
    MaxSlides          int
    MaxShapes          int
    MaxShapesPerSlide  int
    MaxGroupDepth      int
    MaxTextBytes       int64
    MaxMediaBytes      int64
    MaxImagePixels     int64
    MaxChartPoints     int
    MaxTableCells      int
}
```
Reject invalid content types, missing presentation parts, encryption, traversal/duplicate entries, DTD/entity behavior, ZIP bombs, limit overflow, worker timeout/crash, or a deck with zero valid slides. A valid empty slide is meaningful; an entirely unparseable presentation is not.
Skip individual unsupported or malformed shapes and continue. The import result can be partial at the object level, never partial at the Deck persistence level.
# Diagnostics
```go
const (
    DiagPptxAnimationsDropped   = "PPTX_ANIMATIONS_DROPPED"
    DiagPptxTransitionsDropped  = "PPTX_TRANSITIONS_DROPPED"
    DiagPptxMasterSimplified    = "PPTX_MASTER_SIMPLIFIED"
    DiagPptxGroupFlattened      = "PPTX_GROUP_FLATTENED"
    DiagPptxChartTypeDropped    = "PPTX_CHART_TYPE_DROPPED"
    DiagPptxSmartArtDropped     = "PPTX_SMARTART_DROPPED"
    DiagPptxMediaDropped        = "PPTX_MEDIA_DROPPED"
)
```
The receipt reports slide/object/text/image/table/chart/note counts, diagnostic counts, affected slide ordinals, and the created Deck ID. Diagnostics never imply that unsupported content remains recoverable inside the Deck.
# Commit, persistence, and concurrency
The complete draft is validated before any Deck is visible:
```go
func (s *Slides) CreateImported(
    scope Scope,
    author Author,
    draft ImportDraft,
    provenance ImportProvenance,
) (Deck, error) {
    // validate canvas, stable IDs, ranks, frames, object types, and FileIDs
    // idempotency lookup
    // transaction:
    //   insert deck with Revision=0, BaseSeq=0
    //   insert canonical base projection
    //   insert provenance and diagnostics
    //   register resource
}
```
Do not create one ChangeSet per shape. The imported Deck begins as one base snapshot at `Revision=0`, `BaseSeq=0` unless the capability standardizes on a single server-owned `apply_import_result` ChangeSet for all resource types. Subsequent edits use the ordinary Slides operation surface.
The durable job is at-least-once. Idempotency includes project, source FileID/hash, `python-pptx` version, worker contract version, mapping-policy version, and caller key. Repeating the same attempt returns the same Deck and receipt.
Provenance stores source FileID/hash, package metadata needed for support, importer versions, policy version, timestamps, and diagnostics. It does not store arbitrary source XML on the canonical Deck.
# Security and privacy
- Launch the pinned Python executable directly with `exec.CommandContext`; never invoke a shell or accept user-controlled argv.
- Worker sandbox: no network, database, project storage, Office application, reusable credentials, provider keys, or ambient filesystem access.
- Read-only attempt input; write-only bounded attempt output.
- Hard CPU, wall-clock, RSS, output, file-count, and process limits.
- Preflight ZIP/XML/media limits in Go before loading `python-pptx`.
- Pin `python-pptx`, `lxml`, and Pillow transitively with hashes; scan and update deliberately.
- Reject external relationships and active/macro-enabled formats.
- Validate every staged image independently.
- Never execute OLE, macros, actions, hyperlinks, launch targets, media, or embedded packages.
- Log only normalized diagnostic codes and bounded sanitized locators.
- Ingest assets through the File capability under the authorized project.
# Validation and tests
Fixture tiers:
1. **Canonical:** canvas sizes, title/body text, bullets, shapes, connectors, pictures, tables, groups, common charts, notes, z-order.
2. **Loss:** sections, masters, SmartArt, OLE, animation, transition, audio/video, 3D, unsupported charts, equations, hidden slides.
3. **Producer:** current PowerPoint on Windows/macOS, LibreOffice Impress, Google Slides download, Keynote export.
4. **Adversarial:** ZIP bombs, traversal/duplicate entries, malformed XML/relationships, corrupt images, deep groups, huge tables/charts, dangerous links, timeout files.
Golden assertions target the canonical Deck draft, stable IDs, object frames/z-order, asset hashes, and diagnostic codes.
```python
def test_animations_are_never_canonicalized():
    draft = import_fixture("animated-deck.pptx")
    assert not contains_animation_state(draft)
    assert has_diag(draft, "PPTX_ANIMATIONS_DROPPED")

def test_slide_ids_do_not_depend_on_visible_name():
    draft = import_fixture("ordinary-deck.pptx")
    assert all(slide.id for slide in draft.slides)
    assert all(not hasattr(slide, "name") for slide in draft.slides)
```
Acceptance criteria:
- common static slides are editable after import;
- exact canvas geometry and ordinary object frames remain in EMUs;
- slide/object order is deterministic;
- slides have stable IDs and no names;
- animations never enter the canonical model;
- unsupported objects are skipped without blocking supported content;
- no partial Deck is visible;
- repeated jobs are deterministic and idempotent;
- hostile packages fail before commit.
# Implementation sequence
1. Implement common Office package inspection, diagnostics, provenance, durable jobs, attempt directories, and the file-based worker client.
2. Freeze `PptxImportRequestV2`, `PptxWorkerResultV2`, the parser-neutral deck schema, URI rules, manifests, diagnostic taxonomy, and limits.
3. Pin Python, python-pptx 1.0.2, lxml, and Pillow with hashes; record licenses, SBOM, worker image, and no-egress profile.
4. Add the Slides capability `CreateImportedDeck` operation and transactional canonical-base store path.
5. Map canvas, source slide order, text, shapes, lines, images, z-order, notes, groups, tables, and the narrow supported-chart subset.
6. Add strict Go decoding, JSON Schema validation, digest/path validation, FileID substitution, deterministic ID assignment, rank canonicalization, and full proposal validation.
7. Add package-level animation/transition/media detection for coalesced diagnostics only.
8. Add idempotency, Resource registration, receipts, cancellation, process limits, and the complete producer/hostile corpus.
9. Compare ShapeCrawler 0.79.4 or a commercial library only against measured failing fixtures.
# Sources and related Taurus specifications
- [`python-pptx`](https://python-pptx.readthedocs.io/en/stable/)[ documentation](https://python-pptx.readthedocs.io/en/stable/) and [PyPI 1.0.2 release/license metadata](https://pypi.org/project/python-pptx/)
- [ShapeCrawler 0.79.4 source, documentation, and MIT license](https://github.com/ShapeCrawler/ShapeCrawler)
- [`python-pptx`](https://pypi.org/project/python-pptx/)[ PyPI release and license](https://pypi.org/project/python-pptx/)
- [`python-pptx`](https://python-pptx.readthedocs.io/en/stable/api/shapes.html)[ shape API](https://python-pptx.readthedocs.io/en/stable/api/shapes.html)
- [`python-pptx`](https://python-pptx.readthedocs.io/en/stable/api/slides.html)[ slide and notes API](https://python-pptx.readthedocs.io/en/stable/api/slides.html)
- [Model — Slides Capability & Runtime Contract](https://app.notion.com/p/3abb6410e50281df8762c162e9a6eb13)
- [Taurus Omega runtime model](https://github.com/gccurtis/taurus-omega/blob/main/docs/architecture/runtime-model.md)
- [Export - Slides to PPTX](https://app.notion.com/p/3acb6410e5028156bee8c6cca9f2ab87)

