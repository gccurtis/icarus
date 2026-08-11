---
title: "Interface - Slides Editor Inspector Panel Lenses"
notion_page_id: "3acb6410e50281a7a32dd1c2551a7851"
notion_url: "https://app.notion.com/3acb6410e50281a7a32dd1c2551a7851"
project: "Taurus Yesod"
role: "Primary"
format: "Spec"
created: "2026-07-29 01:35:33Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Interface - Slides Editor Inspector Panel Lenses

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

<callout icon="🔎" color="blue_bg">
	**Implementation-facing Taurus Yesod specification.** This page defines every meaningful Slides editor selection and the adaptive inspector lens shown for it. Slides remain unnamed stable-ID entities; named sections and named templates are kept distinct.
</callout>
# Decision
The Slides inspector is one selection-driven right-side lens. It resolves from the active Deck, section, Slide, VisualObject, text/table/notes sub-selection, multi-selection, or explicit template-binding detail mode. It is not a fixed icon registry and never becomes a miscellaneous settings drawer.
This page is the canonical Slides selection taxonomy and the field/action contract for every resolved inspector lens. Context maps sections, slide order, layers, templates, references, comments, tasks, and history. Inspector changes the selected target.
AI Quarterback focus may temporarily replace the selection lens with the shared AI lens; returning restores the exact stable selection if it still resolves.
# Inspector shell and hierarchy
```plain text
┌────────────────────────────────────────────┐
│ [kind icon] SELECTION LABEL       [⋯] [×] │
│ Deck › Section › slide ordinal › object    │
│ stable identity / lock / hidden / live state│
├────────────────────────────────────────────┤
│ selection-specific primary controls        │
│────────────────────────────────────────────│
│ Appearance / Geometry / Content / Data      │
│ Binding / Accessibility / Derived status    │
│────────────────────────────────────────────│
│ secondary actions                          │
│ destructive actions, separated and last    │
└────────────────────────────────────────────┘
```
- Preferred content width is 320px, with a 260px minimum and 440px maximum.
- Breadcrumb labels use Deck name, named section, current slide ordinal, object kind/content excerpt, and template name where useful. Slides themselves never acquire names.
- Stable SectionID, SlideID, and ObjectID are available in details/copy actions. Current ordinals are friendly projections, never mutation identity.
- Sections use disclosure in a stable order: identity/status, content/data, appearance, geometry, binding, accessibility, advanced, destructive.
- Celestial and Night differ only through tokens. Geometry, spacing, motion, hierarchy, and disclosure remain invariant.
- The panel shows canonical accepted values. Local field drafts are explicit and survive a stale-revision rejection.
# Selection path
```typescript
type SlidesInspectorSelection =
  | { kind: 'none' }
  | { kind: 'deck'; deckId: DeckID }
  | { kind: 'section'; deckId: DeckID; sectionId: SectionID }
  | { kind: 'slide'; deckId: DeckID; slideId: SlideID }
  | { kind: 'slides'; deckId: DeckID; slideIds: SlideID[] }
  | { kind: 'object'; deckId: DeckID; slideId: SlideID; objectId: ObjectID }
  | { kind: 'objects'; deckId: DeckID; slideId: SlideID; objectIds: ObjectID[] }
  | { kind: 'text-range'; deckId: DeckID; slideId: SlideID; objectId: ObjectID; range: TextRange }
  | { kind: 'table-cell'; deckId: DeckID; slideId: SlideID; objectId: ObjectID; rowId: TableRowID; columnId: TableColumnID }
  | { kind: 'table-range'; deckId: DeckID; slideId: SlideID; objectId: ObjectID; range: TableRange }
  | { kind: 'notes'; deckId: DeckID; slideId: SlideID; range?: TextRange }
  | { kind: 'template-binding'; deckId: DeckID; slideId: SlideID; objectId?: ObjectID };
```
Selections are ephemeral workspace state. Resolution includes project scope and accepted Deck revision. If the target is deleted, regrouped, moved, or becomes inaccessible, the inspector re-resolves by stable identity. It never reuses a stale array index, layer position, or slide ordinal.
Selection precedence is **text/table sub-selection → object selection → multi-object selection → slide selection → section selection → deck selection**. Clicking empty slide canvas selects the Slide. Clicking outside the slide does not silently select the Deck.
# Selection taxonomy
<table header-row="true">
<tr>
<td>Kind</td>
<td>Icon</td>
<td>Selected target</td>
<td>Primary responsibility</td>
</tr>
<tr>
<td>`none`</td>
<td>`MousePointer2`</td>
<td>Nothing</td>
<td>Clear instructional empty state.</td>
</tr>
<tr>
<td>`deck`</td>
<td>`Presentation`</td>
<td>Deck header/details</td>
<td>Deck identity, canvas, theme, defaults, health.</td>
</tr>
<tr>
<td>`section`</td>
<td>`PanelTop`</td>
<td>Named section divider</td>
<td>Name, order, membership, rehome/delete.</td>
</tr>
<tr>
<td>`slide`</td>
<td>`PanelTopOpen`</td>
<td>Thumbnail or empty slide canvas</td>
<td>Ordinal/ID, section, template, visibility, canvas override, notes route.</td>
</tr>
<tr>
<td>`slides`</td>
<td>`PanelsTopLeft`</td>
<td>Multiple slide thumbnails</td>
<td>Shared section/template/visibility and structural bulk actions.</td>
</tr>
<tr>
<td>`object:text`</td>
<td>`Type`</td>
<td>Text object</td>
<td>Rich content, typography, auto-fit, insets, generated state.</td>
</tr>
<tr>
<td>`object:shape`</td>
<td>`Shapes`</td>
<td>Shape</td>
<td>Shape type, fill, stroke, contained text, geometry.</td>
</tr>
<tr>
<td>`object:line`</td>
<td>`MoveDiagonal2`</td>
<td>Line/connector</td>
<td>Endpoints, stroke, markers, transform.</td>
</tr>
<tr>
<td>`object:image`</td>
<td>`Image`</td>
<td>Image</td>
<td>File, crop, fit, alt text, geometry.</td>
</tr>
<tr>
<td>`object:table`</td>
<td>`Table2`</td>
<td>Table object</td>
<td>Table structure, style, geometry, row/column operations.</td>
</tr>
<tr>
<td>`object:chart`</td>
<td>`ChartColumn`</td>
<td>Chart</td>
<td>Data binding, specification, snapshot, alt text.</td>
</tr>
<tr>
<td>`object:equation`</td>
<td>`Sigma`</td>
<td>Equation</td>
<td>Source, format, preview, diagnostics.</td>
</tr>
<tr>
<td>`object:embed`</td>
<td>`PanelsTopLeft`</td>
<td>Embed</td>
<td>Provider, URL, snapshot, alt text.</td>
</tr>
<tr>
<td>`object:group`</td>
<td>`Group`</td>
<td>Group</td>
<td>Children, group identity, ordering, ungroup.</td>
</tr>
<tr>
<td>`objects`</td>
<td>`Boxes`</td>
<td>Multiple objects on one Slide</td>
<td>Mixed values, align/distribute, group, shared style/geometry.</td>
</tr>
<tr>
<td>`text-range`</td>
<td>`TextSelect`</td>
<td>Rich-text selection inside an eligible object</td>
<td>Text, marks, paragraph style, formula atom detail.</td>
</tr>
<tr>
<td>`table-cell` / `table-range`</td>
<td>`Grid2X2Check`</td>
<td>Table sub-selection</td>
<td>Cell content, row/column context, table-cell presentation.</td>
</tr>
<tr>
<td>`notes`</td>
<td>`NotebookPen`</td>
<td>Slide Notes surface or range</td>
<td>Notes RichContent and minimal paragraph styling.</td>
</tr>
<tr>
<td>`template-binding`</td>
<td>`SquareStack`</td>
<td>Template/slot badge or detail route</td>
<td>Template source, slot, inheritance, explicit overrides.</td>
</tr>
</table>
Cross-Slide object multi-selection is excluded from v1. A group is a first-class VisualObject; selecting its child selects the child unless the user explicitly selects the group boundary or chooses **Select group**.
# Common behavior
## Nothing selected
**Icon:** `MousePointer2`
```plain text
Nothing selected
Select a section, slide, object, text, table cell,
notes, or template binding to inspect it.
```
A single **Inspect Deck** route explicitly selects the Deck. No unrelated settings appear.
## Deck lens
**Icon:** `Presentation`
### Displays
- Deck name, stable ID on demand, project, revision/base sequence, creator, timestamps, lifecycle, sync/collaboration state.
- Canvas width/height/aspect, active theme, section/slide/object/template counts, hidden slides, generated-content health, and derived export/thumbnail freshness.
- Default style/theme resolution summary without pretending derived styles are authored values.
### Controls and actions
- Rename through `rename_deck`.
- Set canvas and theme through `set_canvas` and `set_theme` with an impact preview.
- Open template/library details, export status, or history.
- Lifecycle actions remain Resource-owned, separated, and last.
### Behavior
A canvas/theme change previews affected Slides, overrides, overflow, and stale derived renders. It never rewrites explicit object overrides without a typed policy.
## Section lens
**Icon:** `PanelTop`
```plain text
Section
[Name                                  ]
N slides · current rank · SectionID
[Move] [Select slides]
────────
Delete section → rehome to [section / Unsectioned]
```
### Displays
Name, stable SectionID, deterministic rank, current ordinal among named sections, member SlideIDs/ordinals, hidden/error/task counts, and collaborators present in member Slides.
### Controls and actions
- `rename_section` and `move_section` use SectionID/rank anchors.
- Select or move all member Slides.
- `delete_section` requires an explicit `RehomeSectionID`; empty means Unsectioned.
### Behavior
Duplicate section names may be allowed but are disambiguated by position and ID. Deleting never deletes member Slides implicitly.
## Slide lens
**Icon:** `PanelTopOpen`
```plain text
Slide 07 · SlideID on demand
Section      [Analysis]
Template     [Quarterly chart]
Hidden       [ ]
Canvas       Deck default / override
Objects N · notes status · comments/tasks/errors
[Duplicate] [Move] [Save as template]
────────
Delete slide
```
### Displays
- Current flattened ordinal, stable SlideID, named section or Unsectioned, rank, resolved template name/ID, hidden state, canvas override, object counts, notes coverage, and health.
- Slide has no name field, title field, or rename action. Template name is labelled as Template.
### Controls and actions
- Move across sections/ranks via `move_slide`; duplicate, set hidden, set template, and delete through typed Slide operations.
- Set/clear canvas override when supported.
- Open Notes; save current Slide as a named Template Library asset; copy deep link.
### Behavior
Reordering changes ordinal but not SlideID. Applying a template previews inherited fields and preserved explicit overrides. Deletion previews objects, notes, comments, and pending tasks.
## Multi-Slide lens
**Icon:** `PanelsTopLeft`
### Displays
Count, current ordinal span, involved sections, shared/mixed template, shared/mixed hidden state, object/notes/task totals, and stable IDs on demand.
### Controls and actions
Move to section, reorder as a stable ordered set, hide/show, duplicate, apply template with override preview, or delete with consequence summary.
### Behavior
Mixed values render **Mixed**, never the first Slide’s value. Commands expand into bounded typed operations in displayed stable order and use one ChangeSet when atomicity is required.
# VisualObject common lens
Every object-kind lens begins with the same common sections:
```plain text
[Object icon] KIND · object excerpt
Slide ordinal · ObjectID · layer/group
Status: locked / hidden / generated / stale
Geometry
  X / Y / Width / Height
  Rotation / Flip H / Flip V
Layer & grouping
Template binding / overrides
```
### Common displays
Kind, ObjectID, SlideID, parent GroupID, rank/z-order, frame in EMU with user-unit projection, transform, resolved versus authored style, lock/hidden state, template binding, and override mask.
### Common controls and actions
- Geometry uses `move_resize_object`; layer movement uses `reorder_object`.
- Duplicate, select parent group, group/ungroup, copy/cut, and delete use typed object operations.
- Lock, hide, style, and template-binding controls appear only when matching typed operations exist.
- Align/distribute for multi-object selection compiles to deterministic geometry operations after preview.
### Common behavior
Locked means immutable through ordinary editing, not merely hard to click. Hidden objects remain discoverable in Layers and inspectable if selected from context. Resolved template style is labelled inherited; changing an inherited field creates an explicit override.
## Text-object lens
**Icon:** `Type`
### Displays
RichContent summary; font/paragraph resolution; auto-fit; vertical alignment; insets; direct versus generated content; generation status, prompt, last-good content, evidence, token, source/display revisions, and diagnostics.
### Controls and actions
Edit RichContent through typed text operations; set auto-fit/alignment/insets through typed object-data operations; edit marks/paragraph style; set prompt, request refresh, compare/apply/reject generated results.
### Behavior
Refresh never clears accepted display. A stale generation token cannot overwrite newer text. Formula atoms expose value/state/diagnostic through a nested detail row and use Formula through the wiring port.
## Shape lens
**Icon:** `Shapes`
### Displays and controls
Shape type, fill, stroke, contained RichContent, text alignment/insets when supported, geometry, transform, template binding, and accessibility label. Shape-type conversion previews content/style loss. Fill/stroke/content changes are typed and validated.
## Line lens
**Icon:** `MoveDiagonal2`
### Displays and controls
Start/end points, stroke, start/end markers, rotation/flip projection, layer, lock/hidden state, and accessibility label where relevant. Endpoint edits remain slide-relative deterministic integer geometry.
## Image lens
**Icon:** `Image`
### Displays
File identity/status, intrinsic dimensions when authorized, crop, fit, alt text, geometry, transform, file accessibility, and derived preview freshness.
### Controls and actions
Replace File reference, crop/reset crop, choose fit, edit alt text, open/download File, or delete object.
### Boundary
Replacing/removing the image object does not delete the File. Protected bytes remain File-owned.
## Table-object lens
**Icon:** `Table2`
### Displays
Row/column counts and stable IDs, sparse cell count, table style, selected subrange summary, geometry, template binding, and overflow/accessibility health.
### Controls and actions
Insert/delete/reorder rows or columns when typed operations exist, set table-cell content, apply table style, fit rows/columns, clear cells, or enter a `table-cell`/`table-range` detail mode.
### Behavior
Table row/column indexes are projections. Stable row/column IDs are command identity. Structural changes preview affected cells and formula/text anchors.
## Chart lens
**Icon:** `ChartColumn`
### Displays
Binding kind (cell/range/named range/resource), stable source selection and revision, ChartSpec, snapshot FileID/freshness, alt text, errors, and geometry.
### Controls and actions
Edit binding/spec, open source, request refresh, edit alt text, or detach/freeze a supported snapshot through an explicit policy.
### Behavior
Rendering is derived. Snapshot application is accepted only for the binding/source revision it rendered; stale snapshots never replace newer accepted output.
## Equation lens
**Icon:** `Sigma`
### Displays and controls
Source, format (LaTeX initially), rendered preview, parse/render diagnostic, geometry, style, and accessibility text. Apply validates source before commit; failure preserves the last accepted rendering where supported.
## Embed lens
**Icon:** `PanelsTopLeft`
### Displays and controls
Provider, URL, access/safety state, snapshot FileID/freshness, alt text, geometry, and open/refresh actions. The panel never embeds credentials or protected remote content in canonical Slides state.
## Group lens
**Icon:** `Group`
### Displays
Group ObjectID, child stable IDs in rank order, common/mixed lock/hidden state, group bounds projection, parent group prohibition, and template relationships.
### Controls and actions
Select child, reorder children, move/resize as group, ungroup, or delete group under an explicit child-preservation policy.
### Behavior
Groups remain acyclic and shallow. Ungrouping preserves child visual placement because geometry is slide-relative.
# Multi-object lens
**Stable kind:** `objects`  
**Icon:** `Boxes`
### Displays
Object count/kinds, common parent group, shared/mixed style, bounds, alignment, lock/hidden state, and IDs on demand.
### Controls and actions
Align, distribute, equalize size, move/resize, reorder, set common supported style, group, ungroup eligible members, duplicate, or delete.
### Behavior
Mixed fields show **Mixed**. Editing a mixed field writes only that explicit field to every eligible target. Locked/incompatible targets are excluded with a reviewed count; partial silent application is forbidden.
# Text-range lens
**Icon:** `TextSelect`
### Displays
Selected RichContent, word/character counts, block/run/atom anchors, marks and paragraph styles as shared/mixed values, object kind, generated-content ownership, formula atom state, and citation/evidence context where present.
### Controls and actions
Insert/delete/replace text; set marks and paragraph style; inspect/edit a Formula atom expression through the typed Slides contract; copy; use as AI scope.
### Behavior
UTF-8 anchors transform only with proof. Cross-atom operations expand deterministically. Generated content edits advance display revision so stale output cannot overwrite them.
# Table-cell and table-range lenses
**Icons:** `Grid2X2Check`
### Displays
Table ObjectID, stable row/column IDs, projected address, content, shared/mixed presentation, row/column dimensions, merge status only if a merge model later exists, and validation state.
### Controls and actions
Set content; insert/delete adjacent rows/columns; clear; apply eligible cell/table presentation; use selected table data as chart/AI scope.
### Boundary
No merge/unmerge control appears until the model defines merged-cell identity and operations.
# Notes lens
**Icon:** `NotebookPen`
### Displays
Slide ordinal and stable SlideID, Notes TextBlock, word count, minimal paragraph style, formula-atom state if enabled, last edit/revision, and access state.
### Controls and actions
Replace/splice Notes and set supported Notes style through `replace_notes`, `splice_notes`, and `set_notes_style`; clear with confirmation; copy/use as AI context.
### Behavior
Notes belong to the Slide and are not a separate Document aggregate. Selection remains attached to SlideID across reordering.
# Template-binding lens
**Icon:** `SquareStack`
### Displays
Resolved template name/ID, library asset/version provenance when applicable, slot ID/role, inherited values, explicit override mask, broken/inaccessible state, and affected object/Slide.
### Controls and actions
Apply/change Slide template, bind/detach object to/from slot, reset selected overrides, open template, or save current Slide as a new template asset/version.
### Behavior
Resetting an override previews the inherited result. Template name never becomes a Slide name. The prompt-block/template-parameter representation remains deliberately open.
# Resolver registry
```typescript
const objectPanels: Record<VisualObjectKind, InspectorPanel> = {
  text: TextObjectPanel,
  shape: ShapeObjectPanel,
  line: LineObjectPanel,
  image: ImageObjectPanel,
  table: TableObjectPanel,
  chart: ChartObjectPanel,
  equation: EquationObjectPanel,
  embed: EmbedObjectPanel,
  group: GroupObjectPanel
};

export const slidesInspectorResolvers: InspectorResolverMap<SlidesInspectorSelection> = {
  none: NothingSelectedPanel,
  deck: DeckInspectorPanel,
  section: SectionInspectorPanel,
  slide: SlideInspectorPanel,
  slides: MultiSlideInspectorPanel,
  object: ({ object }) => objectPanels[object.kind],
  objects: MultiObjectInspectorPanel,
  'text-range': TextRangeInspectorPanel,
  'table-cell': TableCellInspectorPanel,
  'table-range': TableRangeInspectorPanel,
  notes: NotesInspectorPanel,
  'template-binding': TemplateBindingInspectorPanel
};
```
# Mutation contract
```typescript
interface SlidesInspectorCommand<T extends SlidesOperationData> {
  projectId: ProjectID;
  deckId: DeckID;
  expectedRevision: number;
  submissionId: string;
  actor: ActorRef;
  selection: SlidesInspectorSelection;
  operation: T;
}
```
- Enter or explicit Apply commits validated fields. Escape restores accepted state. Blur commits only low-risk scalar fields with unambiguous validation.
- Structural and destructive actions preview affected stable IDs and submit one atomic ChangeSet when partial success would violate intent.
- On stale revision, the editor preserves drafts, re-resolves stable IDs, and retries only with proven conflict safety.
- Derived rendering/generation uses tokens and source/display revisions; the inspector labels local, pending, accepted, stale, failed, and last-good values honestly.
# Existing operations and required additions
Existing runtime operations cover Deck metadata, sections, Slide structure/template/visibility, object data/geometry/order/grouping, rich text, Notes, tables, generated content, and derived snapshots.
Before enabling the full inspector, add or concretely define typed operations for any currently uncovered top-level field:
- object lock and hidden state;
- object authored style;
- template binding/override reset;
- Slide canvas override;
- duplicate object if it is not expressed as create with normalized fresh IDs;
- table row/column reorder, cell presentation, and any table style mutation;
- image replacement/crop/fit/alt text and chart/equation/embed data mutations if `update_object_data` is not field-typed.
A generic unvalidated property patch is not an acceptable substitute.
# Model-alignment requirements
- `ObjectStyle`, `ParagraphStyle`, `FillStyle`, `StrokeStyle`, `TableStyle`, `TableCell`, `ChartBinding`, `ChartSpec`, crop/fit/insets, and override-mask shapes must be concretely versioned before their controls ship.
- Slides have no Name and no rename operation.
- Section deletion must require explicit atomic rehoming.
- Template asset/library types remain a separate authority from materialized Deck state.
- The template prompt-block/parameter schema remains open; the inspector must not invent it.
- Comments, Agent tasks, Files, Formula evaluation, Resource bindings, and Template Library details require scoped read adapters and preserve their owning authorities.
# Loading, permission, and error states
- Skeleton the exact resolved lens rather than swapping to a generic spinner.
- Read-only/locked/inherited fields explain their state.
- Missing files/templates/resources preserve stable identity and show inaccessible/deleted labels.
- Unsupported future VisualObject kinds are round-tripped, identified, and read-only; the panel never casts them to a known type.
- An orphaned nested selection falls back only to its known surviving parent after telling the user what disappeared.
# Accessibility and keyboard contract
- Header announces selection kind, label, and relevant state without relying on color.
- All geometry fields have units, constraints, and accessible increment controls.
- Mixed values and inherited values have distinct text labels and screen-reader descriptions.
- Tab follows visible order; hidden disclosure content is unfocusable.
- Escape exits crop/text/table/template detail mode before clearing object/Slide selection.
- Arrow-key movement/reordering uses documented modifiers and reports the accepted position.
- Canvas handles and inspector fields stay synchronized without focus theft.
# Acceptance checklist
- [ ] Every selectable Slides entity resolves to one stable selection kind and one typed panel.
- [ ] Slides are identified by ordinal plus stable ID and never gain names.
- [ ] Named sections and named templates are labelled distinctly.
- [ ] Section deletion cannot delete Slides implicitly.
- [ ] Every VisualObject kind receives its typed data controls plus common geometry/layer/binding controls.
- [ ] Multi-selection renders mixed values and never partially applies silently.
- [ ] Text/table/Notes selections retain stable anchors across safe edits.
- [ ] Generated content preserves last-good display and rejects stale results.
- [ ] Derived chart/embed/thumbnail state is labelled and token/revision checked.
- [ ] File, Formula, Template Library, Resource, Annotation, and Agent boundaries remain explicit.
- [ ] Unsupported controls remain absent until typed model/operations exist.
- [ ] Destructive actions are separated, last, and consequence-labelled.
- [ ] Celestial and Night differ only chromatically.
- [ ] Keyboard, focus, and assistive-technology behavior is complete.
# Sources
- <mention-page url="https://app.notion.com/p/3abb6410e50281df8762c162e9a6eb13"/>
- <mention-page url="https://app.notion.com/p/3acb6410e50281ae9244e2f9a57f579f"/>
- <mention-page url="https://app.notion.com/p/e12b6939dbc444698aca18d4162bab10"/>
- <mention-page url="https://app.notion.com/p/39ab6410e50281798739fa3a9e8931ac"/>

