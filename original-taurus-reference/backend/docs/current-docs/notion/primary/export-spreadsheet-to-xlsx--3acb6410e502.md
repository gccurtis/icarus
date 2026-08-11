---
title: "Export - Spreadsheet to XLSX"
notion_page_id: "3acb6410e50281bf9ebed3037d6cb114"
notion_url: "https://app.notion.com/3acb6410e50281bf9ebed3037d6cb114"
project: "Taurus Yesod"
role: "Primary"
format: "Spec"
created: "2026-07-29 05:28:13Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Export - Spreadsheet to XLSX

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Reviewed decision · Export only · Research refreshed: 2026-07-29.** This page defines how one immutable Taurus Spreadsheet revision becomes a downloadable `.xlsx`. It does not define XLSX import, editor design, workbook tabs inside Taurus, or round-trip reconstruction.
# Executive decision
Use [`XlsxWriter`](https://xlsxwriter.readthedocs.io/)[ 3.2.9](https://xlsxwriter.readthedocs.io/) in an isolated Python export worker, pinned exactly with Python and its lockfile. It is BSD-2-Clause, pure Python, production-stable, and designed specifically to create new XLSX files. Its official API covers typed values, rich formatting, row/column geometry, formulas with cached results, dynamic arrays, defined names, panes, validation, conditional formatting, images, native charts, tables, comments, print settings, accessibility descriptions, and bounded constant-memory generation.
The decisive advantage over Excelize for Taurus export is formula materialization. XlsxWriter can write an approved Excel formula **and** the accepted Taurus result into the cell's cached value. Excel can recalculate on open, while viewers and converters that do not calculate formulas still see the pinned Taurus value instead of `0`. That matches the revision-based Taurus runtime more directly.
Create one XLSX workbook containing one visible worksheet. Taurus's resource is a **Spreadsheet**, not a workbook with nested tabs. The XLSX workbook is only the required Office package container.
Keep [`Excelize`](https://xuri.me/excelize/en/)[ 2.11.0](https://xuri.me/excelize/en/) as the pure-Go fallback and independent package reader in tests. It remains a strong library, but language neutrality removes its deployment advantage, and its high-level formula API does not expose XlsxWriter's explicit cached-result path. Use UniOffice only after a demonstrated blocking gap in both permissive options.
# Scope and fidelity contract
- Export one exact Spreadsheet revision and its pinned formula/prompt/overlay state.
- Stable Taurus row and column IDs become revision-bound 1-based Excel indexes.
- Sparse absent cells remain absent.
- Named ranges become Excel defined names when their names and bounds are valid.
- Native formulas export only when Taurus can translate them safely to Excel semantics.
- Unsupported formulas, prompt cells, function values, and dynamic bindings materialize to accepted display values with explicit diagnostics.
- Charts and images preserve overlay placement through grid anchors and offsets. Native editable charts are preferred; a visual snapshot is the fallback.
- Do not create hidden metadata sheets to make a false round-trip promise.
- Do not export ChangeSets, collaboration state, formula dependency IDs, prompt instructions, provider state, or hidden evaluation history.
The canonical source is [Model — Spreadsheet Capability & Runtime Contract](https://app.notion.com/p/3abb6410e5028179a844c0af77b21ffe), including its sparse grid, stable axes, revision-bound A1 projection, named ranges, spills, exact-rational numbers, formula/prompt cells, rules, and grid-anchored overlays.
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
<td>[`XlsxWriter`](https://xlsxwriter.readthedocs.io/)[ 3.2.9](https://xlsxwriter.readthedocs.io/)</td>
<td>BSD-2-Clause; pure Python 3.8+</td>
<td>Export-only API; cached formula results; dynamic arrays; defined names; rich charts/images; alt text; constant-memory mode</td>
<td>Cannot read/modify workbooks; constant-memory mode restricts tables and some post-write operations</td>
<td>**Default**</td>
</tr>
<tr>
<td>[`Excelize`](https://xuri.me/excelize/en/)[ 2.11.0](https://xuri.me/excelize/en/)</td>
<td>BSD-3-Clause; pure Go 1.25+</td>
<td>Broad read/write XLSX surface, streaming, charts, images, formulas, styles, active project</td>
<td>Weaker high-level fit for storing Taurus's accepted formula result beside the formula</td>
<td>**Pure-Go fallback and test reader**</td>
</tr>
<tr>
<td>[UniOffice](https://unidoc.io/unioffice/)</td>
<td>Commercial; pure Go</td>
<td>Unified Office API and support</td>
<td>Quote pricing; unnecessary for baseline XLSX</td>
<td>**Fallback only**</td>
</tr>
<tr>
<td>[Open XML SDK](https://github.com/dotnet/Open-XML-SDK)</td>
<td>MIT; .NET</td>
<td>Complete low-level access and validation</td>
<td>Extra runtime; far more OOXML work</td>
<td>**CI validator only**</td>
</tr>
<tr>
<td>[Apache POI XSSF](https://poi.apache.org/components/)</td>
<td>Apache-2.0; Java</td>
<td>Mature spreadsheet support</td>
<td>Heavier runtime and lower implementation leverage than XlsxWriter</td>
<td>**Reject for V1**</td>
</tr>
</table>
# Export architecture
The XLSX renderer runs as a replaceable Python subprocess behind a Go leaf-integration port. The Spreadsheet capability imports neither XlsxWriter nor Excelize.
```go
type SpreadsheetSnapshotReader interface {
    ReadSpreadsheetRevision(
        ctx context.Context,
        projectID, spreadsheetID string,
        revision int64,
    ) (SpreadsheetExportSnapshot, error)
}

type XlsxRenderer interface {
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
```plain text
taurus-office-xlsx-worker render
  --request /attempt/request.json
  --snapshot /attempt/snapshot-manifest.json
  --assets /attempt/assets.json
  --output /attempt/artifact.xlsx
  --result /attempt/result.json
```
Go invokes the process using `exec.CommandContext` with distinct argv elements. It owns authorization, exact-revision pinning, durable jobs, idempotency, resource limits, attempt directories, asset materialization, cancellation, validation, sealing, storage, and delivery.
The Python worker receives only versioned JSON and attempt-local assets. It has no network, database, provider, project-store, or secret authority. Large sheets use a small manifest plus row-ordered JSON Lines or page/chunk files rather than one unbounded JSON document.
```typescript
interface SpreadsheetOfficeSnapshotV2 {
  schemaVersion: 2;
  projectId: string;
  spreadsheetId: string;
  revision: string;
  name: string;
  rows: readonly ExportRow[];
  columns: readonly ExportColumn[];
  cellChunks: readonly ChunkDescriptor[];
  namedRanges: readonly ExportNamedRange[];
  spills: readonly ExportSpill[];
  rules: readonly ExportRule[];
  overlays: readonly ExportOverlay[];
}
```
`revision` is a decimal string across the JSON boundary. Stable IDs remain strings. `assets.json` maps opaque `asset://<id>` references to hashed files inside the attempt directory and rejects every other path or fetch scheme.
Recommended placement:
```plain text
core/capability/spreadsheet/        canonical model; no Office-library import
core/integration/office/xlsx/       Go worker client and validation
core/wiring/                        port composition
workers/office-xlsx-python/         XlsxWriter 3.2.9 mapping
workers/office-xlsx-python/schema/  generated/versioned JSON schemas
tests/fixtures/office/xlsx/         golden and adversarial spreadsheets
```
# Index projection
Build a deterministic, immutable projection before writing:
```go
type AxisProjection struct {
    RowIndexByID map[string]int // Excel 1-based
    ColIndexByID map[string]int // Excel 1-based
    RowIDByIndex []string
    ColIDByIndex []string
}

func BuildAxisProjection(rows []ExportRow, cols []ExportColumn) AxisProjection {
    // Sort by canonical stable rank, then assign contiguous 1-based indexes.
}
```
All formula, named-range, spill, rule, chart, and overlay mapping consumes this same projection. Never recompute A1 references separately in different renderers.
Sanitize the worksheet name:
- derive from Spreadsheet name;
- remove Excel-forbidden characters;
- cap at 31 characters;
- use `Spreadsheet` when the result is empty;
- the stable resource ID remains in the export manifest, not the visible sheet name.
# Cell value mapping
<table header-row="true">
<tr>
<td>Taurus value</td>
<td>Excel cell</td>
<td>Rule</td>
</tr>
<tr>
<td>null</td>
<td>absent/blank</td>
<td>Do not allocate a cell only to store null.</td>
</tr>
<tr>
<td>logic</td>
<td>Boolean</td>
<td>Native Boolean.</td>
</tr>
<tr>
<td>text</td>
<td>shared/inline string</td>
<td>Enforce Excel's cell-text limit and warn/block predictably.</td>
</tr>
<tr>
<td>exact rational number</td>
<td>numeric when exactly safe; otherwise text</td>
<td>Excel has finite binary precision and roughly 15 significant decimal digits. Preserve correctness over editability.</td>
</tr>
<tr>
<td>list/record/table</td>
<td>spill materialization</td>
<td>Write the accepted rectangular projection to cells and preserve the spill anchor.</td>
</tr>
<tr>
<td>function value</td>
<td>accepted display text</td>
<td>Functions are not serializable values.</td>
</tr>
<tr>
<td>formula cell</td>
<td>Excel formula or materialized value</td>
<td>Use the formula policy below.</td>
</tr>
<tr>
<td>prompt cell</td>
<td>accepted result</td>
<td>Never export prompt instructions/model state.</td>
</tr>
</table>
## Exact number policy
Taurus stores exact rational strings. Before emitting a numeric cell:
1. parse the rational exactly;
2. convert to the candidate Excel numeric representation;
3. round-trip the candidate under the intended number format;
4. if the accepted Taurus value changes materially, emit text and `XLSX_NUMBER_EXPORTED_AS_TEXT`;
5. preserve the visible number format where possible.
IDs, account numbers, long integers, and significant leading-zero values should remain text even if they parse numerically.
```go
func mapNumber(value ExactRational, presentation NumberPresentation) CellWrite {
    if presentation.ForceText || !IsExcelRoundTripSafe(value, presentation) {
        return CellWrite{
            Value: value.DisplayString(presentation),
            Kind:  CellString,
            Warning: "XLSX_NUMBER_EXPORTED_AS_TEXT",
        }
    }
    return CellWrite{Value: value.Float64(), Kind: CellNumber}
}
```
# Formula translation
Taurus formulas use stable IDs and a resource-native algebra; Excel formulas use A1/R1C1 references and Excel function semantics. Translation must be a typed compiler pass, not a string replacement.
```go
type ExcelFormulaTranslator interface {
    Translate(
        ctx context.Context,
        expression FormulaExpression,
        axes AxisProjection,
        names NameProjection,
    ) (ExcelFormula, []ExportWarning, error)
}

type ExcelFormula struct {
    A1          string
    Volatile    bool
    RequiresRecalc bool
}
```
Translation steps:
1. parse/receive the canonical Taurus formula AST;
2. resolve stable row, column, cell, and named-range IDs against the pinned projection;
3. map operators and functions through an explicit registry;
4. verify argument and error semantics;
5. emit an A1 formula only if semantics are approved;
6. otherwise materialize the accepted value.
Do not translate formulas whose meaning only resembles an Excel function. Date systems, empty/null coercion, exact arithmetic, errors, arrays, locale, volatility, and range semantics must be intentionally matched.
XlsxWriter does not calculate formulas. That is desirable: Taurus's pinned accepted value is the export-time authority. For an approved translation, write both the Excel formula and that accepted value:
```python
def write_translated_formula(
    worksheet,
    row: int,
    col: int,
    translated: ExcelFormula,
    cell_format,
    accepted_value,
) -> None:
    worksheet.write_formula(
        row,
        col,
        translated.a1,
        cell_format,
        accepted_value,
    )
```
XlsxWriter marks the workbook for recalculation when Excel opens it. The cached result ensures non-calculating viewers, mobile previews, and PDF converters still display the pinned Taurus value. For approved dynamic-array semantics, use `write_dynamic_array_formula`; otherwise materialize the accepted spill rectangle.
Never make Python, XlsxWriter, Excelize, or LibreOffice calculation the Taurus authority. Excel recalculation is downstream behavior for formulas whose semantics were intentionally translated.
Formula policy:
<table header-row="true">
<tr>
<td>Case</td>
<td>Output</td>
</tr>
<tr>
<td>approved exact translation</td>
<td>Excel formula + accepted Taurus cached value; mark workbook for recalc</td>
</tr>
<tr>
<td>approved translation but Excel may differ within disclosed semantics</td>
<td>formula plus warning; strict mode may block</td>
</tr>
<tr>
<td>unsupported Taurus function/operator</td>
<td>accepted value only + `XLSX_FORMULA_MATERIALIZED`</td>
</tr>
<tr>
<td>failed current evaluation with visible last-good</td>
<td>last-good value + `XLSX_FORMULA_LAST_GOOD`</td>
</tr>
<tr>
<td>unresolved/no accepted result</td>
<td>blocking error</td>
</tr>
</table>
# Styles and presentation
Resolve Taurus presentation to concrete XlsxWriter formats and deduplicate them by a canonical, immutable style key.
```python
@dataclass(frozen=True)
class StyleKey:
    font_family: str
    font_size: float
    bold: bool
    italic: bool
    font_color: str
    fill_color: str
    number_format: str
    horizontal: str
    vertical: str
    wrap: bool
    borders: tuple[BorderKey, ...]

def resolve_format(workbook, cache: dict[StyleKey, Format], key: StyleKey):
    if key not in cache:
        cache[key] = workbook.add_format(to_xlsxwriter_format(key))
    return cache[key]
```
Map:
- font, foreground/background, emphasis;
- number format;
- horizontal/vertical alignment;
- wrapping and text rotation;
- borders;
- locked/hidden protection only when the Taurus model explicitly owns those semantics.
Avoid style explosion. Excel workbooks have practical style limits; share style IDs for identical resolved styles.
# Rows, columns, panes, ranges, and rules
<table header-row="true">
<tr>
<td>Taurus</td>
<td>XlsxWriter/XLSX</td>
</tr>
<tr>
<td>row height in px</td>
<td>convert to Excel row height points using a tested rendering conversion</td>
</tr>
<tr>
<td>column width in px</td>
<td>convert to Excel's character-width units using the pinned font metric policy</td>
</tr>
<tr>
<td>hidden row/column</td>
<td>native hidden flag</td>
</tr>
<tr>
<td>frozen region</td>
<td>native freeze panes</td>
</tr>
<tr>
<td>named range</td>
<td>workbook- or sheet-scoped defined name</td>
</tr>
<tr>
<td>merge/presentation span when canonically supported</td>
<td>merged cells; reject overlap</td>
</tr>
<tr>
<td>validation rule</td>
<td>Excel data validation when semantics match</td>
</tr>
<tr>
<td>conditional style rule</td>
<td>conditional formatting when semantics match</td>
</tr>
<tr>
<td>filter/table semantics</td>
<td>native table/filter only when present in the Taurus model, not inferred from appearance</td>
</tr>
</table>
Named ranges must pass Excel name validation and collision checks. If a Taurus name is invalid in Excel, either sanitize deterministically with a warning and mapping manifest or materialize references; never silently rename.
# Spills and structured values
Spills are a derived projection with an anchor and occupied rectangle.
- If the formula translated to an approved Excel dynamic-array formula, emit that formula and verify the range.
- Otherwise write the accepted spill values into the occupied rectangle.
- Detect collisions before writing. A canonical pinned revision should already be valid; an export collision is a blocking invariant failure.
- Do not add hidden sheets for record/list storage.
For record/table values, choose a deterministic column order from the canonical schema, not map iteration order.
# Image and chart overlays
Taurus overlays are anchored to stable grid bounds with pixel offsets and a z-rank. Convert anchors through the shared axis projection.
## Images
1. resolve FileID under project authorization;
2. validate and decode bounded media;
3. derive from/to cell anchors;
4. convert pixel offsets and requested dimensions to Excel drawing offsets/scales;
5. provide bytes through `io.BytesIO`, never a URL or arbitrary worker path;
6. add the picture with `description` alt text or an explicit decorative flag;
7. preserve creation order as the best available z-order projection.
No URL fetch occurs in the renderer.
## Charts
Prefer native XlsxWriter charts when the Taurus `ChartSpec` maps to its supported chart model. Bind the chart to the pinned cell ranges and apply titles, axes, legends, colors, formats, labels, and chart alt text.
If the chart spec is unsupported:
- create an approved PNG snapshot in the trusted rendering pipeline;
- anchor it as an image overlay;
- emit `XLSX_CHART_RASTERIZED`;
- strict mode blocks.
The embedded chart data is materialized. It does not preserve Taurus live bindings outside the exported sheet.
# Normal vs constant-memory writer
Use normal mode for typical spreadsheets because tables, merges, post-write inspection, and arbitrary sparse writes are easier to assemble. Switch to XlsxWriter's `constant_memory` mode only above an evidence-based size threshold.
In `constant_memory` mode, XlsxWriter flushes each row after the next row is written. Memory remains approximately constant, but:
- cells must be emitted in ascending row order;
- `add_table()` is unavailable;
- `merge_range()` and `set_row()` work only for the current row;
- features that manipulate prior cell data cannot be used after a row is flushed.
Therefore the Go capability projection sorts stable cells into row-major chunk files and resolves all row properties before the worker writes the row.
```go
type RenderPlan struct {
    Mode              string // normal | constant_memory
    EstimatedCells    int64
    EstimatedStyles   int
    RequiresOverlays  bool
    RequiresRules     bool
    RequiresTables    bool
    RequiresMerges    bool
    RequiresPostWrite bool
}
```
Select constant-memory mode only when the complete feature plan is compatible. A large but feature-rich spreadsheet may need a bounded normal-mode job with a larger worker allocation rather than a partial export. Never silently drop a feature to qualify for constant-memory mode.
# Failure and loss policy
<table header-row="true">
<tr>
<td>Condition</td>
<td>Balanced</td>
<td>Strict</td>
</tr>
<tr>
<td>formula not semantically translatable</td>
<td>accepted value + warning</td>
<td>block</td>
</tr>
<tr>
<td>exact number not safely representable</td>
<td>text + warning</td>
<td>block only if numeric editability required</td>
</tr>
<tr>
<td>chart unsupported</td>
<td>snapshot + warning</td>
<td>block</td>
</tr>
<tr>
<td>named range invalid/colliding</td>
<td>deterministic mapped name + warning, if safe</td>
<td>block</td>
</tr>
<tr>
<td>unsupported conditional/validation rule</td>
<td>materialize visible style or omit behavior + warning</td>
<td>block</td>
</tr>
<tr>
<td>missing image</td>
<td>block</td>
<td>block</td>
</tr>
<tr>
<td>overlay z-order differs</td>
<td>warn if visual comparison passes</td>
<td>block on material difference</td>
</tr>
<tr>
<td>cell text exceeds format limit</td>
<td>block with location</td>
<td>block</td>
</tr>
</table>
Every warning identifies Spreadsheet ID, revision, stable row/column/cell/overlay identity, and the exported A1 location when one exists.
# Security and operational limits
- Authorize exact project/resource/revision before pinning and again before download.
- Launch the pinned Python executable directly with `exec.CommandContext`; never invoke a shell or interpolate user-controlled command text.
- Give the worker only attempt-local request, snapshot, asset, output, and result paths. It receives no database credentials, object-store credentials, network access, or ambient project filesystem access.
- Resolve every `asset://<stable-id>` through the Go-owned attempt manifest. Reject absolute paths, `..`, symlinks that escape the attempt root, duplicate asset IDs, and media whose digest or declared type does not match.
- Escape cell strings as data. A Taurus text value beginning with `=`, `+`, `-`, or `@` must never become a formula merely because Excel interprets it that way.
- Formula cells are emitted only through the typed formula translator.
- Strip macros, ActiveX, OLE packages, external workbook links, and uncontrolled relationships.
- Never fetch external media or data during export.
- Bound axis count, non-empty cells, text bytes, style count, formula AST size, spill area, named ranges, rules, chart points, media bytes/pixels, output bytes, CPU, memory, and temporary disk.
- Sanitize filenames and use `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
- Logs include IDs, revision, counts, mode, timings, warnings, library version, output size, and checksum prefix—not cell contents or formulas.
# Validation and acceptance corpus
Every ready XLSX must:
1. reopen successfully with Excelize as an independent test reader and with an independent OOXML parser;
2. pass Open XML SDK package validation in CI;
3. contain exactly one visible worksheet;
4. match expected axes, cells, types, formulas, names, styles, hidden state, dimensions, panes, rules, overlays, and charts;
5. contain no macros, external workbook links, unsafe relationships, or hidden metadata sheet;
6. open without repair in Microsoft Excel and LibreOffice Calc;
7. preserve critical displayed values under the approved formula and precision policy, including the accepted Taurus cached value for every translated formula;
8. produce a deterministic normalized package for identical input, options, and exporter version.
Minimum corpus:
- sparse grids and very distant cells;
- exact rationals, long integers, leading zeros, booleans, text, nulls;
- approved formulas, unsupported formulas, last-good results, prompt cells;
- named ranges, spills, lists/records/tables, collisions;
- styles, formats, wrapped text, borders, hidden axes, frozen panes;
- validations and conditional formatting;
- images with offsets/crop and all supported native chart types;
- CJK, RTL, emoji, long text, and formula-injection strings;
- normal/`constant_memory` thresholds, row-order enforcement, large sheets, cancellation, memory/output limits;
- malicious links, invalid media, oversized ZIP parts, and cross-project FileIDs.
# Implementation sequence
1. Pin Python and XlsxWriter 3.2.9; record BSD-2-Clause license, lockfile, owner, worker image, SBOM, and replacement contract. Pin Excelize 2.11.0 only in the Go validation toolchain.
2. Freeze `SpreadsheetOfficeSnapshotV2`, the file-based worker protocol, decimal-string revisions, axis projection, result manifest, warnings, and limits.
3. Implement sheet naming, row-major chunk encoding, axis mapping, literal values, exact-number policy, geometry, and immutable XlsxWriter format cache.
4. Implement the formula registry/compiler, cached accepted results, dynamic-array allowlist, and explicit materialization paths.
5. Implement defined names, spills, panes, rules, images with accessibility descriptions, and native-chart/snapshot policies.
6. Add render-plan selection for normal versus `constant_memory` mode, including preflight rejection of incompatible features and enforcement of monotonically increasing row order.
7. Integrate durable jobs, exact revision pinning, direct subprocess invocation, cancellation, retry, sealing, and delivery.
8. Add Excelize/package validation, Open XML SDK validation, and Excel/LibreOffice golden fixtures.
9. Consider Excelize as a production fallback or UniOffice as a paid replacement only after recording a blocking XlsxWriter gap.
# Sources
- [Model — Spreadsheet Capability & Runtime Contract](https://app.notion.com/p/3abb6410e5028179a844c0af77b21ffe)
- [XlsxWriter documentation](https://xlsxwriter.readthedocs.io/), [formula and cached-value behavior](https://xlsxwriter.readthedocs.io/working_with_formulas.html), [defined names](https://xlsxwriter.readthedocs.io/workbook.html), [constant-memory mode](https://xlsxwriter.readthedocs.io/working_with_memory.html), [charts](https://xlsxwriter.readthedocs.io/working_with_charts.html), and [worksheet media/accessibility APIs](https://xlsxwriter.readthedocs.io/worksheet.html)
- [XlsxWriter PyPI release and BSD-2-Clause metadata](https://pypi.org/project/XlsxWriter/) and [source repository](https://github.com/jmcnamara/XlsxWriter)
- [Excelize introduction, version, license, and compatibility](https://xuri.me/excelize/en/) and [cell/formula API](https://xuri.me/excelize/en/cell.html)
- [Export — Spreadsheet to PDF](https://app.notion.com/p/3acb6410e50281ffb153c8565943f650)
- [UniOffice product](https://unidoc.io/unioffice/) and [pricing](https://unidoc.io/pricing/)
- [Microsoft Open XML SDK](https://github.com/dotnet/Open-XML-SDK), [`OpenXmlValidator`](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.validation.openxmlvalidator.validate), and [ECMA-376](https://ecma-international.org/publications-and-standards/standards/ecma-376/)
- [Apache POI component overview](https://poi.apache.org/components/) and [Apache-2.0 license](https://poi.apache.org/legal.html)
- [SOL X 78 — Export Pipeline: Office & Native Rendering](https://app.notion.com/p/39ab6410e5028161afcbedc98c3bb809) and [SOL Y 104 — Open-Source Library Decision Matrix](https://app.notion.com/p/39ab6410e50281f18edbd7538ac2e17e)

