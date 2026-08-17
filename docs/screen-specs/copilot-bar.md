# Copilot bar

## Purpose

The Copilot is a compact, bottom-center dispatch surface available from every tab. It starts or continues persona conversations and agent tasks, makes the retrieval/input context selected for the request explicit, and uses a reversible Inspector takeover for history and execution detail. Project membership remains the access-control boundary; a Resource Set is a retrieval selector, not authorization.

It does not create a generic Chat object. Ask uses a `PersonaThread`; Plan and Action use an `AgentTask`. Research conversation remains in the [Research screen](research.md).

## Compact dock

The dock floats over the work surface, stays translucent while idle, and becomes solid on hover, focus, streaming, or Copilot-inspector activity. Its width is bounded so it never reads as a seventh workbench panel.

### First row: dispatch controls

- **Mode** at left: Ask, Plan, Action.
- **Persona** centered: selected project/global Persona, with avatar and scope indicator.
- **Activity** at right: running/waiting/error count; opens Copilot home in the inspector.

### Second row: composer

- Add Context button.
- Up to two visible context chips, then a “+N” summary.
- Textarea that grows from one to four lines and then scrolls.
- Send when idle. A running task exposes Cancel; an Ask response does not expose Stop until a cancelled/partial-message state is modeled.

Enter submits; Shift+Enter inserts a newline. Empty submission is disabled. Menus open upward. The exact current mode, persona, and context remain readable without opening the inspector.

## Mode semantics

| Mode | Durable destination | Behavior |
| --- | --- | --- |
| Ask | Persona thread + message | Continue only the explicitly selected destination thread; otherwise create a new thread for the selected Persona. No goal, task status, plan, or result is invented. |
| Plan | Draft Agent Task | Create a task from the prompt, produce a reviewable checklist, and wait for explicit Start/Accept Plan before running material actions. |
| Action | Running Agent Task | Create and start a tracked task immediately, subject to tool/permission gates. |

Ask requires a Persona because `PersonaThread` does. The product should seed a global Generalist Persona or require a deliberate selection; it must not store an untyped generic conversation. Plan/Action may use the selected Persona or an unbound task where the model permits.

The mode is dispatch intent, not a new persisted `mode` field on `AgentTask`.

Plan mode needs one explicit lifecycle contract. Recommended first contract: create one task in `draft`; append the planning response/tool calls while it remains draft; on success write `plan` and keep it draft; Accept Plan changes that same task to `running`; planning failure leaves an error response and task error without pretending material execution began. This is a required runtime convention, not behavior already stated by the model.

The composer always names its destination: New conversation, a Persona-thread title, New task, or a selected task title. A clear action returns to a new destination. Changing Persona or mode preserves separate client drafts rather than silently retargeting text.

## Context instrumentation

### Retrieval-scope chips

- Saved Context/Resource Set.
- Explicit project resource promoted to a one-resource scope.
- Persona standing scope.

### Input-attachment chips

- Active resource.
- Current selection with resource-local stable ID/range.
- Explicit project resource.

Scope and attachment are separate concepts. `SetExpression` can represent resources, but it cannot represent a block, text range, slide element, or spreadsheet range. Chips carry stable references plus display labels; selection attachments need their own typed request model.

### Default behavior

- Project membership/authorization is always enforced but does not participate in scope union.
- The active resource is suggested, not silently attached.
- A current selection is suggested when one exists.
- The Persona's standing scope is shown as a distinct, mandatory base for that Persona. Changing it means choosing/editing the Persona, not silently disabling part of its identity for one turn.
- Explicit resources and Contexts are added deliberately.
- With no effective retrieval scope, the current retrieval process searches the whole project lattice; the bar states this as “Whole project knowledge.”
- After a request-level scope/attachment model exists, tabs may change after dispatch and a running task keeps the stable references captured at submission. Before then, persistence-backed Action/Plan requests using such chips are blocked rather than relying on process memory.

### Context editor

Add Context opens an inspector section with:

1. Current selection and active resource suggestions.
2. Searchable project resources.
3. Saved Contexts and resolved counts.
4. Persona standing scope.
5. Effective-scope preview and stale/missing/zero-member warnings.

The UI must make the combination rule explicit before scoped dispatch ships: the Persona's scope plus any enabled request scopes form a union, with Difference logic expressed inside a selected Resource Set. Project membership is never a union member. A Persona with no scope and no request scope uses whole-project retrieval.

Because the current retrieval process also treats an **empty resolved scope** as unscoped, a zero-member Context could unexpectedly broaden to the whole project. The bar must block that scope with a warning or the backend must add an explicit-empty sentinel before it can be submitted as a narrowing scope.

### Persistence gap

The current `Message`, `PersonaThread`, `ResearchThread`, and `AgentTask` models have no first-class request-level `SetExpression` or attachment list. Until one is added:

- Context choices are draft composer state.
- Retrieval tool calls record the exact resolved scope/manifest they actually used.
- The UI must not promise that reopening an old turn restores its original chip list.

The durable fix needs both a request/turn-level retrieval scope and a separate typed attachment/input list for resource-local selections. Do not hide either inside prompt prose.

## Inspector takeover

