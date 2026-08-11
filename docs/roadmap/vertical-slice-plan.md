# Icarus Vertical-Slice Build Plan

## Purpose

This is the implementation order for rebuilding Icarus. It is a coding-agent handoff, not a complete description of every eventual capability.

Build the frontend and backend together. Each milestone must end in a usable behavior that crosses the complete system. Do not finish every possible dependency of a capability before presenting its first useful version.

The capability dependency graph describes the fully integrated system. It is a constraint on a procedure only when that procedure actually uses the dependency; it is not the roadmap.

## Bound runtime context

The initial application has no sign-in, user-selection, project-creation, or project-selection flow. It starts already bound to one user and one project.

```ts
export interface BoundProjectContext {
  userId: string;
  projectId: string;
  requestId: string;
}
```

The host/bootstrap layer supplies `userId` and `projectId`. Every frontend request, capability procedure, DBOS workflow identity, database operation, storage path, realtime topic, and Activity fact carries that scope.

For the current build, binding may come from local configuration or a development seed. Future authentication may establish the same trusted context without changing capability APIs. A caller-supplied identifier is context, not by itself proof of authorization; production identity verification remains a boundary concern, not part of these milestones.

## Source material from Taurus Alpha

Use `original-taurus-reference/frontend/` as the behavioral and visual reference. Do not mechanically port its Svelte shell or generic component library.

Retain these product behaviors:

- the permanent Project Overview tab;
- one open tab per resource;
- the New Tab launcher resolving in place into the chosen resource;
- project-scoped restoration of tabs and panel state;
- active surfaces contributing context and inspector lenses to a shell that renders them blindly;
- selection-driven inspector behavior;
- the centralized Celestial/Eclipse token model;
- the project overview, document editor, context library, and template-library interaction designs.

Replace these implementation details:

- Eclipse Theia replaces Alpha's custom workbench shell;
- IBM Carbon replaces homegrown generic controls;
- React/TypeScript replaces Svelte components;
- Supabase replaces custom database, auth-adjacent, storage, and realtime infrastructure;
- DBOS replaces the custom durable job/queue system where durable work is justified.

## Implementation rules

1. A milestone is complete only when its frontend, capability procedure, storage, project scoping, and end-to-end path work together.
2. A capability may appear in multiple milestones and gain procedures over time.
3. Do not add a dependency until a public procedure actually calls it.
4. Do not show inactive lens icons or create placeholder panels. The registry may support future lenses, but a lens is contributed only when its behavior exists.
5. Use Theia for workbench behavior, Carbon for ordinary controls, and Icarus components only for domain-specific compositions.
6. Do not introduce DBOS for a normal synchronous query or mutation.
7. Preserve strict project isolation even though the application is initially bound to a single project.
8. End every milestone with one automated browser path and cross-project database denial coverage.

## Milestone 1 — Bound project cockpit

### Objective

Open Icarus already bound to `userId` and `projectId` and arrive at a real Project Overview workspace with no project resources yet.

### Frontend

- Compose the Eclipse Theia browser application and one Icarus extension.
- Load `BoundProjectContext` during application bootstrap.
- Apply the centralized Icarus token system and Celestial/Eclipse themes.
- Register the permanent Project Overview widget.
- Establish the context- and inspector-lens contribution contract.
- Persist workspace panel width, collapsed state, and active lens for the bound user/project.
- Render project metadata and an honest empty-resource state.

### Initial lenses

Context:

- Properties
- All Resources — real empty state
- History — committed project facts, if any
- Members — contribute only when real project-access data exists

Inspector:

- Project Details
- Activity Details when an Activity row is selected

### Backend

- Supabase local project, migrations, generated database types, and project-scoping tests.
- Project runtime: retrieve and update the bound project only.
- Workspace runtime: retrieve and update the bound user's state for the bound project.
- Activity runtime: append and list compact committed project facts.
- No DBOS workflow.

### Acceptance

- The application opens directly into the bound project's Overview.
- Refresh restores the same workspace state.
- All reads and writes contain the bound `userId` and `projectId`.
- A database test proves that the same user context cannot read a different project.
- No sign-in, project directory, project creation, or project-selection UI exists.

## Milestone 2 — Revisioned document editing

### Objective

Create a document from a New Tab, type and style text, switch tabs, refresh, inspect revisions, and revert.

### Frontend

