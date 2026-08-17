# Personas

## Purpose

Personas is the project-level library and editor for reusable agent behavior. It manages project Personas and globally available Personas, while keeping provider credentials and concrete deployment-model administration outside project data.

The primary entry points are Manage Personas in the Copilot Inspector, New Tab, and the Project Overview Tasks view.

## Center surface

### Library mode

- Search by name/description.
- Project/Global filter.
- Cards or rows with avatar, name, description, standing-scope summary, model-binding name, and tool count.
- Create Persona and Duplicate actions.
- Open/edit action; selecting a row previews it in the Inspector.

There is no archived/favorite/tag field, so those filters do not appear as durable metadata.

### Editor mode

The fixed header contains editable name, optional description, avatar, Project/Global scope, revision save state, and Back to library.

The form then presents five separately labeled plain-text sections:

1. **Focus** — what to concentrate on and leave alone.
2. **Background** — standing facts always injected into the prompt.
3. **Approach** — method, rigor, standards, and boundaries.
4. **Output preferences** — expected shape, length, and tone.
5. **Verification** — what to check before finishing.

Only the current section expands into a large editor; the others show a short preview. Empty sections are omitted from the rendered prompt. At least one section or a standing scope must be non-empty.

Below the definition:

- **Standing scope** — inline `SetExpression` or saved Context picker with resolved preview.
- **Model binding** — optional deployment binding name, not provider/model credentials.
- **Tools** — explicit allowed tool-name checklist/search.
- **Avatar** — emoji or external-file image.

## Context panel

| Key | Label | Contents and organization |
| --- | --- | --- |
| `library` | Personas | Default. Project then Global groups, search, selected Persona pinned. |
| `definition` | Definition | Focus, Background, Approach, Output preferences, Verification with completion indicators. |
| `scope` | Context | Standing Resource Set expression, resolved members, zero-member warning, and Open Context screen. |
| `tools` | Tools & model | Allowed tools and named model binding; provider credentials never appear. |
| `work` | Chats & tasks | Persona threads and Agent Tasks using this Persona, with task status and open action. |

## Inspector targets

| Selection | Expanded sections | Collapsed sections |
| --- | --- | --- |
| Persona or nothing | Identity/avatar; project/global availability | Revision, creator, updated time |
| Definition section | Section purpose; plain-text value | Rendered-prompt preview |
| Scope node | Operator-specific Resource Set controls | Resolution and zero-member warning |
| Tool | Tool name; allowed/not allowed | Runtime description when available |
| Model binding | Binding name/default | Resolved deployment detail only in deployment settings |
| Persona thread | Title; Persona; branch origin | Messages, creator, updated time |
| Agent Task | Status; title; prompt | Plan, result, timing, current Persona link |

## Background versus scope

- Background is always inline prompt text and consumes context on every call.
- Scope is retrievable project material and is not pasted into the prompt.
- A pure-scope Persona with five empty sections is legal.
- An absent scope means the Persona itself does not narrow retrieval; the consuming request's scope rules apply.
- A zero-member scope is unsafe under current retrieval semantics because empty is treated as whole-project. Warn/block until explicit-empty is distinguishable.

For a global Persona, project/kind expressions can resolve in the active project. Explicit resource IDs or saved project Context IDs are not safely portable; the editor blocks them for Global scope until cross-project binding semantics exist.

## Save, history, and deletion

- Persona edits use revision-based stale-write rejection and preserve the form for reapply.
- Past tasks and threads keep a live `personaId`, not a snapshot. Editing a Persona changes what old work displays as the Persona's current configuration; the execution-time focus/scope/tools/model cannot be reconstructed.
- Global-Persona edit authority is a deployment rule not defined by `projectId` absence. Unauthorized users may use but not modify it.
- Deletion is gated on a dependency/tombstone policy for threads, tasks, and actor labels. Until then, remove Delete rather than breaking historical identity.

## Retained tab view state

The `personas` state retains Library/Author mode, selected Persona, scope filter, query, panel geometry, and an optional typed authoring-session ID. The authoring runtime owns the five definition sections, tool/model choices, standing scope, dirty fields, and stale-write comparison; the ID is not permission to store an opaque JSON blob. Reload restores acknowledged fields and clearly marks any form draft that cannot be recovered.

## Model coverage

- [Persona](../data-models/ai/persona.md)
- [Persona conversations](../data-models/ai/persona-chat.md)
- [Agent tasks](../data-models/ai/agent-task.md)
- [Resource Sets](../data-models/special-resources/resource-set.md)
- [Intelligence configuration boundary](../processes/intelligence.md)
