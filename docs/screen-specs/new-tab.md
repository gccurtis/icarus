# New Tab

## Role in the workbench

New Tab is a transient launcher, not a persisted resource. It opens from the plus button in the tab strip. When the user creates or opens a tab-capable object, the launcher resolves in place into that object's tab so tab order and focus remain stable. The current workbench needs an explicit launcher tab target and resolve operation before this behavior exists.

## Center surface

### Search/open field

The first focus target searches openable project objects by title and kind. Results show kind, title, updated time, an actor only where the selected kind stores or can derive one, and relevant warning state. Results are cursor-paginated/virtualized and distinguish no project objects from no matches and restricted results. Choosing an object dispatches according to [the Overview rules](project-overview.md#3-project-work-table).

### Create

Large primary cards:

- Blank document.
- Blank slide deck.
- Blank spreadsheet.
- Research thread.
- Analysis.

The first click on a card selects it and opens its setup in the Inspector; the card's explicit Create action or Enter confirms. A clearly labeled quick-create subaction may bypass setup. Document, deck, and spreadsheet cards expose a secondary “Choose template” action. Until a project/user preference exists, blank decks explicitly ask for 16:9 or 4:3 and preselect 16:9 rather than referring to an unmodeled default.

The global Copilot replaces Taurus Alpha's separate AI Create card. Starting work with AI uses Plan or Action and creates a tracked Agent Task rather than a second creation protocol.

### From templates

A horizontal or compact grid of compatible recent templates shows:

- Preview derived from the real template body.
- Name and description.
- Document/slides/spreadsheet target.
- Global or project scope.
- Required-slot count.

Selecting a card previews it in the inspector. Slotless templates may instantiate now. A slot-fill step is gated until the model can attach slot keys to exact body entities; required-slot templates remain previewable but show that implementation blocker rather than claiming reliable replacement.

### Bring content in

- Upload file.
- Add connector.
- Open a connector already needing authentication.

### Organize

- New Context (creates a `ResourceSet`).
- New Template.
- New Persona.
- New Automation.

### Recent

Recently opened or recently updated project objects appear as a compact list. “Recent” is derived view state, not a persisted favorite model.

## Context panel

| Key | Label | Contents and organization |
| --- | --- | --- |
| `create` | Create | Default. Primary resource and workflow types grouped as Work, Investigate, and Organize. |
| `recent` | Recent | Recently opened first, then recently updated; grouped by day and filterable by kind. |
| `templates` | Templates | Search plus global/project and target filters. Compatible templates first. |
| `import` | Import | Upload, available connector providers, existing connectors, and authentication/sync warnings. |

The center gives a welcoming overview; the panel gives denser navigation within the same choices.

## Inspector targets

### Nothing selected

- Short explanation of the launcher.
- Keyboard hint for search and command palette.
- Project role/read-only status.

### Blank document

- **Identity** — provisional title.
- **Page** — paper, orientation, margins.
- **Action** — Create blank or Choose template.

### Blank deck

- **Identity** — provisional title.
- **Format** — 16:9 or 4:3.
- **First slide** — initial layout preview.
- **Action** — Create blank or Choose template.

### Blank spreadsheet

- **Identity** — provisional title.
- **Workbook** — first-sheet name.
- **Action** — Create blank or Choose template.

### Research thread

- **Title**.
- **Mode** — Discover, Question, or Hypothesis.
- **Anchor** — required exactly once for Question/Hypothesis mode.
- **Action** — Start research.

### Analysis

- **Title and description**.
- **Initial input** — a non-function Name Manager variable if chosen now.
- **Display** — Table by default.
- **Action** — Create analysis.

### Persona

- **Identity** — name, description, avatar, Project/Global availability.
- **Definition** — Focus, Background, Approach, Output preferences, Verification completion.
- **Context/tools** — standing scope, model-binding name, allowed tools.
- **Action** — Open [Persona editor](personas.md).

### Automation

- **Identity** — name and enabled state.
- **Rule** — exactly one trigger and one action.
- **Action** — Open [Automation editor](automations.md), disabled until saved deliberately.

### Template

- **Identity** — name, description, target, scope.
- **Preview** — target-specific preview.
- **Slots** — required, optional, defaults, and derived prompts.
- **Provenance** — creator and updated time.
- **Action** — Use template.

### Upload

- **Files** — names, sizes, inferred types.
- **Ingestion** — upload and extraction progress.
- **Problems** — unsupported/error details while preserving the uploaded file object.

### Connector provider or connector

- Provider and purpose.
- Explicit scope choices.
- Delivery/sync model.
- Existing authentication and last-sync state.

## Resolution behavior

1. User chooses a creation/open action.
2. The launcher shows local progress and remains cancellable until a durable object exists.
3. On success, replace the launcher target with a document/slides/spreadsheet/research/analysis target in the same tab. Contexts, templates, Personas, and Automations resolve to their project-level library screen with the new object or creation draft selected. Files, connectors, and findings remain in an owning screen/Inspector under the first tab vocabulary.
4. On failure, keep the launcher, preserve entered values, and show the error in both center and inspector.

`resolveLauncher(tabId, target)` is atomic with canonical-target deduplication. If another tab already owns `target`, including because of a concurrent open, activate that existing tab and close the launcher instead of creating a duplicate. For a system library target, transfer the selected object or deliberate creation draft into that existing screen before closing the launcher. If transfer or activation fails, preserve the launcher and its draft. A successful create of a newly minted resource normally cannot collide, but it follows the same rule.

Cancel before durable creation returns to the unconfigured launcher and releases any staged upload. Once the backend acknowledges an object, Cancel means close/leave it, not pretend it was never created. Connector authentication returns to the same launcher tab and restores its Import selection; an abandoned callback keeps a retryable provider card.

Template instantiation creates a full independent copy. Later template changes do not modify the created resource; `templateId` remains provenance only.

## Retained tab view state

The `new-tab` state retains the active context, query, selected card/result, filters, scroll, and the discriminated `LauncherDraft` defined by the [shell contract](workbench-shell.md#typed-retained-tab-state). Import drafts keep staged upload IDs, never raw file handles. These fields survive tab switches; browser reload may retain ordinary setup fields but must clear unrecoverable file handles and explain which uploads remain staged.

## Model coverage

- [Project resources](../data-models/core/project.md)
- [Research](../data-models/research/research.md)
- [Analysis](../data-models/data/analysis.md)
- [Templates](../data-models/special-resources/template.md)
- [External files](../data-models/special-resources/external-file.md)
- [Connectors](../data-models/special-resources/connector.md)
