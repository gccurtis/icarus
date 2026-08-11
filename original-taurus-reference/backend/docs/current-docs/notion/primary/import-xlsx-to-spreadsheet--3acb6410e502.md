---
title: "Import - XLSX to Spreadsheet"
notion_page_id: "3acb6410e5028182b958fcd202736a6c"
notion_url: "https://app.notion.com/3acb6410e5028182b958fcd202736a6c"
project: "Taurus Yesod"
role: "Primary"
format: "Spec"
created: "2026-07-29 05:49:08Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Import - XLSX to Spreadsheet

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Reviewed decision · Import only · Research refreshed: 2026-07-29.** Keep Excelize 2.11.0 as the XLSX parser, but run it in an isolated Go worker that emits a small versioned JSON manifest, per-worksheet JSON metadata, row-major NDJSON cell chunks, bounded assets, and diagnostics. The parent Go runtime strictly decodes and validates those files, creates each Spreadsheet base, records provenance, and commits. Import remains best effort and never merges into an existing Spreadsheet.
# Executive decision
Use [`Excelize`](https://xuri.me/excelize/en/)[ v2.11.0](https://xuri.me/excelize/en/) as the default XLSX importer, pinned exactly. It is BSD-3-Clause, pure Go, requires Go 1.25+, reads XLSX without Excel, and exposes values, formulas, types, rich text, styles, rows/columns, merges, defined names, panes, validations, conditional formats, tables, pictures, and workbook/sheet metadata. Its row iterator and exact raw-value access fit the sparse Taurus grid better than the alternatives. Version 2.11.0 also includes important hostile-workbook allocation and parser hardening, but parsing still belongs in a resource-limited subprocess rather than the long-lived application process.
An XLSX workbook is a package containing worksheets; Taurus has no Workbook aggregate. **Each visible ordinary worksheet becomes one independent Taurus Spreadsheet resource.** Hidden and very-hidden worksheets, chart sheets, and dialog sheets are skipped. If a future UI imports one selected worksheet into a destination flow, selection happens before commit; V1 still creates a new Spreadsheet and never merges cells into an existing resource.
Excelize does not expose a high-level API for reading existing chart definitions. V1 therefore drops XLSX charts. Do not add a fragile chart-XML parser simply to claim broader support. Pictures do have a supported read API and import as grid-anchored overlays.
Keep [`openpyxl`](https://openpyxl.readthedocs.io/en/stable/) as a comparison tool for failing fixtures, not the default. It is MIT and reads workbooks, but adds Python and does not calculate formulas. Keep [UniOffice](https://unidoc.io/unioffice/) as the commercial fallback only if a customer corpus exposes a blocking Excelize read gap.
# Governing import law
1. One visible worksheet becomes one Spreadsheet; the XLSX workbook itself does not become a Taurus resource.
2. V1 creates resources and never merges into existing Spreadsheets.
3. Preserve literals, supported formulas, sparse structure, row/column geometry, hidden axes, basic styles, named ranges, panes, simple rules, and embedded pictures.
4. If a formula cannot be translated exactly enough, materialize its cached value. If no cached value exists, leave the cell empty or in a clear error state and diagnose it.
5. Skip workbook-only and unsupported features. Do not create hidden metadata resources, synthetic sheets, or opaque OOXML extensions.
6. Per-sheet best effort is allowed: the import batch may create valid visible worksheets even if another worksheet is skipped or fails validation. No individual Spreadsheet is partially committed.
The canonical destination is [Model — Spreadsheet Capability & Runtime Contract](https://app.notion.com/p/3abb6410e5028179a844c0af77b21ffe): a single sparse grid with stable rows, columns, cells, named ranges, spills, rules, freeze panes, formula/prompt cells, and grid-anchored overlays.
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
<td>[`Excelize`](https://pkg.go.dev/github.com/xuri/excelize/v2)[ v2.11.0](https://pkg.go.dev/github.com/xuri/excelize/v2)</td>
<td>BSD-3-Clause; pure Go 1.25+</td>
<td>Actively maintained; streaming; cells/formulas/styles/geometry/names/panes/rules/pictures; ZIP read limits</td>
<td>No high-level existing-chart reader; formula calculation is incomplete</td>
<td>**Default**</td>
</tr>
<tr>
<td>[`openpyxl`](https://openpyxl.readthedocs.io/en/stable/)</td>
<td>MIT; Python</td>
<td>Mature workbook reader with `data_only` mode</td>
<td>Does not calculate formulas and offers no demonstrated corpus advantage for the supported baseline</td>
<td>**Fixture comparison only**</td>
</tr>
<tr>
<td>[UniOffice](https://unidoc.io/unioffice/)</td>
<td>Commercial; pure Go</td>
<td>Unified offline Office API and support</td>
<td>Quote-based licensing; unnecessary unless a measured gap blocks customers</td>
<td>**Commercial fallback**</td>
</tr>
<tr>
<td>[Open XML SDK](https://github.com/dotnet/Open-XML-SDK)</td>
<td>MIT; .NET</td>
<td>Full low-level package access and validation</td>
<td>Extra runtime and extensive owned mapping</td>
<td>**Validator/forensics only**</td>
</tr>
</table>
Do not use Excel/LibreOffice automation. Import must be deterministic, server-safe, on-premises capable, and independent of a desktop Office installation.
# Workbook-to-resource policy
```plain text
visible worksheet "Revenue"    → Spreadsheet "Revenue"
visible worksheet "Forecast"   → Spreadsheet "Forecast"
hidden worksheet "Lookups"     → skipped + diagnostic
chart sheet "Dashboard Chart"  → skipped + diagnostic
workbook-level metadata        → provenance only when safe and useful
```
Rules:
- Preserve workbook order in the import receipt, not as a cross-resource ordering guarantee.
- Use the worksheet name as the resource-name suggestion after sanitization.
- If names collide after sanitization, append a deterministic short suffix.
- Skip hidden/very-hidden sheets.
- Attempt to read only ordinary grid worksheets. A sheet that has no row stream and is a chart/dialog sheet is skipped.
- A completely empty visible worksheet may create an empty Spreadsheet if it is a real worksheet and within the requested import selection.
- Workbook-level formula dependencies do not create hidden Taurus resources.
Cross-sheet formulas and workbook names are handled per destination worksheet, never as live cross-resource references.
# Runtime architecture
XLSX import is a deferred durable job. Excelize remains the best parser, but it runs in a short-lived, resource-limited Go worker. The language is not the reason for the boundary: hostile ZIP/XML parsing, memory isolation, cancellation, reproducibility, and replaceability are.
```plain text
POST /spreadsheets/import?format=xlsx
  → authorize (user, project)
  → persist immutable source File + SHA-256
  → enqueue spreadsheet.import.xlsx
  → parent Go inspects OOXML package and enforces ZIP/content limits
  → isolated Go worker opens the attempt-local source with Excelize
  → worker plans visible ordinary worksheets
  → worker emits result.json + worksheet metadata JSON + cell NDJSON + assets
  → parent Go verifies every schema, URI, digest, count, and limit
  → parent maps accepted sheets into capability-owned SpreadsheetImportDraft values
  → accepted media become project-scoped Files
  → commit each Spreadsheet atomically with per-sheet idempotency
  → return batch receipt with created/skipped/failed sheets
```
```plain text
core/capability/spreadsheet/              canonical model and import port
core/integration/office/xlsx/import/      parent job adapter, strict decoder, mapping, commit
workers/office-xlsx-go-import/            Excelize 2.11.0 parser and chunk writer only
workers/office-contracts/xlsx-import-v2/  generated/versioned JSON schemas
core/platform/job/                        durable job execution
tests/fixtures/office/xlsx-import/        golden, lossy, scale, hostile fixtures
```
# Process and JSON/NDJSON boundary
Go launches the pinned worker directly with `exec.CommandContext`, never through a shell:
```plain text
taurus-office-xlsx-import-worker import \
  --request /attempt/request.json \
  --source /attempt/input/source.xlsx \
  --output /attempt/output \
  --result /attempt/result.json
```
The worker never receives database, project, object-store, or canonical identity authority. Standard output and error are bounded operational logs. It writes every metadata/chunk/asset file first and writes `result.json` last as the completion sentinel.
```go
type XlsxImportWorkerRequestV2 struct {
    SchemaVersion        int              `json:"schemaVersion"` // exactly 2
    SourceSHA256         string           `json:"sourceSha256"`
    MappingPolicyVersion string           `json:"mappingPolicyVersion"`
    SelectedSheets       []SheetSelector  `json:"selectedSheets,omitempty"`
    Limits               XlsxImportLimits `json:"limits"`
}

type XlsxImportWorkerResultV2 struct {
    SchemaVersion int                 `json:"schemaVersion"`
    Format        string              `json:"format"`
    SourceSHA256  string              `json:"sourceSha256"`
    Parser        ParserIdentity      `json:"parser"`
    Worksheets    []WorksheetDraftRef `json:"worksheets"`
    Assets        []CheckedAssetRef   `json:"assets"`
    Diagnostics   []ImportDiagnostic  `json:"diagnostics"`
    Counts        XlsxImportCounts    `json:"counts"`
}

type WorksheetDraftRef struct {
    SourceOrdinal int              `json:"sourceOrdinal"`
    SourceName    string           `json:"sourceName"`
    Metadata      CheckedFileRef   `json:"metadata"`
    CellChunks    []CheckedFileRef `json:"cellChunks"`
}
```
```json
{
  "schemaVersion": 2,
  "format": "xlsx",
  "sourceSha256": "<hex>",
  "parser": {"name": "excelize", "version": "2.11.0"},
  "worksheets": [
    {
      "sourceOrdinal": 0,
      "sourceName": "Revenue",
      "metadata": {"uri": "draft://sheet-0/meta.json", "sha256": "<hex>", "bytes": 3180},
      "cellChunks": [
        {"uri": "chunk://sheet-0/cells-000001.ndjson", "sha256": "<hex>", "bytes": 65536, "records": 900}
      ]
    }
  ],
  "assets": [],
  "diagnostics": [],
  "counts": {"worksheets": 1, "cells": 900}
}
```
`meta.json` carries bounded rows, columns, presentations, names, rules, panes, overlays, and source locators. Each NDJSON record carries one meaningful source cell in monotonically increasing `(rowOrdinal, columnOrdinal)` order. Exact numeric lexemes, exact rationals, formula source, and cached results are JSON strings; they never cross `float64`. Empty formatting-only cells are absent.
```json
{"sheet":0,"axis":"B7","row":7,"column":2,"kind":"formula","sourceFormula":"SUM(B2:B6)","cached":{"kind":"number","number":"12345/100"},"styleRef":"s4"}
```
The result manifest stays small even for large workbooks. Go streams each chunk through a bounded `json.Decoder` with unknown-field rejection, record/count limits, monotonic-order checks, and EOF validation; it does not load a workbook-sized JSON array.
Before decoding content, Go verifies:
1. schema version, format, source digest, parser/version, policy version, selected-sheet plan, and attempt identity;
2. every `draft://`, `chunk://`, and `asset://` URI resolves beneath the attempt root;
3. no absolute path, `..`, symlink escape, duplicate logical ID, undeclared file, or digest/size/media mismatch exists;
4. manifest counts equal decoded counts and remain inside sheet, row, column, cell, style, formula, rule, media, and output limits;
5. worker output contains no ResourceID, SpreadsheetID, RowID, ColumnID, CellID, FileID, revision, project, author, or database key.
After validation, the parent derives deterministic stable IDs from `(source SHA-256, worksheet identity, source coordinate, kind)`, translates formulas through the canonical Formula registry, ingests accepted media, and asks the Spreadsheet capability to validate and commit each complete proposal. The worker can describe source content; it cannot authorize or commit it.
# Capability contracts
```go
type XlsxImportRequest struct {
    ProjectID       string
    UserID          string
    SourceFileID    string
    SourceSHA256    string
    SelectedSheets  []string // empty means all visible ordinary worksheets
    IdempotencyKey  string
}

type WorksheetImportStatus struct {
    SourceName     string
    SourceOrdinal  int
    Status         string // created | skipped | failed
    SpreadsheetID  string
    Diagnostics    []ImportDiagnostic
}

type XlsxImportReceipt struct {
    ImportID      string
    SourceFileID  string
    SourceSHA256  string
    Worksheets    []WorksheetImportStatus
}

type SpreadsheetImporter interface {
    CreateImportedSpreadsheet(
        ctx context.Context,
        scope spreadsheet.Scope,
        author spreadsheet.Author,
        draft spreadsheet.ImportDraft,
        provenance spreadsheet.ImportProvenance,
    ) (spreadsheet.Spreadsheet, error)
}
```
```go
type SpreadsheetImportDraft struct {
    SchemaVersion int
    SuggestedName string
    Rows          []ImportRow
    Columns       []ImportColumn
    Cells         []ImportCell
    NamedRanges   []ImportNamedRange
    Rules         []ImportRule
    Freeze        spreadsheet.FreezePane
    Overlays      []ImportOverlay
    Assets        []ImportedAsset
    Diagnostics   []ImportDiagnostic
}

type ImportCell struct {
    SourceAxis   string // A1 for diagnostics only
    RowOrdinal  int
    ColOrdinal  int
    Kind        string // literal | formula
    Literal     spreadsheet.CellValue
    Formula     *ImportFormula
    Display     spreadsheet.CellDisplay
    Presentation spreadsheet.CellPresentation
}

type ImportFormula struct {
    SourceExpression string
    TaurusExpression string
    CachedValue      spreadsheet.CellValue
    Translation      string // exact | materialized | unavailable
}
```
Stable RowIDs, ColumnIDs, and CellIDs are deterministically derived from source hash, worksheet identity, and source coordinate, then admitted by the capability. A1 is provenance and mapping input, not permanent identity.
# Opening and limits
Inside the isolated worker, Excelize supports `OpenReader` and exposes `UnzipSizeLimit`, `UnzipXMLSizeLimit`, `RawCellValue`, and `TmpDir`. Use limits far below the library defaults and an attempt-local directory:
```go
file, err := excelize.OpenReader(source, excelize.Options{
    RawCellValue:      true,
    UnzipSizeLimit:    policy.MaxUncompressedBytes,
    UnzipXMLSizeLimit: policy.MaxWorksheetXMLBytes,
    TmpDir:            attemptDir,
})
if err != nil {
    return classifyXlsxOpenError(err)
}
defer file.Close()
```
Perform shared Office ZIP inspection first. Accept `.xlsx` content types only. Reject `.xls`, `.xlsm`, `.xlam`, `.xltm`, encrypted/password-protected packages, macros, path traversal, duplicate normalized parts, DTD/entity behavior, and configured-limit overflow.
```go
type XlsxImportLimits struct {
    OfficeZipLimits
    MaxVisibleSheets     int
    MaxRowsPerSheet      int
    MaxColumnsPerSheet   int
    MaxAllocatedCells    int
    MaxFormulaBytes      int64
    MaxRichTextRuns      int
    MaxPictures          int
    MaxPictureBytes      int64
    MaxImagePixels       int64
    MaxRules             int
    MaxNamedRanges       int
}
```
# Worksheet planning
```go
func PlanWorksheets(f *excelize.File, selected map[string]bool) []SheetPlan {
    plans := make([]SheetPlan, 0)
    for ordinal, name := range f.GetSheetList() {
        if len(selected) > 0 && !selected[name] {
            continue
        }
        visible, err := f.GetSheetVisible(name)
        if err != nil || !visible {
            plans = append(plans, skippedSheet(name, ordinal, "XLSX_HIDDEN_SHEET_DROPPED"))
            continue
        }
        plans = append(plans, SheetPlan{Name: name, Ordinal: ordinal})
    }
    return plans
}
```
`GetSheetList` may include chart/dialog sheets. The mapper attempts an ordinary row stream. A non-grid sheet is skipped with `XLSX_NON_WORKSHEET_DROPPED`; it is not converted into an image or Deck.
# Sparse grid traversal
Use `Rows()` rather than allocating `GetRows()` for large sheets:
```go
rows, err := file.Rows(sheet)
if err != nil {
    return classifyNonWorksheetOrReadFailure(err)
}
defer rows.Close()

rowOrdinal := 0
for rows.Next() {
    rowOrdinal++
    values, err := rows.Columns(excelize.Options{RawCellValue: true})
    if err != nil {
        return err
    }
    enforceRowAndColumnLimits(rowOrdinal, len(values))
    for colOrdinal, raw := range values {
        axis, _ := excelize.CoordinatesToCellName(colOrdinal+1, rowOrdinal)
        importCellIfMeaningful(file, sheet, axis, raw, draft)
    }
}
if err := rows.Error(); err != nil {
    return err
}
```
The iterator omits blank tail cells. V1 deliberately ignores empty cells that carry only Office formatting, comments, or protection. Allocate a Taurus cell only when it has a literal, formula, accepted rich text, presentation that matters to a non-empty cell, or a stable reference from a supported named range/rule.
The used dimension is a safety hint, not authority. Reject absurd dimensions before walking them; do not allocate dense arrays for sparse sheets.
# Values and exactness
<table header-row="true">
<tr>
<td>XLSX cell</td>
<td>Taurus value</td>
<td>Rule</td>
</tr>
<tr>
<td>blank</td>
<td>absent</td>
<td>Do not allocate.</td>
</tr>
<tr>
<td>shared/inline string</td>
<td>text</td>
<td>Preserve normalized Unicode and supported rich-text marks.</td>
</tr>
<tr>
<td>Boolean</td>
<td>logic</td>
<td>Native Boolean.</td>
</tr>
<tr>
<td>numeric integer/decimal</td>
<td>exact rational</td>
<td>Parse the raw stored decimal lexeme exactly; do not round-trip through `float64`.</td>
</tr>
<tr>
<td>date/time-formatted numeric</td>
<td>exact timestamp/date display or supported cell value</td>
<td>Interpret only when number format and workbook date system are unambiguous.</td>
</tr>
<tr>
<td>error</td>
<td>cell diagnostic + optional display text</td>
<td>Do not invent a Formula value kind.</td>
</tr>
<tr>
<td>formula</td>
<td>translated formula or cached literal</td>
<td>See formula policy.</td>
</tr>
</table>
```go
func decimalLexemeToRational(raw string) (ExactRational, error) {
    // Parse sign, decimal coefficient, and exponent with big.Int.
    // Return numerator/denominator in lowest terms.
}
```
Preserve leading-zero identifiers as text when the stored type is string. Do not infer a number from a displayed string.
For dates:
- read workbook `Date1904` behavior through workbook properties;
- treat Excel serial 60 in the 1900 date system according to an explicit compatibility rule;
- retain the original number format as presentation;
- if format interpretation is ambiguous or locale-dependent, keep the raw exact number plus display string and diagnose rather than guessing a timestamp.
# Formulas
Excelize exposes `GetCellFormula` and `GetCellValue`; the latter returns the stored/cached value with formatting unless raw mode is requested. Excelize's `CalcCellValue` explicitly does not support every formula class. It must not be the import authority.
```go
func importFormulaCell(
    f *excelize.File,
    sheet, axis string,
    translator FormulaTranslator,
) ImportCell {
    source, _ := f.GetCellFormula(sheet, axis)
    rawCached, _ := f.GetCellValue(sheet, axis, excelize.Options{RawCellValue: true})
    displayCached, _ := f.GetCellValue(sheet, axis)

    translated, err := translator.TranslateSameSheetExcelFormula(source)
    if err == nil {
        return exactFormulaCell(axis, source, translated, rawCached, displayCached)
    }
    return materializedCell(axis, source, rawCached, displayCached)
}
```
Translate only an explicit registry of operators/functions whose semantics match Taurus Formula. Resolve same-sheet A1/range references to the newly assigned stable RowIDs/ColumnIDs. Re-parse the produced Taurus expression with the canonical Formula parser before accepting it.
<table header-row="true">
<tr>
<td>Formula class</td>
<td>V1 behavior</td>
</tr>
<tr>
<td>approved same-sheet scalar/range formula</td>
<td>import as Taurus formula; retain cached value as `LastGoodValue`</td>
</tr>
<tr>
<td>supported named range local to destination sheet</td>
<td>translate to Taurus named-range reference</td>
</tr>
<tr>
<td>cross-sheet reference</td>
<td>materialize cached value; drop live formula</td>
</tr>
<tr>
<td>external workbook/link/data connection</td>
<td>materialize cached value; drop relationship</td>
</tr>
<tr>
<td>shared formula</td>
<td>expand to the cell's effective expression if Excelize exposes it reliably; otherwise materialize</td>
</tr>
<tr>
<td>array/table formula or dynamic array</td>
<td>materialize cached cells; do not reconstruct spill authority</td>
</tr>
<tr>
<td>unsupported function/operator</td>
<td>materialize cached value</td>
</tr>
<tr>
<td>formula with no cached value</td>
<td>create a clear formula diagnostic or empty literal according to product policy; never guess a result</td>
</tr>
</table>
Diagnostics distinguish `XLSX_FORMULA_MATERIALIZED`, `XLSX_CROSS_SHEET_FORMULA_MATERIALIZED`, and `XLSX_FORMULA_VALUE_UNAVAILABLE`.
# Rows, columns, geometry, and visibility
Create stable axes through the highest accepted content/rule/overlay bound, capped by policy. Preserve:
- worksheet row order and column order;
- explicit row height and column width;
- hidden rows and columns;
- default presentation;
- freeze panes when they form a supported top-row/left-column split.
Convert row height from points to pixels:
```go
func pointsToPX(points float64) int32 {
    return int32(math.Round(points * 96.0 / 72.0))
}
```
Excel column width depends on the workbook's font metrics. Use one centralized, fixture-tested approximation for Taurus pixels and record `XLSX_COLUMN_WIDTH_APPROXIMATED` when a non-default explicit width is imported. Do not spread width heuristics across the mapper.
Outline/group levels, print areas, page layout, repeated print titles, page breaks, and view zoom are skipped.
# Styles and rich text
For a meaningful cell:
1. obtain style ID with `GetCellStyle`;
2. resolve it with `GetStyle`;
3. map supported font, fill, border, alignment, wrap, and number-format fields;
4. normalize theme/indexed colors to concrete Taurus colors;
5. deduplicate equal `CellPresentation` values;
6. skip protection and unsupported effects.
`GetCellRichText` may provide run-level font/text. Convert supported runs to `SpreadsheetRichContent`; otherwise retain visible text as a literal. Limit run count and total text bytes.
Supported style subset:
- font family, size, bold, italic, underline, strike, color;
- solid fill;
- top/right/bottom/left borders with supported style/color;
- horizontal/vertical alignment, wrap, text rotation within destination bounds;
- number format mapped to a Taurus format or retained as a safe display-format string.
Gradients, patterns without an analogue, diagonal borders, phonetic runs, conditional style layers not mapped as rules, and cell protection are skipped.
# Merges
The Taurus Spreadsheet model has no merged-cell primitive. For every merged range:
- retain the top-left cell content and presentation;
- leave the other cells as their normal imported state/empty state;
- do not synthesize an overlay or span;
- record `XLSX_MERGE_DROPPED` with the source range.
Excelize documents that merged ranges expose the top-left value for all cells; the mapper must explicitly de-duplicate those coordinates so the value is not copied into every Taurus cell.
# Named ranges
Excelize exposes workbook and worksheet defined names. Import only names that:
- have a valid Taurus name;
- resolve to one static rectangular range;
- refer entirely to the current destination worksheet;
- remain within imported axes;
- do not use formulas, unions, intersections, external books, dynamic functions, print areas, or hidden system names.
Worksheet-scoped names import to that Spreadsheet. Workbook-scoped names that refer entirely to one worksheet may import into that worksheet, provided no collision exists. Cross-sheet and dynamic names are skipped.
```go
func mapDefinedName(name excelize.DefinedName, sheet string) (ImportNamedRange, bool) {
    ref, ok := parseSingleSheetRectangle(name.RefersTo)
    if !ok || ref.Sheet != sheet || isSystemDefinedName(name.Name) {
        return ImportNamedRange{}, false
    }
    return namedRangeFromA1(name.Name, ref.Range), true
}
```
# Panes, validations, and conditional rules
Map freeze panes using `GetPanes` only when they describe a simple top/left freeze compatible with `FreezePane`. Split panes and multiple view states are skipped.
Excelize exposes `GetDataValidations` and `GetConditionalFormats`. Import a narrow subset into `GridRule`:
- numeric/text/date comparison validations with static operands;
- explicit list validation with bounded literal items;
- simple cell-value conditional rules;
- supported fill/font emphasis whose predicates translate exactly.
Drop custom formulas, cross-sheet references, icon sets, data bars, color scales, duplicate/unique rules, and ambiguous priority/stop-if-true behavior unless the Spreadsheet rule model later defines exact equivalents.
Rules outside imported axes are skipped. An unsupported rule never blocks cell import.
# Tables and filters
Excel tables are not a Taurus aggregate. Import the underlying cells normally.
- Drop table name, totals-row behavior, structured references not already materialized, banding, table style, calculated columns, slicers, and table object identity.
- Formula cells using structured references are materialized from cache unless the translator explicitly supports them.
- Drop AutoFilter state and hidden-filter semantics in V1.
- Record one coalesced `XLSX_TABLE_SEMANTICS_DROPPED` diagnostic per table.
# Pictures and overlays
Excelize exposes picture cells and raw embedded bytes. Import supported pictures as Taurus image overlays:
```go
cells, err := file.GetPictureCells(sheet)
for _, axis := range cells {
    pictures, err := file.GetPictures(sheet, axis)
    // validate bytes, ingest File, map anchor/offset/scale to GridBounds
}
```
Rules:
- the picture's source cell becomes the stable start anchor;
- supported offsets/scales map to `GridBounds`;
- when the end anchor is unavailable, derive bounds from decoded pixel dimensions and current row/column geometry;
- validate and deduplicate bytes through the File capability;
- preserve alt text only if exposed;
- drop unsupported image effects, hyperlinks, external images, and incomplete formatting metadata;
- record `XLSX_PICTURE_BOUNDS_APPROXIMATED` when exact two-cell anchors cannot be reconstructed.
# Charts and other overlays
Excelize v2.11.0 has chart creation/deletion APIs but no high-level API for reading existing chart definitions. V1 therefore:
- detects chart parts/relationships only to count affected sheets;
- drops every chart;
- emits `XLSX_CHARTS_DROPPED`;
- does not render a chart snapshot;
- does not parse chart XML through internal Excelize types;
- does not block the worksheet.
Also drop shapes, form controls, sparklines, pivot tables, pivot charts, slicers, timelines, signatures, embedded packages, and external data connections. They remain in the immutable source File only, not in the canonical Spreadsheet.
# Explicitly skipped features
<table header-row="true">
<tr>
<td>Source feature</td>
<td>V1 behavior</td>
<td>Diagnostic</td>
</tr>
<tr>
<td>hidden/very-hidden sheet</td>
<td>skip resource</td>
<td>`XLSX_HIDDEN_SHEET_DROPPED`</td>
</tr>
<tr>
<td>chart/dialog sheet</td>
<td>skip resource</td>
<td>`XLSX_NON_WORKSHEET_DROPPED`</td>
</tr>
<tr>
<td>charts</td>
<td>skip</td>
<td>`XLSX_CHARTS_DROPPED`</td>
</tr>
<tr>
<td>merges</td>
<td>top-left content only</td>
<td>`XLSX_MERGE_DROPPED`</td>
</tr>
<tr>
<td>cross-sheet/external formula</td>
<td>cached value only</td>
<td>`XLSX_CROSS_SHEET_FORMULA_MATERIALIZED`</td>
</tr>
<tr>
<td>pivot/slicer/sparkline/form control/shape</td>
<td>skip</td>
<td>format-specific dropped diagnostic</td>
</tr>
<tr>
<td>comments/notes/review authors</td>
<td>drop</td>
<td>`XLSX_COMMENTS_DROPPED`</td>
</tr>
<tr>
<td>table/filter semantics</td>
<td>cells only</td>
<td>`XLSX_TABLE_SEMANTICS_DROPPED`</td>
</tr>
<tr>
<td>protection/locked/hidden formulas</td>
<td>drop protection</td>
<td>`XLSX_PROTECTION_DROPPED`</td>
</tr>
<tr>
<td>print/page setup</td>
<td>drop</td>
<td>`XLSX_PRINT_LAYOUT_DROPPED`</td>
</tr>
<tr>
<td>macros/active content</td>
<td>reject non-XLSX active formats</td>
<td>`XLSX_ACTIVE_CONTENT_REJECTED`</td>
</tr>
<tr>
<td>encrypted/password package</td>
<td>reject in V1</td>
<td>`XLSX_ENCRYPTED_UNSUPPORTED`</td>
</tr>
</table>
# Batch commit, persistence, and concurrency
Build and validate all selected sheet drafts first. Then commit each Spreadsheet in its own transaction:
```go
for _, draft := range plannedDrafts {
    spreadsheet, err := importer.CreateImportedSpreadsheet(
        ctx, scope, author, draft, provenance.ForSheet(draft.SourceSheet),
    )
    receipt.Record(draft.SourceSheet, spreadsheet, err)
}
```
This permits best-effort partial success across a workbook while preserving the stronger invariant that no individual Spreadsheet is partially visible. A failed sheet has no resource ID and may be retried. Successfully created sheets are not rolled back merely because a different sheet is invalid.
Each imported Spreadsheet begins with its canonical base at `Revision=0`, `BaseSeq=0`, or with one standardized server-owned `apply_import_result` ChangeSet if that becomes the shared capability convention. Never append a ChangeSet per cell.
Per-sheet idempotency key:
```plain text
project ID
+ source FileID/SHA-256
+ normalized source worksheet identity
+ Excelize version
+ importer contract version
+ mapping-policy version
+ caller idempotency key
```
Retrying a batch returns existing successes and retries only unresolved sheet results. Reusing the caller key for a different source/selection is a conflict.
Provenance records source file/hash, workbook/sheet identity, importer versions, policy version, source dimensions, created resource ID, and diagnostics. It does not store an Office workbook model inside the Spreadsheet.
# Diagnostics and receipt
```go
const (
    DiagXlsxFormulaMaterialized       = "XLSX_FORMULA_MATERIALIZED"
    DiagXlsxCrossSheetMaterialized    = "XLSX_CROSS_SHEET_FORMULA_MATERIALIZED"
    DiagXlsxFormulaValueUnavailable   = "XLSX_FORMULA_VALUE_UNAVAILABLE"
    DiagXlsxMergeDropped              = "XLSX_MERGE_DROPPED"
    DiagXlsxChartsDropped             = "XLSX_CHARTS_DROPPED"
    DiagXlsxTableSemanticsDropped     = "XLSX_TABLE_SEMANTICS_DROPPED"
    DiagXlsxPictureBoundsApproximated = "XLSX_PICTURE_BOUNDS_APPROXIMATED"
)
```
The batch receipt lists every requested worksheet in source order with status, created resource ID, imported row/column/cell/formula/picture/rule/name counts, and coalesced diagnostics.
# Security and privacy
- Treat the workbook as hostile ZIP/XML input even though the parser is written in Go.
- Launch the pinned worker directly with `exec.CommandContext`; never invoke a shell or accept user-controlled argv.
- Give the worker no network, database, project storage, provider keys, reusable credentials, or ambient filesystem access.
- Enforce strict compressed, uncompressed, XML, worksheet, cell, string, formula, media, and decoded-pixel limits.
- Use an attempt-local temp directory; clean it through the job lifecycle.
- Reject macros, active content formats, encrypted files, DTD/entity behavior, traversal/duplicate entries, and external relationships.
- Never fetch external links, linked pictures, data connections, or workbook references.
- Never execute formulas, VBA, embedded packages, queries, OLE, or form controls.
- Do not use Excelize calculation as authority.
- Ingest accepted images through the project-scoped File capability.
- Ensure diagnostics/logs contain bounded sanitized sheet names and A1 locators.
- Recheck authorized project scope during source File read and each resource commit.
# Validation and tests
Fixture tiers:
1. **Canonical:** literals, exact decimals, dates, rich text, same-sheet formulas, styles, widths/heights, hidden axes, freeze panes, simple names/rules, pictures.
2. **Loss:** cross-sheet/external formulas, merges, tables, filters, charts, pivots, slicers, comments, protection, print layout, hidden sheets.
3. **Producer:** current Excel on Windows/macOS, LibreOffice Calc, Google Sheets download, Numbers export.
4. **Scale/adversarial:** sparse extreme dimensions, shared-string bombs, huge formulas/styles, ZIP bombs, traversal/duplicates, corrupt XML/images, excessive worksheets/cells, timeout/cancellation.
Golden tests assert canonical draft values and exact rationals, stable IDs, formulas, rules, overlay anchors, asset hashes, and diagnostics.
```go
func TestXlsxImportSplitsVisibleWorksheets(t *testing.T) {
    got := importWorkbook(t, "visible-and-hidden.xlsx")
    require.Equal(t, []string{"Revenue", "Forecast"}, got.CreatedNames())
    require.ContainsDiagnostic(t, got, "XLSX_HIDDEN_SHEET_DROPPED")
}

func TestXlsxImportMaterializesCrossSheetFormula(t *testing.T) {
    got := importWorkbook(t, "cross-sheet-formula.xlsx")
    cell := got.Sheet("Summary").Cell("B2")
    require.Equal(t, "literal", cell.Kind)
    require.ContainsDiagnostic(t, got, "XLSX_CROSS_SHEET_FORMULA_MATERIALIZED")
}

func TestXlsxImportDoesNotDuplicateMergedValue(t *testing.T) {
    got := importWorkbook(t, "merged.xlsx")
    require.Equal(t, "Quarterly Revenue", got.Sheet("Report").Cell("A1").Text())
    require.Empty(t, got.Sheet("Report").Cell("B1"))
}
```
Acceptance criteria:
- every visible ordinary worksheet becomes an independent valid Spreadsheet unless explicitly skipped/failed;
- literals and exact decimals do not silently round through `float64`;
- supported same-sheet formulas use stable destination references;
- unsupported formulas preserve cached values when available;
- charts are explicitly skipped;
- pictures import through File capability;
- no individual Spreadsheet is partially visible;
- retries are deterministic and per-sheet idempotent;
- hostile workbooks fail or skip safely within configured policy.
# Implementation sequence
1. Implement shared Office package inspection, provenance, diagnostics, durable jobs, attempt directories, and the file-based worker client.
2. Freeze `XlsxImportWorkerRequestV2`, `XlsxImportWorkerResultV2`, worksheet metadata/NDJSON schemas, URI rules, manifests, diagnostics, and limits.
3. Pin Go and Excelize 2.11.0; record BSD-3-Clause license, dependency hashes, SBOM, worker image, and no-egress profile.
4. Add `CreateImportedSpreadsheet` and a transactional canonical-base store method.
5. Implement workbook planning, visible-worksheet splitting, row-major chunking, literals, exact decimals, types, axes, geometry, visibility, and basic styles.
6. Implement strict parent-Go manifest/chunk decoding, digest/path validation, deterministic ID assignment, and capability proposal validation.
7. Implement the explicit same-sheet Formula translation registry plus cached-value materialization.
8. Add named ranges, freeze panes, simple validations/conditional rules, merge de-duplication, and embedded picture overlays.
9. Add per-sheet idempotency, partial batch success, Resource registration, receipts, cancellation, and process limits.
10. Build the producer/scale/adversarial corpus, profile memory/CPU/output growth, and test worker crashes/truncated manifests.
11. Evaluate openpyxl, low-level OOXML, or a commercial parser only against measured blocking fixtures.
# Sources and related Taurus specifications
- [Excelize official documentation and current version](https://xuri.me/excelize/en/)
- [Excelize 2.11.0 release notes, security hardening, and Go 1.25 requirement](https://github.com/qax-os/excelize/releases/tag/v2.11.0)
- [Excelize workbook/open options](https://xuri.me/excelize/en/workbook.html)
- [Excelize cell, formula, merge, and row-reading APIs](https://xuri.me/excelize/en/cell.html)
- [Excelize worksheet geometry and visibility APIs](https://xuri.me/excelize/en/sheet.html)
- [Excelize Go API index](https://pkg.go.dev/github.com/xuri/excelize/v2)
- [`openpyxl`](https://openpyxl.readthedocs.io/en/stable/)[ documentation](https://openpyxl.readthedocs.io/en/stable/)
- [Model — Spreadsheet Capability & Runtime Contract](https://app.notion.com/p/3abb6410e5028179a844c0af77b21ffe)
- [Taurus Omega runtime model](https://github.com/gccurtis/taurus-omega/blob/main/docs/architecture/runtime-model.md)
- [Export - Spreadsheet to XLSX](https://app.notion.com/p/3acb6410e50281bf9ebed3037d6cb114)

