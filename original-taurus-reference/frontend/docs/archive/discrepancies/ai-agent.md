# Discrepancy — AI Agent workflow is frontend-first

Alpha presents a persistent **AI Agent** with three user-facing intents:

- **Ask** for contextual answers;
- **Action** for direct changes or task handoff;
- **Plan** for a reviewable sequence shown inside the inspector.

An inline accordion carries explicit Document, Current selection, All knowledge,
Linked sources, and Web controls plus attachments. A Current context subview
shows the resolved, searchable item list and supports removing individual items.
Recent chats mix every intent and report only Chat, Running, or Done. Submitting
with no selected chat creates one, while selecting a chat routes subsequent
prompts into it. Plans and tasks appear as artifacts inside that same transcript.
The composer and inspector share
`src/lib/data/ai-agent.ts`, which models these interactions in UI vocabulary
rather than inventing an Omega transport shape.

Omega does not yet expose the conversation, execution, task-routing, plan,
reference, or attachment contracts this experience needs. Alpha therefore keeps
the interactions local and marks the surface **Mock**. Ask responses are canned;
Action does not mutate the resource; its task artifact never runs. Plan creates
local review steps, and accepting it only changes the local chat to Running.
Chat and context choices do not persist; file and folder controls only explain the gap.
Resource names in Current context come from real shell data, but nothing is sent to an agent.

The backend contract needed to close this gap is tracked in
[backend-requests/ai-agent.md](../archive/backend-requests/ai-agent.md).
