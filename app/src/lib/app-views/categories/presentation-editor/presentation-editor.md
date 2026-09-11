# Presentation editor

The presentation editor owns one project presentation at a time, addressed by the active
workspace view's `resourceId`. Its implementation lives in this directory. The
canvas is [`content/presentation.svelte`](content/presentation.svelte); context panels,
inspectors, and editing procedures stay beside it so presentation behavior does not
depend on a document-editor presentation component.

This file records the behavior that exists now. A control or view described as
deferred is deliberately visible as unavailable; everything else is expected to
work and is covered at the procedure or browser boundary.

## Runtime and persistence contract

- A presentation row identifies the resource and points to a leader snapshot.
- A valid initial snapshot contains at least one slide. Creation and template
  instantiation both enforce that invariant.
- Editing sends represented operations through the presentation runtime. A buffered
  operation immediately changes sync state to `saving`; only the persistence
  acknowledgement may return it to `saved`.
- Frames use slide-relative coordinates. The rendered stage derives pixel
  dimensions from those frames and the current aspect ratio.
- Presentation text line height is a unitless multiplier. It must not be interpreted as
  the document editor's absolute-pixel line height.
- The current slide is the active workspace view's `focus`. When it is absent,
  the editor falls back to the first slide.

## Canvas

The canvas renders the selected slide, its editable elements, guides, comment
badges, editor-only Prompt Block stars, zoom controls, slide navigation,
speaker-notes entry, and the current sync state.

### Selection and editing

- Click selects one element. Shift-click adds or removes an element from a
  multi-selection.
- Pressing an already selected member preserves the whole selection while a
  drag begins. A stationary unmodified click collapses the selection to that
  member when the pointer is released.
- Marquee selection, keyboard nudging, dragging, resizing, rotation, line-end
  editing, snapping, duplicate, delete, group, and ungroup are implemented.
- Double-clicking editable text enters text mode. Text selection opens the text
  inspector; a caret opens Next Letter. Escape returns to the containing
  element selection.
- Prompt Blocks use the same text renderer, text-mode entry, marks, geometry,
  paint, and ordering as ordinary text boxes. Their star opens Prompt settings
  without becoming authored or exported slide content.
- Insert mode is armed in the Insert panel or from the slide context menu. The
  next slide click places the object and selects it; Escape cancels.
- Open comment badges route to the presentation-owned comment or thread inspector.

## Context panels

The registered context keys are the complete rail vocabulary for this editor.

| Key | Current responsibility |
| --- | --- |
| `presentation-editor.slides` | Create, duplicate, delete, select, preview, and reorder slides. |
| `presentation-editor.insert` | Search available object types and insert one in the centre of the current slide. |
| `presentation-editor.layers` | Select, reorder, lock, hide, and restack elements on the current slide. |
| `presentation-editor.theme` | Edit slide aspect/background, save or remove layouts, and open presentation named styles. |
| `presentation-editor.find` | Find or replace text in slide objects, table cells, and speaker notes. |
| `presentation-editor.comments` | Create and browse presentation-, slide-, or element-scoped threads. |
| `presentation-editor.templates` | Save the presentation or one slide as a template, edit a template through this presentation, and insert a presentation template after the current slide. |
| `presentation-editor.variables` | Deferred placeholder; presentation variable management is not implemented here. |
| `presentation-editor.prompts` | List Prompt Blocks across the presentation, navigate to their slide, and open their inspector. |

### Slides

New inserts an empty slide after the current slide. Its adjacent menu can start
from any saved presentation layout. Duplicate mints fresh identifiers for the slide and
all identified descendants. Delete is disabled for the last remaining slide.
Rendered thumbnails use the same scene projection as the main canvas. Drag and
drop reorders slides; Alt+Arrow Up/Down provides a keyboard equivalent.

### Insert

Ready entries include text, supported shapes, and line. Entries whose represented
editing path is not complete remain visible and disabled with an explanation.
The panel never pretends that a deferred image, table, or chart insertion
succeeded.

### Layers

The list reflects actual stacking order. Selecting a row uses the same selection
signal as the canvas. Front, forward, backward, and back operate on the current
set. Drag reorder and visibility/lock controls mutate represented element state.
Arrange belongs to the relevant inspector, not this context list.

### Style

Aspect ratio and slide background are presentation-wide controls. A named layout is a
snapshot of the current slide and appears as a rendered preview; New Slide can
then use it. Named styles are listed with a concise summary and route to
`presentation-editor.named-style`. New style creates and immediately opens a real
style record.

