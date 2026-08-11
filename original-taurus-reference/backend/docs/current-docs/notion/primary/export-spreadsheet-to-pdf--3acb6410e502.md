---
title: "Export - Spreadsheet to PDF"
notion_page_id: "3acb6410e50281ffb153c8565943f650"
notion_url: "https://app.notion.com/3acb6410e50281ffb153c8565943f650"
project: "Taurus Yesod"
role: "Primary"
format: "Spec"
created: "2026-07-29 13:45:14Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Export - Spreadsheet to PDF

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Decision:** implement Spreadsheet → PDF through the shared sandboxed Python/WeasyPrint worker, but do not delegate spreadsheet pagination to CSS. Omega resolves one immutable spreadsheet revision, final display values, print options, repeated axes, scaling, page bands, and overlay fragments into `SpreadsheetPDFSnapshotV1`; the worker paints those pre-tiled pages.
# Purpose
This specification defines a production export path from a Taurus Spreadsheet resource to PDF. It focuses on the difficult parts that make spreadsheet printing predictable: revision-bound values, explicit print defaults, horizontal and vertical tiling, frozen-axis repetition, exact cell geometry, overlay clipping, large-sheet limits, and deterministic diagnostics.
PDF is a static display artifact. It does not contain live formulas, prompts, model definitions, recalculation logic, collaboration history, or executable connections.
# Recommendation
Use the same replaceable renderer integration as Document and Slides:
- **Default:** Python 3.12 with **WeasyPrint 69.0**.
- **Structural validation:** **qpdf 12.3.x** plus Taurus PDF policy checks.
- **Compatibility benchmark:** Playwright/Chromium.
- **Future alternative:** Typst if compliance or performance warrants a second compiler.
- **Commercial fallback:** Prince only if measured requirements cannot be met with the open-source stack.
WeasyPrint should paint already tiled pages. It should not decide column bands, row bands, repeated rows/columns, scale, or page order. That planner is part of the Spreadsheet export projection because it depends on Taurus grid semantics and must remain deterministic across renderer upgrades.
# Scope
## Version 1
- Export one Spreadsheet resource at one exact revision.
- Export an explicit range or the resolved used range.
- Preserve final display values, formats, resolved styles, borders, fills, alignment, row/column sizes, hidden-axis policy, gridlines, row/column headers, repeated frozen axes, and supported overlays.
- Support explicit paper, orientation, margin, scale, page-order, and inclusion options.
- Resolve formulas and prompts to accepted display state without evaluation.
- Generate deterministic page tiles before invoking the renderer.
- Preserve charts and equations as trusted SVG where possible.
- Return structured warnings for clipping, fallbacks, missing values, and omitted content.
## Explicit non-goals
- PDF import.
- Formula or prompt evaluation.
- Exporting formula definitions, prompt definitions, dependency graphs, provider state, evidence, comments, presence, revision history, or editor selection.
- Live chart data queries inside the renderer.
- Executable attachments, embedded files, forms, JavaScript, or macros.
- Arbitrary user HTML/CSS or network URLs.
- PDF/A/PDF/UA compliance claims before independent validation.
# Spreadsheet model assumptions
The Taurus Spreadsheet model is one Spreadsheet per resource with:
- sparse stable rows, columns, and cells;
- revision-bound formula/prompt state;
- named ranges and spills;
- resolved formatting/rules;
- freeze panes;
- visual overlays such as images and charts;
- exact numeric values and separate display formatting.
See the [Taurus Spreadsheet resource model](https://app.notion.com/p/3abb6410e5028179a844c0af77b21ffe).
The export projection must operate on stable row/column IDs even when the user chose a positional range. Position is resolved at the pinned revision.
# Taurus runtime placement
Spreadsheet export is a deferred durable job:
```plain text
request + options
  → authorize project/resource
  → resolve exact revision
  → resolve stable export range
  → enqueue idempotent job
  → evaluate no new work
  → build static display snapshot
  → plan page tiles
  → materialize assets
  → invoke sandboxed PDF worker
  → validate and store
```
A change made after enqueue does not alter values, formatting, hidden axes, overlay positions, or page count. Export never creates a ChangeSet.
# Export options and resolved print settings
API options are user intent. The worker receives only resolved settings.
```go
type SpreadsheetPDFOptions struct {
	Profile              pdfexport.Profile `json:"profile"`
	Range                *RevisionRangeRef  `json:"range,omitempty"`
	Paper                PaperRequest       `json:"paper"`
	Orientation          Orientation        `json:"orientation"`
	Margins              MarginRequest      `json:"margins"`
	Scale                 ScaleRequest       `json:"scale"`
	PageOrder            PageOrder          `json:"pageOrder"`
	RepeatFrozenRows      bool               `json:"repeatFrozenRows"`
	RepeatFrozenColumns   bool               `json:"repeatFrozenColumns"`
	ShowGridlines         bool               `json:"showGridlines"`
	ShowRowColumnHeaders  bool               `json:"showRowColumnHeaders"`
	IncludeHiddenAxes     bool               `json:"includeHiddenAxes"`
	IncludeOverlays       bool               `json:"includeOverlays"`
}

type ScaleRequest struct {
	Mode    string  `json:"mode"` // actual | percent | fit_width | fit_sheet
	Percent float64 `json:"percent,omitempty"`
}

type PageOrder string

const (
	PageDownThenOver PageOrder = "down_then_over"
	PageOverThenDown PageOrder = "over_then_down"
)
```
Defaults are resolved in Go from tenant/user locale and product policy, not guessed by Python:
- locale-appropriate paper (`Letter` for configured US defaults, `A4` where configured);
- deterministic `orientation=auto` resolved from the selected grid geometry;
- `fit_width`;
- 36-point margins;
- `down_then_over`;
- hidden axes excluded;
- gridlines off unless the sheet uses them as part of its presentation;
- overlays included;
- frozen rows/columns repeated when present.
The resolved snapshot contains explicit paper width/height, orientation, margins, and scale. A renderer upgrade cannot reinterpret `auto`.
# Shared PDF contracts
Reuse the shared `pdfexport.ExportRequest`, `pdfexport.Result`, renderer integration, file-based invocation, artifact record, and validation pipeline.
For large exports, request JSON remains small. Snapshot data may be split:
```json
{
  "schemaVersion": 1,
  "kind": "spreadsheet",
  "header": "snapshot/header.json",
  "pages": [
    "snapshot/pages/000001.json",
    "snapshot/pages/000002.json"
  ],
  "assets": "assets.json",
  "sha256": "sha256:…"
}
```
This preserves the user’s proposed JSON boundary without requiring one enormous in-memory JSON string. JSON Lines is also acceptable for cell streams if the schema remains versioned and checksummed.
# Canonical Spreadsheet print snapshot
```go
type SpreadsheetPDFSnapshotV1 struct {
	SchemaVersion int                    `json:"schemaVersion"`
	SpreadsheetID string                 `json:"spreadsheetId"`
	Revision      int64                  `json:"revision"`
	Title         string                 `json:"title"`
	Locale        string                 `json:"locale"`
	Print         ResolvedPrintSettings  `json:"print"`
	Range         ResolvedStableRange    `json:"range"`
	Pages         []SpreadsheetPDFPageRef `json:"pages"`
	Assets        []PDFAssetReference    `json:"assets"`
}

type ResolvedPrintSettings struct {
	PageWidthPt         float64   `json:"pageWidthPt"`
	PageHeightPt        float64   `json:"pageHeightPt"`
	MarginsPt           PDFMargins `json:"marginsPt"`
	Scale               float64   `json:"scale"`
	PageOrder           PageOrder `json:"pageOrder"`
	ShowGridlines       bool      `json:"showGridlines"`
	ShowHeaders         bool      `json:"showHeaders"`
	IncludeHiddenAxes   bool      `json:"includeHiddenAxes"`
	IncludeOverlays     bool      `json:"includeOverlays"`
}

type SpreadsheetPDFPage struct {
	PageIndex        int                    `json:"pageIndex"`
	HorizontalBand   int                    `json:"horizontalBand"`
	VerticalBand     int                    `json:"verticalBand"`
	Rows             []PDFGridRow           `json:"rows"`
	Columns          []PDFGridColumn        `json:"columns"`
	Cells            []PDFGridCell          `json:"cells"`
	OverlayFragments []PDFOverlayFragment   `json:"overlayFragments"`
	RepeatedRowIDs   []string               `json:"repeatedRowIds,omitempty"`
	RepeatedColumnIDs []string              `json:"repeatedColumnIds,omitempty"`
}

type PDFGridRow struct {
	RowID    string  `json:"rowId"`
	Ordinal  int     `json:"ordinal"`
	HeightPt float64 `json:"heightPt"`
	Hidden   bool    `json:"hidden"`
}

type PDFGridColumn struct {
	ColumnID string  `json:"columnId"`
	Ordinal  int     `json:"ordinal"`
	WidthPt  float64 `json:"widthPt"`
	Hidden   bool    `json:"hidden"`
}

type PDFGridCell struct {
	CellID      string          `json:"cellId"`
	RowID       string          `json:"rowId"`
	ColumnID    string          `json:"columnId"`
	Display     string          `json:"display"`
	RichRuns    []PDFTextRun    `json:"richRuns,omitempty"`
	Style       PDFCellStyle    `json:"style"`
	SourceState string          `json:"sourceState"` // literal | formula_accepted | prompt_accepted | empty
	AltText     string          `json:"altText,omitempty"`
}

type PDFOverlayFragment struct {
	OverlayID      string      `json:"overlayId"`
	Kind           string      `json:"kind"`
	PageBounds     PDFRect     `json:"pageBounds"`
	SourceClip     PDFRect     `json:"sourceClip"`
	ZIndex         int         `json:"zIndex"`
	AssetURI       string      `json:"assetUri"`
	AltText        string      `json:"altText,omitempty"`
}
```
The snapshot contains display-ready values. Exact rationals remain exact in the canonical model but are formatted once, using the pinned locale/format state, before the renderer starts.
# Page planner
Do not use CSS’s automatic table pagination to split the sheet. Build a deterministic planner.
## Inputs
- selected stable range;
- visible row/column sequence at the pinned revision;
- row heights and column widths;
- paper content width/height after margins and optional headers;
- scale mode;
- repeated frozen rows/columns;
- overlay bounds;
- page-order policy;
- hard limits.
If editor geometry is stored in CSS pixels, convert explicitly:
```go
const pointsPerCSSPixel = 72.0 / 96.0

func CSSPixelsToPoints(px float64) float64 {
	return px * pointsPerCSSPixel
}
```
## Planning algorithm
```go
func PlanSpreadsheetPages(
	grid ResolvedGrid,
	print ResolvedPrintSettings,
) ([]PageTile, error) {
	rows := selectRows(grid, print.IncludeHiddenAxes)
	cols := selectColumns(grid, print.IncludeHiddenAxes)

	scale, err := resolveScale(rows, cols, print)
	if err != nil {
		return nil, err
	}

	repeatRows := resolveRepeatedRows(grid, print)
	repeatCols := resolveRepeatedColumns(grid, print)

	xBands := partitionColumns(cols, repeatCols, print.ContentWidthPt(), scale)
	yBands := partitionRows(rows, repeatRows, print.ContentHeightPt(), scale)

	tiles := orderTiles(xBands, yBands, print.PageOrder)
	if len(tiles) > MaxPDFPages {
		return nil, ErrPageLimit
	}

	for i := range tiles {
		tiles[i].OverlayFragments = clipOverlays(grid.Overlays, tiles[i])
	}
	return tiles, nil
}
```
Rules:
- Never split a cell horizontally or vertically merely to fill a page.
- If one row or column exceeds the content area, apply the documented scale floor; if it still cannot fit, fail with `GRID_AXIS_TOO_LARGE`.
- Repeated axes consume page content space.
- Preserve deterministic rounding and carry error rather than accumulating drift.
- Empty trailing cells do not extend the used range.
- Overlay bounds do extend the default used range when `includeOverlays=true`.
- Page order changes only tile traversal, not the bands themselves.
- Scaling is applied uniformly to grid geometry and overlays.
# Scale policy
<table header-row="true">
<tr>
<td>Mode</td>
<td>Behavior</td>
</tr>
<tr>
<td>`actual`</td>
<td>100%, subject to hard single-axis fit failure</td>
</tr>
<tr>
<td>`percent`</td>
<td>Explicit bounded percentage</td>
</tr>
<tr>
<td>`fit_width`</td>
<td>Scale down so the selected width fits one horizontal band; vertical pagination remains</td>
</tr>
<tr>
<td>`fit_sheet`</td>
<td>Scale down to one page, subject to minimum legibility scale and hard object limits</td>
</tr>
</table>
Do not scale up by default. Enforce a product minimum such as 25%; below the minimum, require explicit confirmation or fail with `SCALE_BELOW_MINIMUM`. The exact threshold is a product setting, not a renderer constant.
# Spreadsheet-to-PDF mapping
<table header-row="true">
<tr>
<td>Taurus Spreadsheet concept</td>
<td>PDF projection</td>
<td>Rule</td>
</tr>
<tr>
<td>Spreadsheet resource</td>
<td>PDF document</td>
<td>Title in metadata; one selected range per request in version 1.</td>
</tr>
<tr>
<td>Stable row/column</td>
<td>Tiled grid axis</td>
<td>Preserve IDs in diagnostics, ordinals in headers.</td>
</tr>
<tr>
<td>Sparse cell</td>
<td>Display-ready table cell</td>
<td>Omit empty cell payload while preserving geometry.</td>
</tr>
<tr>
<td>Literal value</td>
<td>Formatted display string</td>
<td>No type conversion in worker.</td>
</tr>
<tr>
<td>Formula</td>
<td>Accepted display string</td>
<td>Never calculate in renderer.</td>
</tr>
<tr>
<td>Prompt</td>
<td>Accepted display string</td>
<td>Exclude prompt/evidence/provider state.</td>
</tr>
<tr>
<td>Spill result</td>
<td>Resolved displayed cells</td>
<td>Preserve spill display, not recalculation logic.</td>
</tr>
<tr>
<td>Conditional rule</td>
<td>Resolved cell style</td>
<td>Evaluate before snapshot.</td>
</tr>
<tr>
<td>Named range</td>
<td>Selection input only</td>
<td>No PDF-native editable range.</td>
</tr>
<tr>
<td>Frozen rows/columns</td>
<td>Optional repeated axes</td>
<td>Resolve once before tiling.</td>
</tr>
<tr>
<td>Hidden row/column</td>
<td>Excluded by default</td>
<td>Include only with explicit option.</td>
</tr>
<tr>
<td>Gridline</td>
<td>Vector cell border</td>
<td>Separate from authored borders.</td>
</tr>
<tr>
<td>Row/column header</td>
<td>Optional page header cells</td>
<td>Use positional labels.</td>
</tr>
<tr>
<td>Image overlay</td>
<td>Clipped positioned asset</td>
<td>Split into page fragments at tile boundaries.</td>
</tr>
<tr>
<td>Chart overlay</td>
<td>Trusted SVG preferred</td>
<td>No data-provider access in worker.</td>
</tr>
<tr>
<td>Comments/history/presence</td>
<td>Omitted</td>
<td>Not part of static display export.</td>
</tr>
</table>
# Overlay handling
Overlays use the same sheet coordinate system as cells. The planner intersects every included overlay with every page tile:
```go
func clipOverlay(o Overlay, tile PageTile) (PDFOverlayFragment, bool) {
	intersection := o.Bounds.Intersection(tile.SheetBounds)
	if intersection.Empty() {
		return PDFOverlayFragment{}, false
	}
	return PDFOverlayFragment{
		OverlayID:  o.ID,
		Kind:       o.Kind,
		PageBounds: tile.MapSheetRectToPage(intersection),
		SourceClip: o.MapSheetRectToSource(intersection),
		ZIndex:     o.ZIndex,
		AssetURI:   o.ResolvedAssetURI,
		AltText:    o.AltText,
	}, true
}
```
Prefer SVG for charts and equations. If a renderer feature requires rasterization, rasterize the overlay alone at an output-DPI appropriate to its final page size and report `OVERLAY_RASTERIZED`.
# Rendering implementation
The worker renders one page fragment at a time using exact dimensions.
```css
@page sheet {
  size: var(--page-width) var(--page-height);
  margin: 0;
}

.sheet-page {
  page: sheet;
  position: relative;
  box-sizing: border-box;
  width: var(--page-width);
  height: var(--page-height);
  overflow: hidden;
  break-after: page;
}

.grid {
  position: absolute;
  display: grid;
  grid-template-columns: var(--column-widths);
  grid-template-rows: var(--row-heights);
}
```
```python
def render_spreadsheet(request, manifest, assets, output_path):
    fetcher = ManifestFetcher(assets)
    page_files = manifest["pages"]
    html = build_sheet_html(stream_pages(page_files))
    css = build_sheet_css(load_header(manifest["header"]))

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
For very large sheets, avoid constructing one giant Python string. The worker may render bounded page groups to temporary PDFs and combine them with qpdf, provided:
- every intermediate file stays in the attempt sandbox;
- page order is preserved;
- outlines/metadata are added once;
- the final combined file receives the complete structural and policy validation;
- batch size is deterministic and part of the worker version.
Start with one render for the allowed version-1 maximum, measure memory, then introduce page-group rendering only if required.
# Fonts, locale, and display stability
- Pin the renderer and font stack.
- Use the snapshot’s formatted display strings; Python must not apply locale-sensitive number/date formatting.
- Use IBM Plex plus an explicit Noto fallback set.
- Reject or warn on unsupported user font assets.
- Preserve non-breaking spaces, bidi control policy, and text direction.
- Bound text and rich-run sizes per cell.
- Clip or wrap according to the resolved cell style; never invent autofit in the worker.
# Concurrency, idempotency, and persistence
The fingerprint includes:
```plain text
project + spreadsheet ID
exact revision
resolved stable range
snapshot/manifest digest
canonical print options
renderer/template/font bundle versions
overlay asset digests
```
Retries with the same fingerprint reuse or join the same job. Any edit, recalculation acceptance, range change, paper/scale change, overlay update, or dependency upgrade creates a new fingerprint.
The artifact record should preserve the resolved range, row/column counts, page-band counts, page count, options, versions, warnings, and hashes. It remains derived data outside the Base/ChangeSet concurrency model.
# Security boundaries
- Use direct `exec.CommandContext`, never a shell.
- Run unprivileged with no network and no credentials.
- Limit filesystem reads to the attempt directory.
- Use a custom manifest fetcher that accepts only `asset://<opaque-id>`.
- Escape all displayed values.
- Generate CSS from validated geometry/style types.
- Reject path traversal, external URLs, unbounded data URIs, NaN/infinite geometry, extreme dimensions, and excessive color/font strings.
- Enforce cell, row, column, page, text-byte, asset-byte, decoded-image-pixel, output-byte, CPU, memory, and wall-clock limits.
- Sanitize or internally generate SVG.
- Do not log cell values or formulas.
- Delete attempt files according to the job cleanup policy.
# Validation and PDF policy
After rendering:
1. require expected page count and bounded output size;
2. run `qpdf --check`;
3. reject encryption, attachments, forms, JavaScript, launch actions, remote-go-to actions, external file references, and disallowed links;
4. verify every page MediaBox matches the resolved paper;
5. verify page order and selected tile metadata;
6. compute SHA-256 and store only after validation.
qpdf establishes syntax/structure, not visual or PDF/A/PDF/UA compliance. Visual and profile validation remain separate.
# Accessibility
Use semantic table markup, real text, document language, and overlay alt text even in the standard profile. However, split tables, repeated axes, positional headers, very large grids, and overlaid visuals make PDF/UA non-trivial. A strict accessible export should require:
- unambiguous header associations;
- bounded table size;
- reading-order validation;
- alt text for visual overlays;
- no clipped text;
- independent PDF/UA validation and assistive-technology testing.
Do not advertise compliance from WeasyPrint’s tagged-PDF flag alone.
# Errors and diagnostics
- `SHEET_PDF_REVISION_NOT_FOUND`
- `SHEET_PDF_RANGE_INVALID`
- `SHEET_PDF_RANGE_EMPTY`
- `SHEET_PDF_SNAPSHOT_INVALID`
- `SHEET_PDF_PAGE_LIMIT`
- `SHEET_PDF_GRID_AXIS_TOO_LARGE`
- `SHEET_PDF_SCALE_BELOW_MINIMUM`
- `SHEET_PDF_TEXT_CLIPPED`
- `SHEET_PDF_OVERLAY_RASTERIZED`
- `SHEET_PDF_ASSET_MISSING`
- `SHEET_PDF_FONT_FALLBACK`
- `SHEET_PDF_LIMIT_EXCEEDED`
- `SHEET_PDF_RENDER_TIMEOUT`
- `SHEET_PDF_RENDER_FAILED`
- `SHEET_PDF_STRUCTURAL_INVALID`
- `SHEET_PDF_POLICY_REJECTED`
Diagnostics identify stable row, column, cell, overlay, and page IDs without including cell content.
# Test plan
## Planner tests
- used-range resolution and explicit stable range;
- empty/trailing sparse cells;
- locale-resolved paper and auto orientation;
- all scale modes and scale floor;
- horizontal/vertical bands and both page orders;
- repeated frozen rows/columns;
- hidden-axis inclusion;
- deterministic rounding;
- page and axis hard limits;
- overlay-bound range extension and clipping.
## Model/display tests
- literals, exact rationals, dates, errors, accepted formulas, accepted prompts, and spills;
- number/date/currency/percentage formats;
- conditional style resolution;
- wrap/clip/alignment/direction;
- row/column widths and authored borders;
- no formula/prompt execution during export.
## Rendering corpus
- narrow, wide, tall, sparse, and dense sheets;
- Letter, A4, portrait, landscape, and custom paper;
- Unicode, RTL, CJK, font fallbacks;
- gridlines and row/column headers;
- frozen/repeated axes;
- images, charts, equations, and page-crossing overlays;
- maximum supported dimensions and assets.
## Assertions
- exact page count, bands, page order, and MediaBox;
- expected cells on each page;
- exact displayed strings;
- repeated axes;
- overlay clipping and z-order;
- text extraction and link targets;
- no forbidden PDF objects/actions;
- visual regression within tolerance;
- deterministic output for identical render fingerprint.
# Delivery sequence
1. Reuse shared PDF request/result and renderer integration.
2. Define and validate print options; resolve defaults in Go.
3. Implement exact-revision stable-range and display snapshot resolution.
4. Implement deterministic row/column band planner and overlay clipping.
5. Serialize versioned page files/manifests for bounded memory.
6. Add Spreadsheet templates to the shared WeasyPrint worker.
7. Add qpdf and Taurus policy validation.
8. Store/download through project-scoped authorization.
9. Build scale, performance, and visual corpora before raising limits.
# Acceptance criteria
- An authorized user can export a selected range or used range from one exact Spreadsheet revision.
- Page bands, repeated axes, scaling, and page order are deterministic and owned by Omega.
- Final display values are exported without recalculating formulas or prompts.
- Hidden axes and overlays follow explicit options.
- The worker has no network, credentials, database access, or arbitrary filesystem access.
- Large inputs are bounded and can be chunked through versioned JSON files.
- The result passes structural and policy validation.
- Lossy or excluded behavior is reported through stable diagnostics.
# Sources
- [Taurus Spreadsheet resource model](https://app.notion.com/p/3abb6410e5028179a844c0af77b21ffe)
- [Export - Spreadsheet to XLSX](https://app.notion.com/p/3acb6410e50281bf9ebed3037d6cb114)
- [Taurus Omega runtime model](https://github.com/gccurtis/taurus-omega/blob/main/docs/architecture/runtime-model.md)
- [WeasyPrint 69.0 documentation](https://doc.courtbouillon.org/weasyprint/stable/)
- [WeasyPrint API and supported features](https://doc.courtbouillon.org/weasyprint/stable/api_reference.html)
- [WeasyPrint source and BSD-3-Clause license](https://github.com/Kozea/WeasyPrint)
- [Playwright ](https://playwright.dev/docs/api/class-page)[`page.pdf`](https://playwright.dev/docs/api/class-page)[ reference](https://playwright.dev/docs/api/class-page)
- [Typst PDF reference](https://typst.app/docs/reference/pdf/)
- [qpdf CLI validation reference](https://qpdf.readthedocs.io/en/stable/cli.html)
- [qpdf source and Apache-2.0 license](https://github.com/qpdf/qpdf)

