# Templates

## Purpose

Templates is the project library for reusable document, slide-deck, and spreadsheet bodies. A template stores a real target body plus slots. Authoring reuses the ordinary target editor's interaction layer; instantiation creates a full independent copy and retains only template-origin provenance. Slotless authoring/instantiation can ship first, while slot placement and replacement remain gated on the attachment-model gap below.

## Center modes

### Library mode

The default center surface contains:

- A raised-card shelf of up to ten recently used templates, using native
  horizontal scrolling and a discreet bottom scrollbar.
- Search by template or tag.
- Project/Shared/Personal scope filter.
- Document/Slide deck/Spreadsheet target filter.
- A bounded multi-select checkbox filter populated from the union of template
  tags, with All toggling the complete set on or off.
- A template table with name, target, scope, variable count, tags, and updated time.
- Updated/name/target/variable sorting with an icon-only direction control.

The recent shelf uses abstract target-shaped placeholders rather than stored thumbnails. Tags are durable flat labels, not folders; selected tags use match-any filtering. Single click on a recent card or table row inspects; double click remains an explicit placeholder until editor entry is wired.

### Authoring mode

Selecting Edit replaces the library center with the matching ordinary editor:

- Document template → [Document editor](document-editor.md).
- Slide template → [Slide deck editor](slide-deck-editor.md).
- Spreadsheet template → [Spreadsheet editor](spreadsheet-editor.md).

The tab remains a Templates screen with a visible “Template authoring” label and Back to library action. Target editor toolbars, context views, block inspector, rulers/canvas/grid behavior, and native body semantics are reused. The persistence adapter is different: a Template embeds its body and saves through revision-CAS, not general-resource snapshots/change sets. Undo before save is local to the authoring session; a stale save preserves the edited body for refresh/reapply.

`target` is chosen at creation and immutable afterward. Changing document/slides/spreadsheet target would require destructive body conversion and slot reconciliation, neither of which is modeled.

### Instantiation mode

Choosing Use Template opens a focused fill-and-preview flow:

- Destination project and new resource title. A project-scoped template can instantiate only into its own project; a global template may instantiate into the active project. Cross-project use first copies/promotes the template.
- Required slots first, optional slots collapsed.
- Text, image, data, and derived controls appropriate to each slot kind.
- Default values and prompt guidance.
- Live target-specific preview where affordable.
- Missing-required and generation-error summary.

Creation is one durable action. On success, open the new resource in the current or a new resource tab according to the invoking flow. Until slot attachment is modeled, this mode is enabled only for slotless templates; slotful templates remain previewable with a clear blocker.

## Context panel

### Library mode

| Key | Label | Contents and organization |
| --- | --- | --- |
| `overview-library` | Overview | Session-local Document/Slide deck/Spreadsheet creation and one compact total/scope/kind inventory. Recent use and selection are not repeated here. The only library rail entry for now. |

### Authoring mode

| Key | Label | Contents and organization |
| --- | --- | --- |
| `body` | Body | Target-specific outline: document rows/pages, deck slides/layouts, or workbook sheets. |
| `slots` | Slots | Slot list grouped Required/Optional and by kind. Add/list works; placement and jump-to-attachment stay disabled until an attachment field exists. |
| `insert` | Insert | The target editor's insertion catalog. Insert slot marker appears only after the attachment model exists. |
| `design` | Design | Target-specific Styles/Page, Theme/Layouts, or Styles/Print views. |

## Inspector targets

| Selection | Expanded sections | Collapsed sections |
| --- | --- | --- |
| Template or nothing | Name/description; target; Global/Project scope | Creator/revision/timestamps; provenance notes |
| Template card | Scope/kind/update/creator metadata; editable description; Duplicate/Delete; variable disclosures; tag add | None; the library inspector has no preview, revision or template-id section |
| Slot | Key; label; kind; required | Default; derived prompt; blocked body attachment |
| Body entity | Matching target-editor inspector | Template ownership; slot attachment only after model support |
| Instantiation | Destination/title; required values | Optional values; creation provenance |

Global-template edit authority must be permission-gated by a deployment/product rule; absence of `projectId` alone does not specify who may modify it.

## Slots

Supported slot kinds are:

- **Text** — human-provided text.
- **Image** — human-provided image.
- **Data** — bound project data/name.
- **Derived** — generated content; becomes a prompt block on first open.

Every slot has a key, label, required flag, optional default, and optional prompt. Once attachment is modeled, required slots block instantiation until valid, and derived failures preserve the created prompt block and expose refresh/provenance rather than leaving an unexplained blank.

### Blocking model gap

The current `TemplateSlot` defines a key, and the prose says that key appears on ordinary body content, but no `ContentBlock` or body entity has a `slotKey`/attachment field. The authoring screen can list slots but cannot truthfully highlight or jump to their body locations until that association is modeled.

Before implementing slot placement, add one explicit attachment mechanism. Do not infer attachment from labels, text, array position, or prompt content. The slot `default` is also always a string today, which needs clarification for image and data slots.

The Template interface embeds a full `DocumentBody`, while one prose passage describes document template body as `ContentBlock[]`. The interface should remain authoritative and the source documentation should be corrected before adapter implementation.

## Instantiation semantics

- Target discriminant and body type must agree.
- Copy the complete body. Slotless templates can do this now; replacing/filling slots waits for an explicit attachment mechanism.
- The result is an ordinary document, deck, or workbook with independent IDs and subsequent changes.
- The result records `templateId` as provenance.
- Later template edits never mutate already-created resources.
- Copying a project template to global scope creates another template; there is no live shared ownership relationship.

## States

- Library loading is separate from preview-body loading.
- A body preview failure retains metadata and an Open/Edit path.
- Revision conflicts preserve template metadata/body edits for reapply.
- Missing required slots are identified individually once slotful instantiation is enabled.
- A viewer can browse and preview but cannot author; using a template to create a resource follows the project's ordinary create permission.

## Retained tab view state

The `templates` state retains Library/Author mode, selected Template, target/scope filters, query, preview scroll, and panel geometry. The ordinary document/deck/workbook authoring runtime is retained by the tab while Author mode is active; the body itself remains native persisted model state. Reload may rebuild the preview but must preserve an acknowledged template selection and any recoverable form edits.

## Model coverage

- [Templates](../data-models/special-resources/template.md)
- [Document body](../data-models/general-resources/document.md)
- [Slide-deck body](../data-models/general-resources/slides.md)
- [Workbook body](../data-models/general-resources/spreadsheet.md)
- [Content blocks](../data-models/content/content-block.md)
