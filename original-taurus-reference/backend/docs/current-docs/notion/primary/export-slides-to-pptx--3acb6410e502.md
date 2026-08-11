---
title: "Export - Slides to PPTX"
notion_page_id: "3acb6410e5028156bee8c6cca9f2ab87"
notion_url: "https://app.notion.com/3acb6410e5028156bee8c6cca9f2ab87"
project: "Taurus Yesod"
role: "Primary"
format: "Spec"
created: "2026-07-29 05:28:13Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Export - Slides to PPTX

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Reviewed decision · Export only · Research refreshed: 2026-07-29.** This page defines how one immutable Taurus Slides/Deck revision becomes a downloadable `.pptx`. It does not define PPTX import, editor design, round-trip reconstruction, template-library UX, or animation support.
# Executive decision
Use [`PptxGenJS`](https://github.com/gitbrent/PptxGenJS) 4.0.1, pinned exactly, in an isolated TypeScript export worker. It is MIT, requires no PowerPoint installation or proprietary runtime key, and directly supports the parts of the Taurus Slides model that matter most: custom slide sizes, sections, slide masters/placeholders, hidden slides, speaker notes, text, shapes, lines, images, tables, native charts, theme colors, and Buffer/stream output. The prior Taurus dependency policy already approved this exact package and import boundary in [SOL Y 104](https://app.notion.com/p/39ab6410e50281f18edbd7538ac2e17e).
The fit is unusually strong because Taurus stores slide geometry in integer EMUs specifically for Office interoperability. Conversion to PptxGenJS is therefore deterministic: `inches = EMU / 914400`.
Keep [UniOffice](https://unidoc.io/unioffice/) as a commercial pure-Go fallback only if the fidelity corpus finds blocking PptxGenJS gaps that cannot be repaired behind the adapter. Do not use low-level Open XML SDK or Apache POI as the primary renderer: both add a second runtime and substantially more OOXML work without a corresponding product advantage.
# Fixed-canvas fidelity contract
PPTX is much closer to Taurus Slides than DOCX is to Taurus Documents. A slide has a fixed canvas, so its page boundary and object geometry do not drift. The capability must resolve exact canvas dimensions, slide order, sections, theme/layout inheritance, z-order, transforms, accepted values, and static chart/equation/embed state before invoking the worker.
The remaining fidelity risk is inside text boxes: PowerPoint may wrap or substitute fonts differently from Taurus. The snapshot therefore carries resolved text runs plus expected line boxes. Balanced export preserves editable text and warns on material mismatch. Strict export may rasterize only the affected text object after an explicit diagnostic; it never rasterizes an entire slide silently.
Animations and transitions are outside the Taurus Slides model and are always absent from export. This is a supported omission, not a fidelity failure.
# Scope and fidelity contract
- Export one exact Deck revision and all pinned file/chart dependencies.
- Preserve slide order, section grouping, canvas size, hidden state, notes, z-order, geometry, transforms, theme/layout intent, and editable native objects where supported.
- Slides remain unnamed. Taurus stable slide IDs are implementation identity; PowerPoint presents slides positionally. Do not synthesize user-facing slide names.
- Prefer editable PowerPoint text, shapes, tables, and charts.
- Use a visual snapshot fallback only for a typed object whose semantics cannot be represented safely and only with an explicit warning.
- Never export Taurus collaboration state, ChangeSets, prompt instructions, provider state, or hidden formula history.
- Do not promise PPTX → Taurus round-trip fidelity.
- A valid ZIP is insufficient: every supported deck must pass structural and rendered-slide validation.
The canonical source is [Model — Slides Capability & Runtime Contract](https://app.notion.com/p/3abb6410e50281df8762c162e9a6eb13), which defines `Deck → SlideSection → Slide → VisualObject`, stable unnamed slide IDs, EMU geometry, ranks/z-order, theme/layout templates, notes, typed visual objects, and derived export jobs.
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
<td>[`PptxGenJS`](https://gitbrent.github.io/PptxGenJS/docs/introduction/) 4.0.1</td>
<td>MIT; TypeScript/JavaScript; Node/browser</td>
<td>High-level PPTX; sections, masters, notes, hidden slides, charts, shapes, images, tables; strong examples</td>
<td>Isolated Node worker; some advanced grouping/equation semantics need fallback</td>
<td>**Default**</td>
</tr>
<tr>
<td>[UniOffice](https://unidoc.io/unioffice/)</td>
<td>Commercial; pure Go</td>
<td>Unified Go deployment and vendor support</td>
<td>Quote-based offline licensing; published tier constraints</td>
<td>**Commercial fallback**</td>
</tr>
<tr>
<td>[Open XML SDK](https://github.com/dotnet/Open-XML-SDK)</td>
<td>MIT; .NET</td>
<td>Complete low-level format access and validation</td>
<td>Not a high-level productivity API</td>
<td>**Independent validator only**</td>
</tr>
<tr>
<td>[Apache POI XSLF](https://poi.apache.org/components/)</td>
<td>Apache-2.0; Java</td>
<td>FOSS OOXML support</td>
<td>Lower-level API and Java runtime; weaker fit than PptxGenJS</td>
<td>**Reject for V1**</td>
</tr>
</table>
# Export architecture
Use the same durable-job spine and file-based subprocess contract as DOCX and XLSX. The worker receives a complete immutable snapshot and no ambient authority.
```go
type DeckSnapshotReader interface {
    ReadDeckRevision(ctx context.Context, projectID, deckID string, revision int64) (DeckExportSnapshot, error)
}

type PptxRenderer interface {
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
taurus-office-ts-worker render
  --format pptx
  --request /attempt/request.json
  --snapshot /attempt/snapshot.json
  --assets /attempt/assets.json
  --output /attempt/artifact.pptx
  --result /attempt/result.json
```
Go invokes the worker with `exec.CommandContext` and distinct argv elements. It owns authorization, exact revision pinning, durable job state, idempotency, assets, limits, process cancellation, independent validation, artifact sealing, storage, and delivery.
```typescript
export interface DeckOfficeSnapshotV2 {
  schemaVersion: 2;
  projectId: string;
  deckId: string;
  revision: string; // decimal int64; never a JavaScript number
  name: string;
  canvas: { widthEmu: number; heightEmu: number };
  resolvedTheme: ResolvedDeckTheme;
  resolvedLayouts: readonly ResolvedLayoutTemplate[];
  slides: readonly ExportSlide[]; // final flattened order
  sectionBoundaries: readonly ExportSectionBoundary[];
  assets: readonly AssetDescriptor[];
}

export interface ExportSlide {
  id: string;
  ordinal: number;
  sectionId?: string;
  hidden: boolean;
  resolvedLayoutId?: string;
  background?: Paint;
  notes?: TextBlock;
  objects: readonly VisualObject[];
}

export interface PptxWorkerResult {
  schemaVersion: 1;
  status: "ok" | "failed";
  exporter: "pptxgenjs";
  exporterVersion: "4.0.1";
  sourceRevision: string;
  slideCount: number;
  objectCount: number;
  outputBytes: number;
  outputSha256: string;
  warnings: readonly ExportWarning[];
}
```
`assets.json` maps opaque `asset://<id>` references to attempt-local files and hashes. The worker rejects arbitrary paths and all network fetches. It receives no canonical storage credentials, database access, provider keys, secret store, or shell. JSON schema versions fail closed.
# Ordering and identity
Materialize slide order once from stable ranks before serialization:
```plain text
for each section ordered by section.rank:
    emit its slides ordered by slide.rank
emit unsectioned slides in their canonical projection position
```
`DeckOfficeSnapshotV2.slides` contains that final order plus section boundaries, so the worker never reproduces domain ordering logic.
- `SlideSection.Name` → PowerPoint section title using `addSection`.
- `Slide.ID` → manifest/debug identity only; do not create a visible name.
- derived ordinal → output slide order.
- `Slide.Hidden` → `slide.hidden = true`.
- stable object rank → insertion sequence and therefore z-order.
# Geometry and transforms
```typescript
const EMU_PER_INCH = 914_400;
const emuToInches = (emu: number): number => emu / EMU_PER_INCH;
const microdegreesToDegrees = (value: number): number => value / 1_000_000;

function frameToPosition(frame: Frame) {
  return {
    x: emuToInches(frame.xEmu),
    y: emuToInches(frame.yEmu),
    w: emuToInches(frame.widthEmu),
    h: emuToInches(frame.heightEmu),
    rotate: microdegreesToDegrees(frame.rotationMicrodegrees),
    flipH: frame.flipHorizontal,
    flipV: frame.flipVertical,
  };
}
```
Define a custom PowerPoint layout from the exact canvas width and height. Never coerce a custom Taurus canvas to standard wide or 4:3 dimensions.
Maintain full floating-point precision until the library boundary. Reject negative dimensions and geometry outside configured bounds before generation.
# Theme, layout templates, and slots
Map `DeckTheme` to PowerPoint scheme colors, fonts, and defaults. PptxGenJS exposes PowerPoint scheme color constants and custom slide masters.
For every used Taurus `LayoutTemplate`:
1. create a deterministic master name from the stable template ID;
2. emit inherited background and fixed master objects;
3. map Taurus slots to PowerPoint placeholders when the slot semantics are compatible;
4. add the slide using that master;
5. emit only explicit slide objects and overrides not already supplied by the master.
Do not duplicate master-owned objects on each slide. If a Taurus override cannot be expressed through the chosen master, materialize that object on the slide and record `PPTX_LAYOUT_OVERRIDE_MATERIALIZED`.
```typescript
for (const layout of snapshot.layouts) {
  pptx.defineSlideMaster({
    title: masterName(layout.id),
    background: mapBackground(layout.background),
    objects: layout.fixedObjects.map(mapMasterObject),
    // Map compatible slots as named placeholders.
  });
}
```
# Visual object mapping
<table header-row="true">
<tr>
<td>Taurus `VisualObject`</td>
<td>PPTX representation</td>
<td>Fidelity policy</td>
</tr>
<tr>
<td>`text`</td>
<td>`addText` with paragraph/run arrays</td>
<td>Preserve rich text, bullets, alignment, insets, vertical alignment, overflow/fit policy.</td>
</tr>
<tr>
<td>`shape`</td>
<td>`addShape` or shaped text box</td>
<td>Map fill, stroke, radius/preset, opacity, shadow, and text.</td>
</tr>
<tr>
<td>`line`</td>
<td>line shape</td>
<td>Map endpoints, width, dash, color, and supported arrowheads.</td>
</tr>
<tr>
<td>`image`</td>
<td>`addImage` from supplied bytes</td>
<td>Preserve contain/cover/crop, transparency, rotation, and alt text. No remote fetch.</td>
</tr>
<tr>
<td>`table`</td>
<td>native PowerPoint table</td>
<td>Preserve cell spans, padding, borders, fills, text, and row/column geometry where supported.</td>
</tr>
<tr>
<td>`chart`</td>
<td>native PptxGenJS chart</td>
<td>Use editable charts for supported chart specs; use snapshot fallback for unsupported specs.</td>
</tr>
<tr>
<td>`equation`</td>
<td>SVG/PNG snapshot in V1</td>
<td>Preserve visual output and alt text; emit `PPTX_EQUATION_RASTERIZED`. Native OMML is a future adapter.</td>
</tr>
<tr>
<td>`embed`</td>
<td>safe snapshot plus optional approved hyperlink</td>
<td>Never export active embedded code, credentials, or uncontrolled external relationships.</td>
</tr>
<tr>
<td>`group`</td>
<td>native group when the pinned library contract proves it; otherwise flatten transformed children</td>
<td>Preserve appearance and z-order; warn when PowerPoint grouping behavior is lost.</td>
</tr>
</table>
## Text and marks
Convert TextBlock content into paragraph/run arrays. Resolve overlapping marks with the same interval-sweep algorithm used by DOCX export. Preserve:
- font family, size, color, weight, italic, underline, strike;
- superscript/subscript where supported;
- paragraph alignment, line spacing, indent, bullets/numbering;
- internal/external hyperlinks after protocol validation;
- semantic style cascade resolved to concrete values in the snapshot.
Formula and prompt-backed text exports the accepted display state only. If current evaluation is failed and the editor displays last-good content, export that visible content and warn.
Text fit is a high-risk fidelity boundary. Map Taurus overflow rules to one of:
- `shrinkText`;
- `fit: "shrink"`;
- clipped fixed frame;
- explicit overflow warning/block.
The resolved snapshot includes expected line boxes and the approved font identity. Rendered validation must catch changed line breaks, clipping, and unexpected font substitution. The editable default never inserts arbitrary line breaks simply to imitate a stale renderer; only canonical paragraph/line-break intent is emitted.
## Images and crop
Taurus image data references stable FileIDs. Resolve those in Go under project authorization, then provide bounded bytes to the worker.
- Preserve requested crop rectangles using PptxGenJS sizing/crop helpers or explicit source crop.
- Transcode unsupported source formats locally to PNG/JPEG/SVG according to policy.
- Reject decompression bombs and invalid dimensions before the worker.
- Set alt text on every image and chart when supplied.
## Charts
Map supported Taurus chart specs to native chart types and series. PptxGenJS documents native area, bar, bubble, doughnut, line, pie, radar, scatter, combo, and 3D variants.
```typescript
function renderChart(slide: pptxgen.Slide, object: ChartObject) {
  const native = translateChartSpec(object.spec, object.bindingSnapshot);
  if (!native.supported) return renderChartSnapshot(slide, object, native.reason);

  slide.addChart(native.type, native.series, {
    ...frameToPosition(object.frame),
    ...native.options,
    altText: object.altText,
  });
}
```
The export uses the pinned chart data snapshot. It does not preserve Taurus live bindings or formula dependency graphs in the PPTX. A native PowerPoint chart remains editable, but it is a materialized copy.
## Notes
Render each slide's notes TextBlock to plain speaker-note text using `slide.addNotes`. Preserve paragraph boundaries. Remove prompt/provider metadata and unsupported rich styling. If notes are excluded by policy, report that decision explicitly.
# End-to-end renderer sketch
```typescript
import pptxgen from "pptxgenjs";

export async function renderDeck(
  snapshot: DeckOfficeSnapshotV2,
  assets: AssetMap,
): Promise<PptxWorkerResult> {
  const pptx = new pptxgen();
  defineExactLayout(pptx, snapshot.canvas);
  defineTheme(pptx, snapshot.resolvedTheme);
  defineMasters(pptx, snapshot.resolvedLayouts, assets);
  defineSections(pptx, snapshot.sectionBoundaries);

  for (const source of snapshot.slides) {
    renderSlide(pptx, source, assets);
  }

  const bytes = await pptx.write({ outputType: "arraybuffer", compression: true });
  return finalize(bytes, snapshot);
}
```
# Fidelity and loss policy
<table header-row="true">
<tr>
<td>Condition</td>
<td>Preferred behavior</td>
<td>Warning/block rule</td>
</tr>
<tr>
<td>unsupported native chart feature</td>
<td>render approved visual snapshot</td>
<td>material warning; strict mode blocks</td>
</tr>
<tr>
<td>group cannot remain editable</td>
<td>flatten transformed children</td>
<td>material warning if selection/edit behavior matters</td>
</tr>
<tr>
<td>equation</td>
<td>SVG/PNG snapshot</td>
<td>warning</td>
</tr>
<tr>
<td>missing font</td>
<td>approved fallback</td>
<td>block on clipping/large metric change; otherwise warning</td>
</tr>
<tr>
<td>embed</td>
<td>safe snapshot + approved link</td>
<td>warn; block if no safe representation</td>
</tr>
<tr>
<td>animation/transition</td>
<td>absent by design</td>
<td>no warning and never blocking; Taurus does not support them</td>
</tr>
<tr>
<td>object outside canvas</td>
<td>preserve if PowerPoint can represent; otherwise clip consistently</td>
<td>warning or block on visual mismatch</td>
</tr>
<tr>
<td>unresolved/mismatched media</td>
<td>block</td>
<td>blocking</td>
</tr>
</table>
No silent rasterization. Every fallback is located by slide ID and object ID.
# Security and operational limits
- Exact `(project, deck, revision)` authorization before snapshot creation and fresh authorization before download.
- Worker has no network, database, provider, secret-store, or canonical object-store access.
- Strip macros, ActiveX, OLE packages, uncontrolled external relationships, and executable embeds.
- Validate hyperlinks and media types. Never fetch URLs found inside content.
- Limit slides, objects, text bytes, marks, media bytes/pixels, chart points, table cells, output bytes, CPU, memory, and temporary disk.
- Sanitize filenames and use `application/vnd.openxmlformats-officedocument.presentationml.presentation`.
- Retain exporter/library version, snapshot schema, revision, options hash, font set hash, asset hashes, warnings, and output SHA-256 in the manifest.
- Cancellation is cooperative before sealing; a stale or cancelled attempt cannot publish.
# Structural and rendered validation
Use two independent gates.
## Structural gate
Reopen the package independently and verify:
- slide count, order, section membership, custom dimensions, hidden flags;
- master/layout/theme relationships;
- object count, type, z-order, geometry, rotation, flips, text, links, notes;
- image hashes/crops, table dimensions, chart series/categories;
- no package repair warnings, macros, ActiveX, unsafe OLE, or unauthorized relationships;
- ECMA-376 validity through the Microsoft Open XML SDK validator in CI.
## Rendered gate
Render both the canonical Taurus slide and exported PPTX slide in pinned environments. Compare:
- text wrapping, clipping, overflow, line breaks, and font substitution;
- object bounds, rotation, alignment, group transforms, and z-order;
- image crop, scale, masks, transparency, and aspect ratio;
- fills, gradients, strokes, shadows, theme colors, and backgrounds;
- tables, chart axes/labels/legends/plot bounds;
- exact canvas size.
Use object-aware tolerances, not only a whole-slide perceptual score. Missing objects, wrong z-order, text clipping, gross crop, or wrong canvas size are blocking.
Minimum corpus:
- every object kind and layout slot;
- sections plus unsectioned slides;
- hidden slides and notes;
- all supported chart types and snapshot fallback;
- complex text, bullets, CJK, RTL, emoji, missing fonts;
- groups, rotations, flips, overlapping z-order, transparency, shadows, gradients;
- crop/contain/cover images and broken assets;
- custom canvas sizes and dense decks;
- malicious relationships, oversized media, and resource-limit failures.
# Implementation sequence
1. Pin PptxGenJS 4.0.1 in the Office worker lockfile and SBOM.
2. Freeze `DeckOfficeSnapshotV2`, generated JSON Schema, request/result manifests, warning taxonomy, and limits.
3. Implement the shared file-based worker client with `exec.CommandContext`, cancellation, no-egress isolation, and attempt cleanup.
4. Implement exact layout, resolved theme/master, section, hidden-slide, and notes primitives.
5. Implement each typed visual-object renderer with unit fixtures and expected line-box diagnostics.
6. Add native chart/materialization and equation/embed fallback policies.
7. Integrate durable jobs, exact-revision pinning, assets, idempotency, sealing, storage, and delivery.
8. Add independent Open XML and relationship validation.
9. Add per-slide rendered comparison and PowerPoint/LibreOffice release checks.
10. Seek a commercial fallback only for a demonstrated blocking gap.
# Sources
- [Model — Slides Capability & Runtime Contract](https://app.notion.com/p/3abb6410e50281df8762c162e9a6eb13)
- <mention-page url="https://app.notion.com/p/3acb6410e50281419ce6ed5fd51edf09"/>
- [PptxGenJS repository and MIT license](https://github.com/gitbrent/PptxGenJS), [introduction](https://gitbrent.github.io/PptxGenJS/docs/introduction/), [sections](https://gitbrent.github.io/PptxGenJS/docs/sections/), [masters/placeholders](https://gitbrent.github.io/PptxGenJS/docs/masters.html), [speaker notes](https://gitbrent.github.io/PptxGenJS/docs/speaker-notes/), [hidden slides](https://gitbrent.github.io/PptxGenJS/docs/usage-slide-options/), and [charts](https://gitbrent.github.io/PptxGenJS/docs/api-charts.html)
- [UniOffice product](https://unidoc.io/unioffice/) and [pricing](https://unidoc.io/pricing/)
- [Microsoft Open XML SDK](https://github.com/dotnet/Open-XML-SDK), [`OpenXmlValidator`](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.validation.openxmlvalidator.validate), and [ECMA-376](https://ecma-international.org/publications-and-standards/standards/ecma-376/)
- [SOL Y 104 — Open-Source Library Decision Matrix](https://app.notion.com/p/39ab6410e50281f18edbd7538ac2e17e), [SOL X 78 — Export Pipeline](https://app.notion.com/p/39ab6410e5028161afcbedc98c3bb809), and [SOL Z 095 — Isolated PptxGenJS Export](https://app.notion.com/p/39bb6410e50281b792e6f74fdb6d424a)

