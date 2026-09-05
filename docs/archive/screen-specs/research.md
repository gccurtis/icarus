# Research

## Purpose

Research is a specialized, evidence-aware conversation workspace. It keeps the central flow as readable as chat while making the inquiry, durable findings, sources, and tool activity continuously inspectable. A research thread has one explicit job: Discover, answer one Question, or test one Hypothesis.

Research conversation is distinct from the global [Copilot](copilot-bar.md). The Research composer appends messages to the active `ResearchThread`; the Copilot creates persona chat turns or agent tasks that continue across tabs.

## Center surface

### Thread header

The fixed local header contains:

- Thread title.
- Mode badge: Discover, Question, or Hypothesis.
- Required singular anchor when in Question or Hypothesis mode.
- Compact current-draft scope indicator when scoped retrieval is enabled; this is composer/runtime state, not persisted thread metadata.
- New thread action.
- Thread switcher.

Changing into Question or Hypothesis mode cannot be completed without selecting exactly one corresponding object. The header shows the anchored question text or hypothesis statement, not only an ID.

### Conversation stream

- Messages render authored rich blocks, streaming state, actor/persona, timestamp, mentions, and source count.
- Sources are compact citations beneath the part of the response they support.
- Tool calls are summarized beneath their initiating message and collapsed by default unless pending or failed.
- Streaming content remains selectable and inspectable.
- Messages are append-only. Research offers a new thread rather than editing history; the current research model cannot persist branch provenance from a selected message.
- A response message has a visible **Promote to finding** action. Selection can narrow the initial promoted body, but the user reviews the durable result before creation.

### Research composer

- Rich text entry with Enter to send and Shift+Enter for a newline in the composer only.
- Current mode and anchor restated near the field.
- Optional Context button opens the scope panel.
- Explicit resource/source attachments, if supported by the request runtime.
- Stop generation only after the runtime defines how a partial response maps to a durable message state. The current model has no cancelled message state.
- Disabled state with an explanation for viewers or archived projects.

The composer does not masquerade as the Copilot Ask/Plan/Action bar. Research already has a fixed research agent/toolset and an owning thread.

### Promotion review

Choosing Promote to finding temporarily uses the inspector as an editorial form:

1. Title.
2. Durable rich-block body.
3. Copied source cards with exact excerpts.
4. Question links.
5. Hypothesis links, each with Supports, Contradicts, or Neutral bearing.
6. Optional relationship notes.

Save creates the `Finding` and `ResearchLink` rows. Cancel leaves the conversation unchanged. The first version must not call this “Accept finding”: no candidate/accepted/rejected state exists.

Message sources do not convert mechanically to every `FindingSource` variant. Promotion uses these explicit rules:

| Message source | Finding conversion |
| --- | --- |
| URL | URL source, copying title/excerpt and setting `capturedAt` at promotion |
| External-file resource | File source with file ID and available locator/excerpt |
| Document/slides/spreadsheet resource | Resource source with locator; the current variant has no excerpt field |
| Lattice node | Resolve to its underlying source first, then use file or document/slides/spreadsheet conversion |
| Finding, connector, or template resource | No direct variant; omit with confirmation or convert to a truthful manual note until the model grows |
| Promoted research message | Message source referencing thread and generic message ID |

Save is blocked while a selected citation cannot be resolved or the user has not chosen omit/manual treatment. The source model's `FindingSource.messageId` currently names obsolete `researchMessages` instead of the generic `messages` table; correct that before implementing promotion.

## Context panel

| Key | Label | Contents and organization |
| --- | --- | --- |
| `inquiry` | Inquiry | Default. Question tree with status, then hypotheses for the selected/anchored question. Current branch expanded; assessment and confidence visible. Create question, sub-question, or hypothesis. |
| `findings` | Findings | Findings linked to the anchor first, then thread-origin and unattached findings. Thread origin is derived by scanning/indexing nested message sources because Finding has no `researchThreadId`. Filter Supports/Contradicts/Neutral for a hypothesis. Durable findings only. |
| `sources` | Sources | Sources aggregated from thread messages, grouped by URL/project resource/lattice source and then by message. Excerpt is native when present; locator/offset/relevance/density appear only when a retrieval tool result supplies them. |
| `trace` | Tool trace | Calls grouped beneath messages with pending/success/error, duration, tool name, and expandable input/output. Failed/pending groups start expanded. |
| `threads` | Threads | Searchable project research threads grouped by Discover/Question/Hypothesis and recency. Current thread pinned. |
| `context` | Context | Resource Set selector/inline expression, current resolution, source eligibility, and retrieval-scope summary. |