### Find

Mode is a two-way Find/Replace choice. Scope is All, Slides, or Notes. Each hit
states slide number and source (`Text`, `Shape`, `Table`, or `Notes`) and opens
the relevant slide and text range. Replace affects the active hit; Replace all
groups work by text block and edits matches from the end so offsets stay valid.

### Comments

The scope choice is Presentation, current Slide, or selected Element. The element choice
uses the element's resolved label, not an ambiguous initial. New threads persist
their exact scope. Open and resolved threads remain separate, and every row
states its anchor before routing to `presentation-editor.comment`.

### Prompts

The panel is an index, not a creation surface. Each row shows its slide number
and current editable response. Choosing a row focuses the containing slide,
selects its element, and opens `presentation-editor.prompt-block`.

A Prompt Block begins as a standalone text box. `Prompt` appears beside
`Comment` in the text-box inspector and converts that element in place. The
outer element ID, frame, paint, order, text, marks, style, and format survive.
Only its content kind changes from `text` to `prompt`.

### Templates

An ordinary presentation opens on a name field with Save presentation and Save slide under it.
Both require a name, both drop what a template may not carry, and both open the
new template's working copy in its own tab. A slide saved this way is a presentation
template holding one slide, and nothing marks it afterwards.

A working copy shows Save and Discard in the panel's header instead of the name
field, because the tab title already says which template is open. Its Slots band
lists every slot: a scope slot is found from the slides' prompt scopes and
cannot be added by hand; a text slot is made by Create slot, which names it and
drops its atom into the selected text. Each is a card carrying that name, its
label, its description, and either default words or a button that opens the
default-scope modal.

A divider separates the band from a collapsible List section holding every presentation
template, searchable, each row inserting after the current slide or opening the
template for editing. Inserting brings fresh identifiers and any layouts and
named styles the presentation lacks. A template with slots first asks, in one modal,
what fills each; inserting into a working copy asks nothing, keeps the slot
terms, and merges the two slot lists.

## Inspectors

The registered inspector keys below are all implemented and editor-owned.

| Key | Selection contract |
| --- | --- |
| `presentation-editor.slide` | One slide; its background and hidden state. |
| `presentation-editor.shape` | One shape; kind and text excerpt in the heading, then geometry and appearance. |
| `presentation-editor.text-box` | One text box; text style, geometry, paint, effects, order, and comments. |
| `presentation-editor.prompt-block` | One Prompt Block; prompt/scope, server-owned refresh state, evidence, then the same text and element controls as a text box. |
| `presentation-editor.line` | One line; endpoints, stroke, effects, order, and comments. |
| `presentation-editor.image` | One image element and its frame/appearance controls. |
| `presentation-editor.table` | One table and its table-level controls. |
| `presentation-editor.cell` | Selected cell content and formatting. |
| `presentation-editor.chart` | One chart and its chart-level controls. |
| `presentation-editor.group` | A group and the arrangement of its children. |
| `presentation-editor.multi-selection` | Two or more elements on one slide. |
| `presentation-editor.text-selection` | A non-empty text range. |
| `presentation-editor.next-letter` | The collapsed caret's inherited text style. |
| `presentation-editor.speaker-notes` | Editable notes and the same presentation text-style grammar. |
| `presentation-editor.named-style` | One persisted presentation named style. |
| `presentation-editor.threads` | Thread list and new comment composer for one slide or element. |
| `presentation-editor.comment` | One conversation, including locate, reply, resolve, and reopen. |

Inspector selection payloads use explicit kinds and stable IDs. A panel must not
infer its target from a display label. Breadcrumbs may move to the enclosing
slide or element, but they do not change represented content.

## Arrange contract

[`components/arrange-section.svelte`](components/arrange-section.svelte) is used
by multi-selection and group inspectors. Its visible structure is fixed:

1. Align has one horizontal row (Left, Center, Right), one vertical row (Top,
   Middle, Bottom), and a full-width Selection/Slide relative-to choice.
2. Distribute has one row (Horizontal, Vertical) and requires three items.
3. Match size is its own section (Width, Height, Both) and uses the first
   selected item as the model.
4. Order has Front, Forward, Backward, and Back.

At narrow widths the six alignment buttons retain distinct icons and accessible
names while hiding only their visible words. The relative-to options use
`Sel`/`Slide`, never duplicate initials.

