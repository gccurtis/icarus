# Icarus screen specifications

This directory defines the product shape of every first-generation Icarus workbench screen. The documents describe what the center surface, context panel, inspector, and shared copilot must contain. They are deliberately more specific about information architecture and state than about component implementation.

The source of truth for persisted objects remains [`docs/data-models`](../data-models/README.md). The source of truth for collaboration and retrieval behavior remains [`docs/processes`](../processes/). Where a requested interaction is not representable by the current model, these specifications call it out instead of inventing silent persistence.

## Screen inventory

| Tab or surface | Specification | Primary center surface |
| --- | --- | --- |
| Shared workbench | [Workbench shell](workbench-shell.md) | Top bar, tabs, panels, status, and cross-screen rules |
| Project Overview | [Project Overview](project-overview.md) | Create actions, resource table, and activity |
| New Tab | [New Tab](new-tab.md) | Create, open, import, or start from a template |
| Document | [Document editor](document-editor.md) | Paginated rich-block document |
| Slide deck | [Slide deck editor](slide-deck-editor.md) | Current slide canvas with ordered deck navigation |
| New Slide | [New Slide](new-slide.md) | Layout and insertion-point chooser |
| Spreadsheet | [Spreadsheet editor](spreadsheet-editor.md) | Sparse workbook grid and floating charts |
| Research | [Research](research.md) | Mode-anchored research conversation and editorial promotion |
| Analysis | [Analysis](analysis.md) | Shelves, inputs, and evaluated table or chart |
| Context | [Context](context.md) | Saved Resource Set expression builder and live resolution |
| Templates | [Templates](templates.md) | Template library and ordinary-editor authoring |
| Personas | [Personas](personas.md) | Global/project Persona library and five-section editor |
| Automations | [Automations](automations.md) | One-trigger/one-action rule library and editor |
| Copilot | [Copilot bar](copilot-bar.md) | Global composer with persona chats and agent tasks in the inspector |

## Context-rail map

| Screen | Default | Additional context-panel views |
| --- | --- | --- |
| Project Overview | Resources | Activity, Tasks, Health, Context, Templates |
| New Tab | Create | Recent, Templates, Import |
| Document | Navigator | Find, Insert, Styles, Page, Comments, Context |
| Slide deck | Slides | Layers, Find, Layouts, Insert, Theme & styles, Notes, Comments, Context |
| Spreadsheet | Sheets | Data & names, Find, Dependencies, Objects, Insert, Styles, Print, Comments, Context |
| Research | Inquiry | Findings, Sources, Tool trace, Threads, Context |
| Analysis | Data | Inputs & joins, Chart, Filters & sorts, Names |
| Context | Saved Contexts | Resources, Operators, Resolved, Knowledge |
| Templates, library | Library | Targets, Recent |
| Templates, authoring | Body | Slots, Insert, Design |
| Personas | Personas | Definition, Context, Tools & model, Chats & tasks |
| Automations | Automations | Triggers, Actions, Health |

The detailed documents define the sections, collapse behavior, selection states, and inspector contents behind every entry.

## Stable screen keys

These are proposed workbench keys, not Convex table names:

```ts
type ScreenKind =
  | "project-overview"
  | "new-tab"
  | "document"
  | "slides"
  | "spreadsheet"
  | "research"
  | "analysis"
  | "context"
  | "templates"
  | "personas"
  | "automations";
```

`new-slide` is not a tab kind. It is a modal or temporary in-editor surface owned by a slide-deck tab. “Context” is the user-facing label for the persisted `ResourceSet` model.

## Reading rule

Every screen follows the same three questions:

- **Context panel:** What surrounds this work, and what can be navigated to or brought in?
- **Center:** What is the primary object or activity the user is working on?
- **Inspector:** What exact selected object is being examined or changed?

The context panel is a map, not a second toolbar. Formatting and selected-object properties belong in the inspector. Commands that are frequent and selection-independent may appear in a compact center toolbar as well as the command palette.

## Model gaps that block promised UI

The screen documents preserve these as explicit open decisions:

1. Template slots have no field that attaches a slot key to a body entity.
2. `SheetChart` has no stable `id`; first-class chart selection and editing remain gated.
3. Research has no candidate-finding state or thread-level reviewed-source ledger.
4. Persona threads, research threads, tasks, and messages have no request-level `SetExpression` for composer context.
5. Analysis has no persisted color, size, detail, label, tooltip, or series shelves; joins, filters, and sorts also have no stable IDs.
6. Spreadsheet comments cannot anchor to a range or chart.
7. Natural document pages are computed views, not persisted entities.
8. Retrieval currently treats absent and empty scopes alike as whole-project; zero-member Contexts need an explicit-empty contract before they can safely mean “search nothing.”
9. Research has no branch provenance, and message-to-finding source conversion is not total.
10. Plan-mode lifecycle, Ask cancellation, and task waiting/retry semantics need runtime/model contracts.
11. Resource-local selection/range attachments need a request type separate from `SetExpression`.
12. Per-source indexing health has no authoritative projection, and lattice tree-versus-overlapping-clique descriptions conflict.
13. Persona/Automation deletion needs historical identity/tombstone behavior.
14. Slide placeholders have no stable key; duplicate-role reset and first-class placeholder selection remain gated.

Some gaps permit a reduced first pass; items explicitly marked gated must land before the related interaction ships. In every case, the UI must not imply persistence that does not exist.

## Current shell prerequisites

The present Icarus shell is a strong structural scaffold, but these specifications require deliberate model expansion before the screens can be registered:

- Replace resource-only tab identity with the `TabTarget` contract and add launcher resolution.
- Expand screen/context/inspection key unions and resolve context views by `(screenKind, contextId)`.
- Give every editor a retained tab runtime so switching views cannot discard buffered edits, undo, or selection.
- Move Copilot takeover/destination state above the active tab and preserve prior Inspector/focus state.
- Add typed per-screen tab view state, bottom Copilot safe-area behavior, and composed status-bar contributions.
- Build the missing backend projections only where specified: Context resolver proofs, operational knowledge health, and request-level scope/attachments.
