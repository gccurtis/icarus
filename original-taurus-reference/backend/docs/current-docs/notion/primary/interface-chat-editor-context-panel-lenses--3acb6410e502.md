---
title: "Interface - Chat Editor Context Panel Lenses"
notion_page_id: "3acb6410e5028173a1d0c6266bbe87c9"
notion_url: "https://app.notion.com/3acb6410e5028173a1d0c6266bbe87c9"
project: "Taurus Yesod"
role: "Primary"
format: "Spec"
created: "2026-07-29 00:48:22Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Interface - Chat Editor Context Panel Lenses

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

<callout icon="🧭" color="blue_bg">
	**Implementation-facing Taurus Yesod specification.** This page defines the complete context-panel lens set for the Chat editor. It describes what every lens looks like, displays, and does; selection-specific formatting remains in the inspector.
</callout>
# Decision
Chat contributes a complete, Yesod-owned left-rail lens registry. Every lens has a stable serializable ID, a semantically matched Lucide icon, and a component that reads a Chat-owned session/read model. The shell renders the registry without knowing Chat domain details.
The left panel answers **“What exists around this work?”** (<mention-page url="https://app.notion.com/p/e12b6939dbc444698aca18d4162bab10"/>). The contract is defined by Yesod product and runtime requirements and remains independent of any current editor implementation.
# Context versus inspector
The context panel is the Chat map. It may navigate, filter, reveal relationships, and invoke resource-level commands. It does not become the formatting surface for the current selection.
Selecting a turn, prompt range, response range, citation, attachment, or task may update counts and highlights inside the current context lens. Turn-specific editing, regeneration, redaction, and response controls remain in the inspector.
The right inspector continues to answer **“What can I change about this selection?”**. Focusing the universal AI Quarterback still opens the right-side AI lens; the left-side **AI Tasks** lens is the durable task/status map and does not duplicate prompt composition.
Companion selection and inspector contract: <mention-page url="https://app.notion.com/p/3acb6410e502815d9ba5ebc9389ecf63"/>.
# Shared shell and visual contract
```plain text
┌──────── icon rail ────────┬──────── expanded content rail ────────┐
│ 32 × 32 lens button       │ ACTIVE LENS LABEL                     │
│   16 × 16 Lucide icon     │ primary control / summary             │
│   tooltip on hover/focus  │ filters or grouped sections           │
│   active tint + color     │ scrollable content                    │
│                           │ honest loading / empty / error state   │
│ collapse control at foot  │                                        │
└───────────────────────────┴────────────────────────────────────────┘
```
- The preferred content width is 280px, with a 220px minimum and 380px maximum.
- Verify each icon export against the target application dependency before implementation; do not substitute a semantically weaker glyph merely because it is already imported elsewhere.
- The icon rail remains visible when collapsed. Selecting a different icon selects that lens and expands the panel; selecting the active icon while expanded collapses it.
- The open rail displays the active lens label in the fixed header. Icons never carry meaning without the tooltip and open-state label.
- Active treatment uses the action color at restrained opacity; inactive icons use muted color and receive an elevated hover/focus surface. Celestial and Night change colors only.
- Lens order is stable. The persisted value is the stable ID, never a component reference. An unknown or retired ID repairs to `info`.
- Each editor instance remembers its selected lens. Tab changes restore the lens for that resource without persisting transient selection, query text, drafts, hover, or loading state.
- The content rail uses one continuous surface, dividers, compact rows, and restrained badges. It does not place every row in a floating card.
- If the icon set exceeds available height, only the lens list scrolls; the collapse control stays fixed at the bottom.
# Lens registry
<table header-row="true">
<tr>
<td>Order</td>
<td>Stable ID</td>
<td>Label</td>
<td>Lucide icon</td>
<td>Primary job</td>
</tr>
<tr>
<td>1</td>
<td>`info`</td>
<td>Info</td>
<td>`Info` — a circled information mark; neutral resource identity</td>
<td>Answer what this chat is, how it is configured, and whether it is healthy.</td>
</tr>
<tr>
<td>2</td>
<td>`search`</td>
<td>Search</td>
<td>`Search` — a magnifying glass; the standard rescue path</td>
<td>Find prompt, response, citation, attachment, task, or reusable prompt content.</td>
</tr>
<tr>
<td>3</td>
<td>`prompts`</td>
<td>Prompts</td>
<td>`MessageSquareText` — a message bubble with text; reusable starting language</td>
<td>Find, inspect, and load reusable prompts without submitting them or mutating chat history.</td>
</tr>
<tr>
<td>4</td>
<td>`threads`</td>
<td>Threads</td>
<td>`GitFork` — a branching fork; conversation topology</td>
<td>Make the turn tree, active path, forks, and hidden subtrees understandable and navigable.</td>
</tr>
<tr>
<td>5</td>
<td>`context`</td>
<td>Context</td>
<td>`LibraryBig` — a compact library; input resources surrounding the conversation</td>
<td>Show exactly what resources and files informed prompts on the active path.</td>
</tr>
<tr>
<td>6</td>
<td>`evidence`</td>
<td>Evidence</td>
<td>`BookOpenCheck` — an open book with a check; supported response output</td>
<td>Audit citations and evidence supporting responses without crowding the chat stream.</td>
</tr>
<tr>
<td>7</td>
<td>`personas`</td>
<td>Personas</td>
<td>`Users` — two people; behavioral identities used across turns</td>
<td>Explain the chat default persona and the immutable persona snapshot used by each turn.</td>
</tr>
<tr>
<td>8</td>
<td>`ai-tasks`</td>
<td>AI Tasks</td>
<td>`ListTodo` — a checklist; durable agent work associated with the chat</td>
<td>Track agentic work launched from Plan or Action turns.</td>
</tr>
<tr>
<td>9</td>
<td>`history`</td>
<td>History</td>
<td>`Clock` — a clock face; append-only revision history</td>
<td>Explain how the chat changed and provide safe operation-level undo or redo.</td>
</tr>
</table>
# Lens specifications
## Info lens
**Stable ID:** `info`  
**Icon:** Lucide `Info` — a circled information mark; neutral resource identity.  
**Outcome:** Answer what this chat is, how it is configured, and whether it is healthy.
### Default composition
```plain text
[CHAT TITLE · double-click to rename]
Created / last updated / creator / active collaborators
Turns | Branches | Active path | Attachments
Default mode | Default persona | Pinned resource
Revision / response jobs / sync status
```
### Displays
- Title, creator, created time, relative last update, lifecycle, revision, and sync/connection state.
- Counts for total turns, visible turns on the active path, branch points, hidden subtrees, attachments, context references, citations, and active response jobs.
- Default Ask/Plan/Action mode, default persona, optional pinned resource, and active-leaf turn.
- Health summary for running, failed, cancelled, stale, or unresolved responses; each count links to the relevant turn or filtered lens.
### Actions
- Rename the chat through `rename_chat`.
- Change default mode, default persona, pinned resource, or active leaf through the corresponding typed operations.
- Open the pinned resource, copy the stable chat link, or filter to failed/running responses.
### Behavior and states
- Counts are derived from the current logical revision and update live after accepted ChangeSets.
- A running response is a compact status row, not an animated global spinner.
- Missing persona or pinned-resource access is explicit and links to repair.
**Boundary:** Per-turn mode, persona, prompt, and response editing belongs to the turn inspector or composer; Info controls only chat-level defaults.
## Search lens
**Stable ID:** `search`  
**Icon:** Lucide `Search` — a magnifying glass; the standard rescue path.  
**Outcome:** Find prompt, response, citation, attachment, or task content across the conversation.
### Default composition
```plain text
[Search this chat…] [filters]
Scope: active path / all branches
Content: prompts / responses / citations / files / tasks
N matches
Turn · author · mode · status · contextual excerpt
```
### Displays
- Results grouped by turn and branch path with author, timestamp, Ask/Plan/Action mode, response status, and a context excerpt.
- Filters for active path versus all branches, prompt versus response, persona, mode, author, response state, attachments, citations, case, whole word, and date.
- A branch breadcrumb so a result outside the active path never appears spatially ambiguous.
### Actions
- Navigate to and focus the exact stable text anchor, citation, attachment, or task reference.
- Set the result’s leaf as active only through an explicit secondary action; search never silently changes the visible branch.
- Copy a result link or open its cited source.
### Behavior and states
- Index freshness and searched revision are visible when results lag canonical state.
- No-result copy distinguishes no match from an unindexed or inaccessible branch.
- Chat-wide replace is intentionally absent; editing a historical prompt or response requires the turn-specific editing/fork workflow.
**Boundary:** Search is retrieval and navigation. It does not bulk-rewrite conversation history.
## Prompts lens
**Icon:** `MessageSquareText`
### Default composition
```plain text
Prompts
[ Search prompts…                         ]

Recommended
  Explain the selected resource      [Use]
  Compare two revisions              [Use]

All prompts
  Name · version · owner · tags
  Ask / Plan / Action · variables · context needs
```
### Displays
- Named, versioned reusable prompt assets with rich prompt content, description, tags, owner, and updated time.
- Declared variables with types, defaults, required state, and human-readable substitution previews.
- Recommended Ask, Plan, or Action mode; recommended personas; required context or attachments; and web-use preference.
- Provenance for prompts loaded into the current composer: source prompt ID, version, and whether the editable draft has diverged.
- Search and filters for name, tags, owner, mode, persona, and required input type.
### Actions
- **Use prompt** loads an editable draft into the composer. It never submits a turn and never appends history by itself.
- Resolve variables in a preview before loading; required unresolved variables block insertion with a local explanation.
- Save the current composer draft or a historical user prompt as a new reusable prompt, subject to library permissions.
- Open the prompt asset, copy it, or choose a specific version.
- Remove prompt attribution from the composer without deleting the draft text.
### Behavior and states
- The composer shows a removable source/version badge after a prompt is loaded. Editing the draft never edits the source asset.
- A newer source version may be advertised, but it never silently overwrites an in-progress draft.
- Loading a second prompt asks whether to replace the draft, append it, or cancel when the composer is non-empty.
- The Prompt Library owns prompt metadata, versions, variables, and permissions. Chat persists only the submitted prompt snapshot plus optional source attribution.
- Prompt assets are not Chat turns, personas, context resources, or agent tasks. Those concepts remain separate even when a prompt recommends them.
- Empty state: explain how to save a prompt and show templates permitted for the project; do not invent generic examples when the library is unavailable.
## Threads lens
**Stable ID:** `threads`  
**Icon:** Lucide `GitFork` — a branching fork; conversation topology.  
**Outcome:** Make the turn tree, active path, forks, and hidden subtrees understandable and navigable.
### Default composition
```plain text
[Active path summary] [New fork]
▾ Root turn · Ask · complete
  ├─ Turn · Plan · complete
  │  └─ Active leaf
  └─ Alternate branch · hidden
[Show hidden subtrees]
```
### Displays
- A virtualized turn tree using stable `TurnID` and `ParentTurnID`, with compact prompt labels, mode, persona avatar/initials, response state, and branch counts.
- The active path is visually continuous; sibling branches remain visible but quieter. Hidden/redacted nodes retain structural identity and audit labels.
- Branch breadcrumbs, descendant counts, and indicators for pending/running/error responses.
### Actions
- Navigate to a turn; explicitly set an eligible turn as the active leaf; fork from a turn; retry from a turn; hide or reveal a subtree where permitted.
- Open the turn inspector for prompt/response details or copy a deep link.
- Expand/collapse branch groups without changing the canonical active leaf.
### Behavior and states
- Concurrent sibling turns render deterministically; neither is treated as lost.
- Redacted turns show tombstone copy and keep descendants reachable.
- A stale active-leaf command preserves the intended target and offers refresh/retry rather than guessing.
**Boundary:** The tree manipulates topology and presentation lifecycle. It does not delete a turn with descendants or reverse external side effects.
## Context lens
**Stable ID:** `context`  
**Icon:** Lucide `LibraryBig` — a compact library; input resources surrounding the conversation.  
**Outcome:** Show exactly what resources and files informed prompts on the active path.
### Default composition
```plain text
Pinned resource
Current turn context
Inherited active-path context
Attachments
Resource · selector · captured revision · access/freshness
```
### Displays
- Pinned resource, prompt `ContextRef` entries, attachments, selectors, captured revisions, file metadata, and the turns that introduced them.
- Groups for current turn, inherited active-path context, and context found only on alternate branches.
- Fresh, changed-since-capture, missing, unauthorized, and deleted-source states without silently substituting current content.
### Actions
- Open the referenced resource at its selector and captured or current revision; compare captured versus current when available.
- Set or clear the chat-level pinned resource.
- Copy a reference, reveal every turn that uses it, or prepare it for the next prompt composer.
### Behavior and states
- Removing context from a submitted prompt is a canonical historical edit and follows its prompt-edit/fork constraints.
- Inaccessible resources preserve a non-sensitive tombstone and do not leak titles or excerpts.
- Attachments remain File-owned; the panel shows stable references and ownership state.
**Boundary:** This lens maps input context. Output claims and supporting citations live in Evidence.
## Evidence lens
**Stable ID:** `evidence`  
**Icon:** Lucide `BookOpenCheck` — an open book with a check; supported response output.  
**Outcome:** Audit citations and evidence supporting responses without crowding the chat stream.
### Default composition
```plain text
Coverage summary · active path
Response / turn
Claim excerpt
Citation label → resource selector @ revision
Missing / invalidated / changed source
```
### Displays
- Citations, evidence references, supported response ranges, source resource/selector/revision, and coverage grouped by response.
- Indicators for valid, transformed, invalidated, missing, unauthorized, or changed-since-capture evidence.
- Task evidence for Plan/Action responses, including task status and result summary when present.
### Actions
- Navigate to the supported response range; open the source at its selector; compare captured and current source; copy citation.
- Filter to unsupported, invalidated, stale, or task-backed responses.
- Open the related AI task without moving task execution into Chat.
### Behavior and states
- Response text edits transform or invalidate anchors in the same accepted ChangeSet; dangling citations never appear valid.
- Unavailable evidence reports what is unavailable without exposing protected content.
- Coverage is a diagnostic projection, never a universal truth score.
**Boundary:** Evidence is inspectable provenance. Citation authoring and text editing remain selection-specific operations.
## Personas lens
**Stable ID:** `personas`  
**Icon:** Lucide `Users` — two people; behavioral identities used across turns.  
**Outcome:** Explain the chat default persona and the immutable persona snapshot used by each turn.
### Default composition
```plain text
Default persona [change]
Ask | Plan | Action usage
Persona roster used in this chat
Persona · turns · last used
Open persona / filter turns
```
### Displays
- Current default persona, available project personas, per-persona turn counts, last-used time, and Ask/Plan/Action distribution.
- Historical turn snapshots remain distinct from the current persona definition and are labelled as snapshots.
- Unavailable or retired personas remain attributable on historical turns.
### Actions
- Set the default persona for future turns; open a persona; filter the conversation to turns using a persona; start a new turn with an explicit persona.
- Compare a historical snapshot with the persona’s current definition when policy permits.
### Behavior and states
- Changing the default never reinterprets earlier turns.
- A missing default presents a repair action while preserving historical attribution.
- Permission-filtered personas are excluded from selection but retained as protected historical references.
**Boundary:** Persona editing belongs to the Persona resource surface. This lens selects defaults and explains usage.
## AI Tasks lens
**Stable ID:** `ai-tasks`  
**Icon:** Lucide `ListTodo` — a checklist; durable agent work associated with the chat.  
**Outcome:** Track agentic work launched from Plan or Action turns.
### Default composition
```plain text
[New task from chat]
Active | All
Task title · status · persona
Origin turn · scope · approvals
Result / failure / last update
```
### Displays
- Tasks linked by `TaskID`, originating turn, mode, persona, scope, approval state, execution status, concise result, and timestamps.
- Active, awaiting approval, completed, failed, and cancelled filters.
- A clear distinction between proposed work, approved work, completed external effects, and conversational summaries.
### Actions
- Create a task with chat/turn scope, open task details, navigate to the origin turn, review approvals, or open results.
- Retry only through Agent’s task contract; never by editing Chat state.
- Copy task link or filter the thread to task-bearing turns.
### Behavior and states
- Poll or subscribe only while tasks are active; completed rows remain still.
- Chat undo never implies external compensation. The panel explicitly offers a new compensating task when appropriate.
- Task-service failures preserve the Chat response and show retryable task metadata.
**Boundary:** Agent owns execution, tools, approvals, logs, and side effects; Chat stores references and durable summaries.
## History lens
**Stable ID:** `history`  
**Icon:** Lucide `Clock` — a clock face; append-only revision history.  
**Outcome:** Explain how the chat changed and provide safe operation-level undo or redo.
### Default composition
```plain text
Filters: actor / area / branch / date
Revision · actor · action · target
Summary
Open before/after detail
Undo / redo eligibility
```
### Displays
- Accepted ChangeSets with revision, actor, timestamp, operation summary, affected turns/branches, and undo/redo eligibility.
- Before/after detail for title/defaults, active leaf, prompt/response text, context, citation, redaction, and subtree visibility changes.
- System-authored response lifecycle operations are distinguishable from user or agent edits.
### Actions
- Open exact change detail; navigate to affected turn; append an inverse or reapply operation when valid; copy revision link.
- Filter by actor, turn, branch, operation area, or time.
### Behavior and states
- Pruned detail is reported as unavailable while the durable summary remains.
- Undo conflicts explain which newer footprint overlaps the target.
- External effects referenced by Action turns are never represented as reversed by chat-history undo.
**Boundary:** History never rewrites or deletes accepted history.
# Shared data and command boundary
Every lens reads from a Chat context snapshot and calls typed actions. It does not import editor internals, mutate stores directly, or write persistence records.
# Implementation registry
```typescript
import { Info, Search, MessageSquareText, GitFork, LibraryBig, BookOpenCheck, Users, ListTodo, Clock } from '@lucide/svelte';

export const chatContextSections: PanelSection[] = [
  { id: 'info', label: 'Info', icon: Info, content: ChatInfoPanel },
  { id: 'search', label: 'Search', icon: Search, content: ChatSearchPanel },
  { id: 'prompts', label: 'Prompts', icon: MessageSquareText, content: ChatPromptsPanel },
  { id: 'threads', label: 'Threads', icon: GitFork, content: ChatThreadsPanel },
  { id: 'context', label: 'Context', icon: LibraryBig, content: ChatContextPanel },
  { id: 'evidence', label: 'Evidence', icon: BookOpenCheck, content: ChatEvidencePanel },
  { id: 'personas', label: 'Personas', icon: Users, content: ChatPersonasPanel },
  { id: 'ai-tasks', label: 'AI Tasks', icon: ListTodo, content: ChatAiTasksPanel },
  { id: 'history', label: 'History', icon: Clock, content: ChatHistoryPanel }
];
```
Rules:
- Every command includes project scope, resource ID, expected revision, stable target IDs, actor, and an idempotent submission ID.
- Navigation-only actions may stay client-side; canonical edits use the resource capability’s ChangeSet path.
- Loading, stale, derived, estimated, local-only, and failed data are labeled honestly. A locally interactive control cannot imply persistence that Omega does not implement.
- A lens may optimistically update only when it can reconcile the accepted revision or restore the prior projection on rejection.
- Search results, prompts, references, comments, tasks, and history paginate or virtualize rather than growing the rail without bound.
- Prompt-library reads and writes use the Prompt Library boundary. Loading a prompt into the composer remains local until the user submits a Chat turn.
# Interaction rules
- Opening a resource begins on `info` unless a valid lens ID was restored for that same resource.
- Changing editor selection does not automatically steal the user’s chosen context lens. Selection-aware lenses update their content in place.
- Clicking a search result, structure item, reference, comment, task source, or history target navigates the work surface and keeps the originating lens open.
- Destructive commands require a named target, confirmation proportional to reversibility, and placement at the end of the action group.
- Undo and redo append canonical inverse/reapply operations; they do not rewrite history.
- Live statuses update without global spinners. Preserve readable last-good content while derived work refreshes.
# Loading, empty, error, and permission states
- **Loading:** retain the lens header and controls; use quiet skeleton rows or compact status copy in the content region.
- **Empty:** explain what would appear here and give one primary next action when the user can resolve the empty state.
- **No results:** retain the query and filters, report zero matches, and offer a clear-filters action.
- **Error:** preserve cached or last-good rows when safe, name what failed, and provide retry. Do not replace the whole panel with a generic failure.
- **Offline:** allow navigation over cached data and mark commands that will queue or are unavailable.
- **Read-only:** show the same map and provenance while disabling mutation with a concise permission explanation.
- **Conflict:** keep the user’s draft, show the accepted current state, and offer retry, compare, or reapply when the operation contract permits it.
# Accessibility and keyboard contract
- Each icon button has `aria-label`, `title`, and `aria-pressed`; the content region is labelled by the visible lens heading.
- The icon rail supports Tab plus arrow-key movement without forcing the panel to expand until activation.
- Status is communicated through text and icon in addition to color. Counts use descriptive accessible names.
- Search/result rows, tree nodes, disclosure controls, and reordering controls expose correct roles, expanded/selected state, and keyboard equivalents.
- Navigation moves editor focus to the destination only after announcing it. The user can return to the originating lens without losing query or expansion state.
- At 200% zoom the rail and content remain operable; at 400% the content becomes a single scroll region without horizontal dependence.
- Reduced motion changes transitions, not behavior or spatial organization.
# Required cross-capability dependencies
- Persona supplies available personas and current definitions; Chat stores defaults and per-turn snapshots.
- File and Resource resolution supply attachment and context metadata with project-scope authorization.
- Agent supplies task status, approvals, execution logs, and external-effect truth.
- Search/indexing may accelerate retrieval, but direct canonical reads remain the correctness fallback.
- Formula is optional and is consulted only for inline Formula-backed atoms.
These adapters do not move Persona, File, Resource, Agent, Search, or Formula authority into Chat.
# Deliberate exclusions
- No separate Comments lens in the first Chat specification. Chat is already a conversational surface; response discussion branches from turns. Add meta-comments only if Taurus later establishes comments as a truly universal capability with a distinct collaboration use case.
- No generic Resources lens duplicates Context. Context is the Chat-specific input-resource map.
- No formula/name manager lens appears unless inline Formula use becomes common enough to justify a Chat-specific map.
# Acceptance checklist
- [ ] Every registered lens has the exact stable ID, label, icon, tooltip, open-state heading, implemented content component, and accessible name defined here.
- [ ] Lens order, collapse behavior, width, restoration, and unknown-ID repair match the shared shell contract.
- [ ] Every lens has useful loading, empty, no-results, error, offline, read-only, and permission behavior.
- [ ] Navigation actions focus the correct stable resource target and preserve the open lens.
- [ ] Canonical mutations go through typed operations with expected revision and conflict handling.
- [ ] Mock or locally projected behavior is visibly identified and cannot masquerade as saved capability.
- [ ] Celestial and Night preserve identical layout, iconography, ordering, and motion.
- [ ] Keyboard, screen-reader, forced-color, reduced-motion, 200% zoom, and 400% zoom tests pass.
- [ ] Realistic large-resource fixtures prove pagination or virtualization and do not make the rail jank.
# Sources
## Governing Yesod sources
- <mention-page url="https://app.notion.com/p/3abb6410e50281258d89d5719fa851fc"/>
- <mention-page url="https://app.notion.com/p/e12b6939dbc444698aca18d4162bab10"/>
- <mention-page url="https://app.notion.com/p/39ab6410e50281798739fa3a9e8931ac"/>