Distribution sorts by element center with stable ID tie-breaking, preserves the
two outer centers, and spaces every interior center evenly. Canonical rounding
and changed-frame filtering make a repeated operation idempotent, including
overlapping objects.

## Text-style contract

Presentation text controls use the same visible language in text boxes, selections,
carets, speaker notes, and named styles:

1. Named style, except while editing the named style itself.
2. Font and size.
3. Bold, italic, underline, and strikethrough press buttons.
4. Compact Color and Background controls; text color always resolves to a color,
   while an empty background is shown with an explicit X.
5. Text style owns full-width icon rows for horizontal and vertical alignment.
   Text wrap keeps its visible label where the target supports it.
6. A collapsed Spacing section owns space above, space below, unitless line
   height, and indent.

These are independent slide-editor components. Matching the document editor's
visual grammar must not create a cross-editor component dependency because the
two editors have different represented semantics.

### Named styles

The style name is edited in place and saved when the edit commits. The inspector
does not expose storage keys, Usage, Placement, Reads as, a redundant style
dropdown, or a separate numeric weight control. It supports duplicate, make
default, and delete (except for the active default), followed by Text style and
Spacing sections.

### Speaker notes

Each slide owns at most one notes block. The Notes control below the canvas opens
its dedicated inspector; the general slide inspector does not repeat the note or
offer a second route to it. An empty slide offers Start notes; a non-empty note
uses the slide text renderer and the same text-style component. Find includes
notes and opens this inspector at the containing slide.

## Comment contract

The slide editor owns
[`inspector/comment.svelte`](inspector/comment.svelte). It may reuse low-level
comment data procedures, but its locate behavior is presentation-specific: Show in presentation
opens the target presentation, focuses the anchored slide, and opens the slide or element
thread list.

The conversation sequence is original comment, divider, reply composer with
Resolve/Reopen and Reply, divider, then prior replies. Reply is not duplicated in
the panel header. The document editor deliberately keeps a separate copy with
inline-range locate behavior.

## Prompt Block contract

The presentation stores an editable `PromptBlock` inside the unchanged `SlideElement`.
The block stores its presentation text and marks, a small freshness mirror, and
the `derivedOutputId` that links it to the server-owned definition and evidence.
An unlinked block is exactly idle and owns its optional inline prompt/scope. A
linked block owns neither: idle has no result metadata, stale may retain the
last refresh time, fresh requires that time, and error requires a message while
optionally retaining the last successful refresh time. Partial and mixed arms
are not stored.
Generated response text returns through native presentation atom/mark operations.
Existing absolute mark ranges are retained and clipped only when a shorter
response no longer covers them. Direct user edits use the ordinary presentation text
operation and become ungrounded previous-response continuity on the next
refresh.

Refresh is a signal to the server by Derived Output ID. Browsers do not own the
lock or provider work: concurrent signals join the same persisted refresh job,
and the inspector reads/polls shared queued, running, or failed state. Generated
Prompt Block text is excluded from Semantic Overlay projection so it cannot
become recursive evidence. The full procedure and implementation map is served
at `/demo/semantic-overlay/slide-prompt-blocks` and recorded in
[`../../../development-views/slide-prompt-blocks/slide-prompt-blocks.md`](../../../development-views/slide-prompt-blocks/slide-prompt-blocks.md).

## Responsive and accessibility rules

- Compact controls may hide visible text only when the icon or compact label
  remains unique and the full accessible name stays present.
- Canvas-only gestures need an equivalent in Slides, Layers, or an inspector.
- Color is never the sole carrier of state; selection, hidden, locked, saving,
  and resolution states have text or accessible labels.
- Truncated element or style names retain the full value on hover/focus through
  their title or editable control.

## Explicitly deferred boundaries

Templates and Variables remain registered placeholder context panels. They must
not mutate presentation data or claim success until their represented model and editor
workflows exist. Prompt conversion is intentionally limited to standalone text
boxes; shape text, table cells, notes, groups, automatic refresh policy, saved
Resource Sets, transactional first-link creation, unlinking, and export-time
resolution are explicit follow-ups. Layout authoring beyond saving/removing
whole-slide layouts is likewise not a hidden editor mode: no undocumented layout
rail or inspector key is part of the current contract.

When one of these boundaries is implemented, update this file, the registered
workspace view vocabulary, and an interaction test in the same change.
