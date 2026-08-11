---
title: "Export - Slides to PDF"
notion_page_id: "3acb6410e50281419ce6ed5fd51edf09"
notion_url: "https://app.notion.com/3acb6410e50281419ce6ed5fd51edf09"
project: "Taurus Yesod"
role: "Primary"
format: "Spec"
created: "2026-07-29 13:45:14Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Export - Slides to PDF

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Decision:** implement Slides → PDF through the same sandboxed Python/WeasyPrint worker used by Document export. The Slides capability resolves a static, revision-pinned paint snapshot; the worker emits one exact-size PDF page per included slide. Go remains responsible for authorization, job coordination, assets, validation, and persistence.
# Purpose
This specification defines a production export path from the Taurus Slides resource model to PDF. It translates the deck into a static page sequence while preserving Taurus geometry, z-order, typography, theme resolution, links, sections, and supported visual objects.
PDF export is intentionally simpler than PPTX export: it does not preserve editability, animation, transition behavior, template identities, or executable content. It preserves what the audience can see at one exact resource revision.
# Recommendation
Use a shared, replaceable rendering integration:
- **Default:** Python 3.12 and **WeasyPrint 69.0**.
- **Validation:** **qpdf 12.3.x** plus Taurus PDF policy inspection.
- **Compatibility benchmark:** Playwright/Chromium.
- **Future alternative:** Typst if a second layout compiler becomes justified.
- **Commercial fallback:** Prince only after a measured open-source fidelity gap.
Slides map cleanly to fixed-size paged HTML/CSS/SVG:
- each slide becomes one fixed PDF page;
- visual objects use absolute positions;
- shapes, lines, charts, and equations can remain vector SVG;
- text uses embedded/subset fonts;
- two-dimensional transforms cover the Taurus model;
- section names can become outline entries;
- links can remain PDF annotations.
The worker must receive a fully resolved snapshot. It must not understand Taurus theme inheritance, ranks, collaboration state, data providers, chart queries, or prompt execution.
# Scope
## Version 1
- Export one Slides resource at one exact revision.
- Emit one PDF page for each included slide, in stable rank order.
- Omit hidden slides by default; allow an explicit `includeHiddenSlides`.
- Preserve canvas dimensions, backgrounds, z-order, 2D transforms, text, shapes, lines, images, tables, chart snapshots, equations, groups, supported embeds, and links.
- Resolve deck theme, layout template, and slot inheritance before invoking the renderer.
- Use section names as optional PDF outline entries.
- Preserve slide IDs in diagnostics and internal anchors, but do not invent slide names.
- Produce structured warnings for fallbacks and omissions.
## Explicit non-goals
- PDF import.
- Animations and transitions. They are always dropped.
- Editable slide objects in PDF.
- Speaker notes in version 1.
- Comments, presence, revision history, template-management metadata, and editor selection.
- Re-querying chart providers or evaluating formulas/prompts.
- Executing embedded content.
- Rendering arbitrary HTML, CSS, JavaScript, or remote URLs.
- Advertising PDF/A or PDF/UA compliance before independent validation.
# Resource semantics that must remain true
The Slides model is `Deck → SlideSection → Slide → VisualObject`.
- Slides have stable IDs and positions, not user-facing names.
- Section IDs are stable and section names may be printed as outline labels.
- Slide order is derived from rank.
- Hidden state is a presentation/export concern.
- Geometry is stored in English Metric Units (EMU).
- Themes and layout templates are reusable model structures, not independent PDF objects.
- PDF is a static view: dynamic chart/equation/embed content must already be resolved into a safe display snapshot.
See the [Taurus Slides resource model](https://app.notion.com/p/3abb6410e50281df8762c162e9a6eb13).
# Taurus runtime placement
Slides export is a deferred durable, project-scoped job:
```plain text
request exact deck revision
  → authorize
  → enqueue idempotent job
  → resolve SlidesPDFSnapshotV1
  → materialize approved assets
  → invoke sandboxed renderer
  → validate structure and policy
  → store derived artifact
  → authorize download
```
The worker never reads a mutable resource head. “Latest” is resolved to a concrete revision before enqueue. Export does not mutate the deck and does not create a ChangeSet.
# Shared PDF contracts
Use the same shared `pdfexport.ExportRequest`, `pdfexport.Options`, `pdfexport.Result`, `pdfexport.Renderer`, and file-based subprocess protocol as Document and Spreadsheet PDF exports.
Slides adds resource options:
```go
type SlidesPDFOptions struct {
	Profile             pdfexport.Profile `json:"profile"`
	IncludeLinks        bool              `json:"includeLinks"`
	IncludeHiddenSlides bool              `json:"includeHiddenSlides"`
	IncludeOutline      bool              `json:"includeOutline"`
	SlideIDs            []string          `json:"slideIds,omitempty"`
}

func (o SlidesPDFOptions) Validate() error {
	if len(o.SlideIDs) > MaxSelectedSlides {
		return ErrTooManySlides
	}
	return validateProfile(o.Profile)
}
```
`SlideIDs` is an optional stable-ID selection. If it is present, preserve deck rank order rather than request order. Reject IDs that are not present at the pinned revision; do not silently substitute positional slides.
# Canonical Slides paint snapshot
Add a Slides capability projection that flattens model inheritance into a painter-oriented representation:
```go
type SlidesPDFSnapshotV1 struct {
	SchemaVersion int                 `json:"schemaVersion"`
	DeckID        string              `json:"deckId"`
	Revision      int64               `json:"revision"`
	Title         string              `json:"title"`
	Canvas        PDFCanvas           `json:"canvas"`
	Slides        []PDFSlide          `json:"slides"`
	Outline       []PDFOutlineEntry   `json:"outline,omitempty"`
	Assets        []PDFAssetReference `json:"assets"`
}

type PDFCanvas struct {
	WidthPt  float64 `json:"widthPt"`
	HeightPt float64 `json:"heightPt"`
}

type PDFSlide struct {
	SlideID    string            `json:"slideId"`
	Ordinal    int               `json:"ordinal"`
	SectionID  string            `json:"sectionId,omitempty"`
	Hidden     bool              `json:"hidden"`
	Background PDFPaint          `json:"background"`
	Objects    []PDFVisualObject `json:"objects"`
}

type PDFVisualObject struct {
	ObjectID   string              `json:"objectId"`
	Kind       string              `json:"kind"`
	ZIndex     int                 `json:"zIndex"`
	Bounds     PDFRect             `json:"bounds"`
	Transform  PDFTransform        `json:"transform"`
	Opacity    float64             `json:"opacity"`
	Clip       *PDFClip            `json:"clip,omitempty"`
	Text       *PDFTextObject      `json:"text,omitempty"`
	Shape      *PDFShapeObject     `json:"shape,omitempty"`
	Line       *PDFLineObject      `json:"line,omitempty"`
	Image      *PDFImageObject     `json:"image,omitempty"`
	Table      *PDFTableObject     `json:"table,omitempty"`
	Vector     *PDFVectorObject    `json:"vector,omitempty"`
	Group      *PDFGroupObject     `json:"group,omitempty"`
	Link       *PDFLinkTarget      `json:"link,omitempty"`
	AltText    string              `json:"altText,omitempty"`
}

type PDFRect struct {
	XPt      float64 `json:"xPt"`
	YPt      float64 `json:"yPt"`
	WidthPt  float64 `json:"widthPt"`
	HeightPt float64 `json:"heightPt"`
}

type PDFTransform struct {
	RotationDeg float64 `json:"rotationDeg"`
	FlipX       bool    `json:"flipX"`
	FlipY       bool    `json:"flipY"`
}
```
Convert geometry exactly:
```go
const emuPerInch = 914400.0
const pointsPerInch = 72.0

func EMUToPoints(emu int64) float64 {
	return float64(emu) * pointsPerInch / emuPerInch
}
```
The projection algorithm:
1. Load the exact deck Base at the pinned revision.
2. Sort slides by stable rank.
3. Apply stable-ID selection if supplied.
4. Exclude hidden slides unless explicitly included.
5. Resolve theme, layout template, slots, defaults, and object styles.
6. Convert all geometry to points.
7. Flatten groups or emit normalized nested groups with complete transforms.
8. Resolve charts, equations, and supported embeds to trusted static SVG/PNG assets.
9. Resolve text into shaped/line-broken runs when precise Taurus line wrapping is required.
10. Emit section outline entries pointing to the first included slide in each section.
11. Exclude notes and all animation/transition state.
The snapshot should be sufficient for a renderer that knows nothing about the canonical Slides model.
# Slides-to-PDF mapping
<table header-row="true">
<tr>
<td>Taurus Slides concept</td>
<td>PDF projection</td>
<td>Rule</td>
</tr>
<tr>
<td>Deck canvas</td>
<td>PDF page MediaBox</td>
<td>Preserve exact aspect ratio and point dimensions.</td>
</tr>
<tr>
<td>Slide rank</td>
<td>PDF page order</td>
<td>Use stable rank; page number is positional.</td>
</tr>
<tr>
<td>Stable slide ID</td>
<td>Anchor/diagnostic identity</td>
<td>Never expose a rename operation; slides are unnamed.</td>
</tr>
<tr>
<td>Section</td>
<td>PDF outline entry</td>
<td>Point to first included slide; omit empty sections.</td>
</tr>
<tr>
<td>Hidden slide</td>
<td>Omitted by default</td>
<td>Include only with explicit option.</td>
</tr>
<tr>
<td>Theme/layout/slot</td>
<td>Resolved style and object geometry</td>
<td>Do not serialize template identity into PDF.</td>
</tr>
<tr>
<td>Text object</td>
<td>Positioned semantic text container</td>
<td>Preserve runs, paragraphs, alignment, overflow policy.</td>
</tr>
<tr>
<td>Shape</td>
<td>SVG or styled vector box</td>
<td>Preserve fill, stroke, radius, opacity.</td>
</tr>
<tr>
<td>Line</td>
<td>SVG line/path</td>
<td>Preserve endpoints, markers, stroke, dash.</td>
</tr>
<tr>
<td>Image</td>
<td>Positioned manifest asset</td>
<td>Preserve crop, fit, rotation, opacity, alt text.</td>
</tr>
<tr>
<td>Table</td>
<td>Fixed semantic table</td>
<td>Preserve cells, borders, fills, text, and dimensions.</td>
</tr>
<tr>
<td>Chart</td>
<td>Trusted SVG preferred; PNG fallback</td>
<td>Never query data providers in the worker.</td>
</tr>
<tr>
<td>Equation</td>
<td>Trusted SVG preferred</td>
<td>Preserve alt/display text when available.</td>
</tr>
<tr>
<td>Embed</td>
<td>Approved static preview only</td>
<td>Unsupported/unsafe embeds become placeholder or are omitted with warning.</td>
</tr>
<tr>
<td>Group</td>
<td>Nested/flattened transform</td>
<td>Preserve z-order and clip.</td>
</tr>
<tr>
<td>Hyperlink</td>
<td>PDF link annotation</td>
<td>Allow approved external and internal targets.</td>
</tr>
<tr>
<td>Transition/animation</td>
<td>Omitted</td>
<td>No placeholder and no warning unless strict diagnostics requested.</td>
</tr>
<tr>
<td>Notes/comments/history</td>
<td>Omitted</td>
<td>Not part of the visual deck export.</td>
</tr>
</table>
# Static object resolution
## Text
The most common visual mismatch will be text wrapping. The desired end state is for the Slides capability to emit positioned lines and styled runs. Until that projection exists, the worker may line-break with the pinned font stack, but any overflow must produce `SLIDE_TEXT_OVERFLOW`; it must not resize text unless the model’s resolved overflow policy says to do so.
## Charts
Charts are exported from a revision-bound display snapshot, not recomputed:
```go
type PDFVectorObject struct {
	AssetURI   string  `json:"assetUri"`
	MediaType  string  `json:"mediaType"` // image/svg+xml preferred
	WidthPt    float64 `json:"widthPt"`
	HeightPt   float64 `json:"heightPt"`
	SourceKind string  `json:"sourceKind"` // chart | equation | embed
}
```
If the canonical object can produce deterministic SVG, preserve it as vector. Rasterize only the unsupported object, not the whole slide, and report `OBJECT_RASTERIZED`.
## Images
Resolve image bytes through Omega’s File integration. Crop and fit parameters belong in the snapshot. Apply image pixel and decoded-memory limits before invoking WeasyPrint.
## Internal links
Translate a link to a stable slide ID into an anchor such as `#slide-<opaque-id>`. If the target slide is excluded or hidden, omit the link and emit `LINK_TARGET_EXCLUDED`.
# Rendering implementation
The worker creates one fixed-size page container per slide.
```css
@page slide {
  size: var(--slide-width) var(--slide-height);
  margin: 0;
}

.slide {
  page: slide;
  position: relative;
  box-sizing: border-box;
  width: var(--slide-width);
  height: var(--slide-height);
  overflow: hidden;
  break-after: page;
}

.object {
  position: absolute;
  left: var(--x);
  top: var(--y);
  width: var(--width);
  height: var(--height);
  transform-origin: center;
}
```
```python
def render_slides(request, snapshot, assets, output_path):
    html = build_deck_html(snapshot)
    css = build_deck_css(snapshot["canvas"])
    fetcher = ManifestFetcher(assets)

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
```
Object ordering in generated HTML must be ascending `zIndex`. Validate that IDs and z-order are unique after projection. Generated SVG must use explicit view boxes and dimensions.
# Worker isolation and asset access
The shared worker protocol uses request, snapshot, asset-manifest, output, and result files. Go invokes it directly with `exec.CommandContext`.
The worker:
- has no network;
- has no project, database, or provider credentials;
- reads only manifest-backed `asset://` values;
- cannot open arbitrary local files;
- receives no raw user HTML/CSS;
- writes only the output PDF and result JSON;
- is terminated on deadline or limit breach.
WeasyPrint’s default URL fetcher must never be used as a fallback. The custom fetcher rejects all non-manifest schemes and paths.
# Concurrency, caching, and persistence
Pin the exact deck revision before enqueue. A later reorder, edit, hide/show change, theme change, or chart refresh must not affect the running export.
The render fingerprint includes:
```plain text
project ID
resource kind + deck ID
exact revision
snapshot SHA-256
canonical options JSON
renderer image/version
Slides PDF template version
font bundle version
static chart/equation/embed asset digests
```
Duplicate requests may join or reuse a validated artifact. The artifact record includes page count and the ordered included slide IDs for audit/debugging. Export creates no ChangeSet.
# Validation and PDF policy
After rendering:
1. enforce path, type, byte, and page-count limits;
2. run `qpdf --check`;
3. reject encryption, attachments, forms, JavaScript, launch actions, remote-go-to actions, external file specifications, and unapproved URI schemes;
4. verify every page MediaBox matches the deck canvas;
5. verify page count equals the included slide count;
6. verify intended internal destinations and outline targets;
7. compute digest and persist only after success.
Standard output is an unencrypted PDF. PDF/A and PDF/UA are opt-in candidates that remain experimental until independently validated.
# Accessibility
The standard profile should still preserve:
- logical reading order derived from z-order plus explicit semantic order where available;
- real text rather than flattened slide images;
- link annotations;
- document language;
- alt text for images/charts/equations;
- table semantics;
- section outline entries.
Visual z-order is not always correct reading order. Add an explicit accessibility order to the Slides model or projection before claiming accessible output. Missing alt text and ambiguous order must fail a strict accessible request.
# Errors and diagnostics
Common codes:
- `SLIDES_PDF_REVISION_NOT_FOUND`
- `SLIDES_PDF_SNAPSHOT_INVALID`
- `SLIDES_PDF_ASSET_MISSING`
- `SLIDES_PDF_TEXT_OVERFLOW`
- `SLIDES_PDF_OBJECT_RASTERIZED`
- `SLIDES_PDF_EMBED_OMITTED`
- `SLIDES_PDF_LINK_TARGET_EXCLUDED`
- `SLIDES_PDF_FONT_FALLBACK`
- `SLIDES_PDF_LIMIT_EXCEEDED`
- `SLIDES_PDF_RENDER_TIMEOUT`
- `SLIDES_PDF_RENDER_FAILED`
- `SLIDES_PDF_STRUCTURAL_INVALID`
- `SLIDES_PDF_POLICY_REJECTED`
Diagnostics identify stable slide and object IDs plus the output page ordinal. Logs and metrics must not contain slide text or private asset URLs.
# Test plan
## Model/projection tests
- stable rank ordering;
- hidden-slide default and explicit inclusion;
- stable-ID selection;
- section outline target calculation;
- template/theme/slot resolution;
- EMU-to-point conversion;
- group transform composition;
- deterministic z-order;
- revision-bound static chart/equation/embed resolution.
## Rendering corpus
- 16:9, 4:3, portrait, and custom canvases;
- every text style and overflow mode;
- shapes, lines, arrows, gradients, opacity, rotation, flips, clipping;
- images with crop/fit and high pixel dimensions;
- tables, charts, equations, groups, and approved embed previews;
- internal and external links;
- hidden slides, empty sections, and selected slide subsets;
- Unicode, RTL, CJK, and font fallback.
## Assertions
- exact page count and MediaBox;
- slide-to-page order;
- object bounds and z-order;
- text extraction and line wrapping;
- link and outline destinations;
- vector object preservation where expected;
- no forbidden PDF objects/actions;
- visual regression against approved fixtures;
- deterministic artifact for an identical render fingerprint.
# Delivery sequence
1. Reuse the shared PDF request/result and renderer integration.
2. Implement `ResolveSlidesPDFSnapshotV1`.
3. Resolve theme/layout/slots and exact canvas/object geometry.
4. Add static SVG/PNG resolution for charts, equations, and embeds.
5. Implement Slides HTML/CSS/SVG templates in the shared worker.
6. Add qpdf and Taurus PDF policy validation.
7. Store/download the artifact through project-scoped authorization.
8. Build the fixture corpus and compare WeasyPrint with Chromium.
9. Add semantic reading order before enabling an accessible profile.
# Acceptance criteria
- One exact deck revision produces one exact-size PDF page per included slide.
- Hidden slides are omitted by default and selection uses stable slide IDs.
- Slides remain unnamed; section names alone may become outline labels.
- Animations, transitions, notes, comments, and collaboration state are absent.
- Theme and template inheritance is fully resolved before rendering.
- The worker has no network, credentials, provider access, or arbitrary file access.
- The result passes structural and policy validation.
- All lossy fallbacks are represented by stable diagnostics.
# Sources
- [Taurus Slides resource model](https://app.notion.com/p/3abb6410e50281df8762c162e9a6eb13)
- [Export - Slides to PPTX](https://app.notion.com/p/3acb6410e5028156bee8c6cca9f2ab87)
- [Taurus Omega runtime model](https://github.com/gccurtis/taurus-omega/blob/main/docs/architecture/runtime-model.md)
- [WeasyPrint 69.0 documentation](https://doc.courtbouillon.org/weasyprint/stable/)
- [WeasyPrint API and supported features](https://doc.courtbouillon.org/weasyprint/stable/api_reference.html)
- [WeasyPrint source and BSD-3-Clause license](https://github.com/Kozea/WeasyPrint)
- [Playwright ](https://playwright.dev/docs/api/class-page)[`page.pdf`](https://playwright.dev/docs/api/class-page)[ reference](https://playwright.dev/docs/api/class-page)
- [Typst PDF reference](https://typst.app/docs/reference/pdf/)
- [qpdf CLI validation reference](https://qpdf.readthedocs.io/en/stable/cli.html)
- [qpdf source and Apache-2.0 license](https://github.com/qpdf/qpdf)