- Add the New Tab launcher with Document as its first resource type.
- Resolve the launcher tab in place after document creation.
- Enforce one open tab per resource.
- Integrate the document editor engine.
- Support paragraphs, headings, lists, text marks, links, and intrinsic rich-text styling.
- Keep container formatting—bounds, padding, alignment, wrapping, and overflow—owned by Document.
- Preserve Rich Content's original atoms as well as evaluated render output.

### Document lenses

Context:

- Info
- Search
- Outline
- Layout
- History

Inspector Details modes:

- no selection;
- caret/new text;
- text run;
- block;
- multiple blocks;
- row or containing document structure.

### Backend

- Document runtime and public CRUD/revision procedures.
- Rich Content runtime supporting text atoms, marks, ownership, rendering, and original-content retrieval.
- Document current and immutable revision tables.
- Rich Content current and immutable revision tables.
- Activity facts committed atomically with document mutations.
- Workspace expands to resource tabs and per-tab lens state.
- No Knowledge, Context, Derived Outputs, or prompt-block dependency yet.

### Acceptance

- Create, rename, open, edit, style, close, and reopen a document.
- Refresh returns the exact persisted content and workspace.
- `getRevision`, `listRevisions`, and `revert` work through Document.
- Rich Content returns both rendered text/style ranges and original atoms.
- Cross-project document reads and mutations fail.

## Milestone 3 — Knowledge from documents

### Objective

Make existing documents retrievable through Knowledge and organize documents into named contexts.

### Frontend

- Add the first Context library surface.
- Create named contexts from resource identifiers and kinds.
- Support live and copied context members.
- Support the reserved current-project context.
- Show document indexing state and retrieval citations.
- Add source/reference viewing without prompt execution yet.

### Backend

- Context runtime with named sets, union, and difference.
- Knowledge runtime indexing exact Document revisions.
- Intelligence `embed` only.
- Document-to-Knowledge registration/update/remove integration.
- DBOS serial workflow partitioned by project and document for indexing.
- Stable registration IDs make repeated dispatch idempotent.

### Acceptance

- A saved Document revision is indexed exactly once per accepted registration.
- Updating a Document replaces that resource's active lattice artifacts.
- Retrieval returns project-scoped results with resource and revision attribution.
- A named context limits retrieval to its resolved resource set.

## Milestone 4 — Live prompt blocks

### Objective

Insert a prompt block in a document, generate grounded content, inspect its sources, detect staleness, refresh it, or unlink it into ordinary content.

### Frontend

- Add slash-command insertion for prompt blocks.
- Add prompt-block editor and selection-specific inspector controls.
- Select a named or current-project context.
- Stream or display execution progress.
- Show source attribution and stale state.
- Support Refresh and Unlink.
- Add the AI Agent inspector only when it performs real work.

### Backend

- Intelligence inference/reasoning procedures.
- Derived Outputs runtime and revisioned result records.
- Document prompt-block representation.
- Knowledge retrieval through Context.
- DBOS durable prompt execution with stable operation IDs.
- Formula is introduced only if the prompt/rich-content procedure actually needs evaluation; do not add it merely because the complete system eventually uses it.

### Acceptance

- A prompt block retrieves from its context, executes, and stores a Derived Output.
- The document renders the result while preserving the original prompt block.
- Source revision changes make the result stale.
- Refresh creates the next result revision without duplicating a retried execution.
- Unlink converts the displayed result into ordinary document content.

## Milestone 5 — Context and template library

### Objective

Create reusable document templates whose context requirements can be named and bound.

### Frontend

- Complete the Context library composition UI.
- Add the Template library surface modeled on Alpha's preview-and-context layout.
- Toggle between template prompt structure and resolved content.
- Author named context slots rather than text-substitution placeholders.
- Add a template carousel to New Tab.
- Instantiate a document from a template into the active launcher tab.

### Backend

- Template runtime for document templates.
- Template revisions and context-slot definitions.
- Document creation from a selected template and context bindings.
- Context expansion as required by slot composition.

### Acceptance

- Create a template from a document.
- Define and bind context slots.
- Preview unresolved and resolved modes.
- Create an independent document from the template.

## Milestone 6 — Slides

### Objective

Create and edit a deck containing slides, text, and shapes.

### Frontend

- Add a slide/deck resource widget and canvas library.
- Add slide navigation and reordering.
- Support text and shape creation, selection, movement, resizing, and styling.
- Reuse Rich Content for intrinsic text and marks.
- Keep object bounds, padding, alignment, wrapping, and overflow owned by the slide object/container.