“Sources” is a derived ledger of sources/tool calls already used. It must not present persisted Reviewed/Accepted checkboxes until such a model exists.

## Inspector targets

| Selection | Expanded sections | Collapsed sections |
| --- | --- | --- |
| Thread or nothing | Identity; mode and anchor | Creator/revision/timestamps; latest retrieval manifest or current draft scope, clearly not thread metadata |
| Question | Text; status; parent | Notes; children; linked hypotheses; linked findings; attribution |
| Hypothesis | Statement; assessment; confidence | Rationale; linked questions; evidence by bearing; attribution |
| Finding | Title/body; linked inquiry | Sources; relationship notes; provenance |
| Research link | Endpoints; bearing when applicable | Note; attribution |
| Message | Author/state/body; Promote to finding | Mentions; sources; tool calls; timestamp |
| Source | Title/type; excerpt when present; locator when tool output supplies it | Capture time only for promoted URL findings; source resource; messages/findings using it |
| Tool call | Tool/name and state; input/output | Duration; error; initiating message |
| Promotion draft | Title/body; sources; inquiry links | Relationship notes and provenance explanation |

Hypothesis assessment remains an explicit human judgment; it is never automatically calculated from the count of supporting and contradicting findings.

## Question and hypothesis organization

- Questions form a parent/child tree. Answered children do not automatically answer a parent.
- Question states are Open, Investigating, and Answered.
- Hypothesis states are Untested, Testing, Supported, Refuted, and Inconclusive.
- A finding may link to multiple questions and hypotheses.
- Bearing lives on each finding-to-hypothesis relationship because the same finding can bear differently on different hypotheses.
- Relationships carry no rank. Ordering and relevance displays are view-derived.

## Source and grounding behavior

- Message source cards can point to project resources, URLs, or lattice nodes. Region details are conditional retrieval-tool output, not generic `MessageSource` fields.
- Finding promotion copies excerpts only into variants that support them and shows conversion gaps explicitly.
- Retrieved regions show verbatim text, source offsets/location, relevance, and density when the retrieval tool output supplies them.
- Empty retrieval says that no sufficiently relevant material was found; it does not fill the stream with a low-quality fallback.
- Scoped retrieval inspection can show whether a source was outside scope or was eligible but not reached.
- Stale source/index state remains visible only where a retrieval/lattice projection can support it; it is not a generic MessageSource property.

## Context-model limitation

`ResearchThread` and `Message` currently have no persisted request-level `SetExpression`. The panel can support draft scope selection, and retrieval tool calls can record the resolved scope/manifest used, but reopening a historical composer scope is not guaranteed. Add a turn/request scope field before promising durable per-message context instrumentation.

An absent or empty resolved scope searches the whole lattice under the current retrieval process. The Research scope panel must label the unscoped state as Whole project and must not let a zero-member Context masquerade as “search nothing”; warn/block it until the backend can distinguish explicit empty from absent.

## States

- Streaming, complete, and error are message states.
- Pending, success, and error are tool-call states.
- A failed response keeps its sources and trace inspectable and offers a new-thread/retry action rather than rewriting the failed message.
- If finding promotion hits a revision conflict, preserve the editorial form and reapply after refresh.
- Thread loading and source aggregation may proceed independently; partial source lists identify that they are still collecting.
- “Try again” appends a new prompt/response attempt; it does not rewrite or give retry identity to the failed message. Stop remains gated until a cancelled/partial-response contract is selected.

## Retained tab view state

The `research` state retains active context, pane widths, one typed message/finding/source/tool-call/thread selection, transcript anchor, source query, and panel geometry. Streaming cursors, composer text, and incomplete tool UI remain in the research runtime; composer recovery uses its own explicit draft contract rather than an opaque tab-state field. Reload clears selections whose source message or tool call no longer resolves.

## Model coverage

- [Research threads](../data-models/research/research.md)
- [Questions](../data-models/research/question.md)
- [Hypotheses](../data-models/research/hypothesis.md)
- [Findings](../data-models/research/finding.md)
- [Research links](../data-models/research/research-link.md)
- [Messages, sources, and tool calls](../data-models/core/message.md)
- [Lattice retrieval](../processes/lattice-retrieval.md)
