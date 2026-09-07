# derived-output

A project-scoped, pull-refreshed answer grounded in the Semantic Overlay.

`createDerivedOutput` stores a prompt and optional `ResourceSet` in `idle`.
`createTemplatedDerivedOutput` instead stores 1–32 named variable prompts, a
text template containing `{{variable}}` placeholders, and an optional example
response. The model returns each named value and its evidence selections;
application code validates the exact variable set, fails closed if any value is
ungrounded, and performs substitution with `renderDerivedTemplate`.
`updateDerivedOutput` changes that definition and marks an existing answer
`stale` without erasing it. It may also replace `lastResponse` with a user edit:
the edit advances the response revision, clears citations that can no longer be
claimed for the edited prose, and becomes continuity context for the next
refresh. `readDerivedOutput` compares citation snapshots to active source
revisions and reports effective staleness without writing every output when one
source changes.

`refreshDerivedOutput` is the only synthesis path. It acquires the row's
`generating` state before its first asynchronous provider call, then gives one
bounded agent a single `retrieve` tool. Retrieval returns exact source spans and
overlapping document/slide locator spans plus application-issued, attempt-local
evidence IDs. Each query consolidates overlapping or exactly adjacent spans
from the same source snapshot before final `topK`. Citation resolution repeats
that consolidation across the agent's selected evidence from all retrieval
calls while preserving every evidence ID and use annotation.

The executable instruction is application-owned in `api/shared/agent-instructions.ts` and
shared with the development reference surface. The intended expanded tool set
keeps its authority boundaries sharp: only `retrieve` queries the Semantic
Overlay; `read_selection` and `read` will read authoritative project resources
directly, and `find_resources` will return navigation metadata without evidence.

The final provider turn must match a strict structured-output schema containing
an `answered`/`insufficient` status, response text, and selected evidence IDs
with use annotations. Application code rejects duplicate or unissued IDs. An
answered result without valid selected evidence publishes only the fixed
insufficiency response, never the model prose.

Selected hits are copied into stored-by-value citations, then their source
revisions are compared with active source rows. A mismatch discards the entire
attempt and retries from current retrieval; bounded repeated churn records an
error while preserving the previous response. An unrelated overlay generation
does not stale a response whose cited sources are unchanged. A negative,
insufficient-evidence result is the exception: because it has no cited source,
it becomes stale when the overlay advances beyond the generation it searched.

`readDerivedOutputValue` is the presentation-facing API. It returns the current
text value and content block, effective state, response revision, named variable
resolutions, and stored citations without exposing consumers to row layout.

The document editor now has the first Prompt Block adapter. The ordinary Block
selector converts an empty line to Prompt and opens its inspector. The inspector
creates and links an idle Derived Output, flushes the document revision,
processes up to 50 pending semantic-sync jobs, and calls
`refreshDerivedOutput`. The published response is copied into normal editable
document text. The document adapter keeps formatting locally by reapplying the
same absolute mark ranges, clipped only when replacement text is shorter; the
Derived Output neither accepts nor returns marks. A small star in the document's
pasteboard gutter opens settings. Editing the text marks it stale and supplies
exact ungrounded continuity on the next refresh; canonical revision and evidence
remain on the Derived Output. The Prompts context rail only lists existing
blocks.

This first product path is deliberately request-bound so its behavior can be
tested end to end. A durable Derived Output refresh queue, selected-text focus,
and placement adapters for decks and other editors remain separate follow-ups.