### Lenses

Context:

- Slides
- Templates
- References when operational
- History

Inspector, selected dynamically:

- General
- Text
- Shape
- Position
- Notes
- AI Agent when operational

### Backend

- Slides runtime with current and immutable revisions.
- Rich Content integration for text objects.
- Template and prompt-block support may be added as follow-on slices without blocking basic slide editing.

### Acceptance

- Create a deck, add/reorder slides, edit text and shapes, refresh, and revert.
- Two objects cannot cross project scope through identifiers or references.

## Milestone 7 — Spreadsheets

### Objective

Create and edit a structured grid with formulas, formatting, and named structured data.

### Frontend

- Select and integrate a mature open-source grid/editor library.
- Support cells, ranges, multiple sheets, formatting, and a formula bar.
- Add Structured Data and formula surfaces.

### Lenses

Context:

- Sheets
- Structured Data
- Templates
- References
- History

Inspector, selected dynamically:

- Cell
- Range
- Table
- Formula
- Formatting
- Chart or visual object when supported

### Backend

- Spreadsheet runtime with revisioned sparse-grid state.
- Formula expansion for spreadsheet evaluation.
- Structured Outputs integration.
- Rich Content where cells contain rendered/original rich values.

### Acceptance

- Edit cells and ranges, enter formulas, persist formatting, refresh, and revert.
- Formula recomputation is deterministic for the same inputs.
- Cross-project references fail.

## Milestone 8 — General files

### Objective

Upload arbitrary files and register supported text formats with Knowledge.

### Frontend

- Upload and update file content.
- Show file metadata, revision history, and supported previews.
- Show Knowledge indexing eligibility and status.

### Backend

- General Files runtime using the two-table current/revision resource model.
- Supabase Storage for file bytes under project-scoped paths.
- The resource revision represents filename, extension, metadata, and content identity together.
- A fixed supported-text-extension set determines Knowledge registration.
- Register, update, or remove the exact file revision in Knowledge through DBOS.

### Acceptance

- Upload, update, retrieve, delete, restore, and revert a file.
- Supported text files are indexed and updated in Knowledge.
- Unsupported/binary files remain valid General Files without being forced through text indexing.

## Milestone 9 — Research and agents

### Objective

Add structured research and durable agent work only after the primary work surfaces are usable.

### Frontend

- Questions, Findings, Hypotheses, and Persona library/workbench surfaces.
- Agent plans, progress, pause/resume, and provenance.
- Comments and Presence where their concrete collaboration use cases require them.

### Backend

- Questions, Findings, Hypotheses, and Persona capabilities.
- Durable DBOS agent workflows calling the same public capability procedures as users.
- No agent-only bypass around project context, revisions, or authorization.

## Frontend ownership map

All feature code remains inside the single Icarus Theia extension at first.

```text
frontend/extension/src/browser/
├── shell/                            # Bound context, lens registry, global commands
├── features/
│   ├── project-overview/
│   ├── new-tab/
│   ├── document/
│   ├── contexts/
│   ├── templates/
│   ├── slides/
│   ├── spreadsheet/
│   ├── general-files/
│   └── research/
├── components/
│   ├── carbon/                       # Thin repeated-default adapters only
│   └── composites/                   # Icarus-specific compositions
├── data/                             # Project-scoped query/mutation adapters
└── styles/                           # Authoritative tokens and Carbon bridge
```

## Milestone completion checklist

Before declaring any milestone complete:

- [ ] Public capability procedures and inputs/outputs are documented.
- [ ] Runtime dependencies are narrow and explicit.
- [ ] Database migrations and project-scoped constraints exist.
- [ ] Cross-project denial tests pass.
- [ ] Frontend feature uses the real procedures—no silent mock.
- [ ] Context and inspector lenses shown by the UI are operational.
- [ ] Current state, revisions, and Activity facts commit atomically where applicable.
- [ ] DBOS workflow identity and queue partition are documented where DBOS is used.
- [ ] Refresh/reconnect behavior is tested.
- [ ] One browser-level end-to-end path proves the milestone objective.
- [ ] The next milestone does not require rewriting the completed public contract.

## First coding-agent assignment

Implement **Milestone 1 only**. Do not scaffold every future feature or capability.

The result should be a bootable Theia browser application that loads a configured `BoundProjectContext`, enters the corresponding Project Overview, persists project-scoped workspace panel state, renders the operational project lenses, and proves cross-project denial at the database boundary.