Typing in the dock alone does not replace an unrelated Inspector selection. Activity, Add Context, an explicit expand action, or submission opens a temporary, reversible Copilot takeover:

- Remember the previous inspection and collapse state.
- Closing Copilot restores them when their target still exists.
- Switching tabs while Copilot is open keeps project-level task/chat activity visible without rewriting the destination as the new active tab.
- Selecting an ordinary work-surface object returns the inspector to that object; the task continues in the background.

This takeover is project-level state, not the active tab's ordinary `Inspection`. It records previous tab, inspection, collapse state, and focus-return target. Add Context pushes a Context subview within Copilot; Back returns to the same conversation/task/home and keeps the composer destination unchanged.

Composer drafts are client state keyed by project, destination/new-intent, mode, Persona, and originating tab. They survive tab/Persona/mode switches during the session but are not durable messages/tasks until acknowledged by the backend.

### Copilot home

1. Search conversations and tasks.
2. Waiting, then Failed, then Running tasks. Waiting remains generic until the task model records why it is waiting and who or what can unblock it.
3. Recent Persona conversations.
4. Completed tasks, collapsed.
5. New Persona conversation action.
6. Manage Personas, which opens the [Personas screen](personas.md).

Rows show Persona, title, status, time, task plan progress, and origin. Running/error/waiting state uses text and icon, never color alone.

### Persona conversation view

- Thread title and Persona.
- Branch origin when present.
- Append-only transcript.
- Message sources and tool calls.
- Composer targeted to this thread.
- Branch from message.
- Create task from message.

A persona conversation has no status, plan, or result panel. All project members can read it under the current model.

### Agent Task view

- Immutable kickoff prompt.
- Title and optional description.
- Persona, origin actor, parent task, and persona-thread branch origin.
- Status and timing.
- Plan checklist with pending/active/done/skipped/failed states.
- Conversation and tool-call timeline.
- Result blocks.
- Spawned tasks.
- Error or waiting state.

State-specific primary actions are:

| State | Primary treatment |
| --- | --- |
| Draft | Review plan and Start; changing the immutable kickoff prompt requires a new draft task |
| Running | Follow latest activity and Cancel |
| Waiting | Show a generic blocked/waiting treatment and retained trace; do not show Reply, Resume, or “Waiting for you” until a typed waiting reason, requested input, and responsible actor are modeled |
| Complete | Lead with result; offer Copy/promote into a durable resource |
| Failed | Lead with error and retained trace; Retry is unavailable until retry semantics are modeled |
| Cancelled | Readable trace and any result the runtime actually persisted; no active composer unless branching into a new task |

Task results are not resources and cannot enter a Resource Set directly. Promote/copy useful results into a finding, document, slide deck, or spreadsheet when they must become retrievable project knowledge.

## Persona selection and inspection

Persona rows show name, description, global/project availability, optional model binding, and allowed-tool summary. Persona detail sections are:

- Identity/avatar; expanded.
- Focus, Background, Approach, Output preferences, Verification; expanded one at a time.
- Scope and resolved preview; expanded.
- Model binding and tools; collapsed.
- Global/project availability, revision, and attribution; collapsed.

Background is prompt material. Scope is retrievable material. The UI explains the difference and never labels one as the other. Concrete providers, credentials, and deployment model setup belong outside the project workbench.

Past tasks reference the live Persona by ID. Their Persona inspector therefore shows the Persona's current configuration, not a historical snapshot of focus, scope, tools, or model binding used at execution time.

## Sources, tools, and streaming

- Stream transport/cursor/UI is ephemeral, but `Message.state: "streaming"` is stored until updated to complete or error.
- Tool calls show pending/success/error, duration, expandable input/output, and error.
- Sources show an excerpt when `MessageSource` carries one. Locator/offset/relevance/density details appear only when retrieval tool output supplies them; open-resource/open-URL actions remain available by source kind.
- Cancelling a running task moves the durable task toward `cancelled` according to the task runtime. Ask has no Stop control until the message model can represent user-stopped partial output without mislabeling it as an error.
- The dock shows the latest status even when the Inspector is closed.
- A task run survives tab changes and app-panel changes.

The Taurus Alpha Web toggle is not copied as a universal control: tool availability comes from Persona/task permissions and must be operational, not decorative.

## Failure and stale-reference behavior

- If a selected block/range no longer exists before submission, mark the chip Stale and require removal or reselection.
- If a resource becomes inaccessible under project permissions, fail closed and identify the missing reference.
- A failed message remains in its thread with sources/tool trace.
- A failed task always retains prompt, plan, conversation, and error. Result-so-far is shown only if the runtime actually wrote `result`; the current model does not guarantee partial-result capture.
- Offline submission remains a draft until the backend acknowledges creation; do not show a phantom running task.

## Model coverage

- [Personas](../data-models/ai/persona.md)
- [Persona conversations](../data-models/ai/persona-chat.md)
- [Agent tasks](../data-models/ai/agent-task.md)
- [Messages, sources, and tool calls](../data-models/core/message.md)
- [Resource Sets](../data-models/special-resources/resource-set.md)
- [Actors and attribution](../data-models/core/actor.md)
