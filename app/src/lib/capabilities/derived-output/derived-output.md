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
refresh. The row names exactly one current value arm through `valueSource`:
`none` has no response or provenance, `authored` has a response and revision but
no generated provenance, and `generated` has the response, revision, overlay
generation, refresh time, and optional variable resolutions together. Missing
fields are never interpreted as an older arm. Each real edit advances `definitionRevision`; refresh bookkeeping and
publication never do. `readDerivedOutput` compares citation snapshots to active
source revisions and reports effective staleness without writing every output
when one source changes.

`refreshDerivedOutput` is the only synthesis path and is wholly server-owned.
Every browser signal coalesces into one durable `derivedOutputRefreshJobs` row
keyed by project and Derived Output ID. Concurrent callers join the same server
flight. The job—not the value row—owns `queued`, `running`, and `failed`
operation state. An identical signal changes nothing and simply awaits that
flight. Only a different definition revision or selection advances the request
version and causes one follow-up pass. The worker first discovers every current,
non-staged document, presentation, and spreadsheet in the output's effective scope and
idempotently enqueues its current authoritative revision. It then drains pending
exact-text and material semantic jobs before it asks the freshness gate whether
provider work is necessary. A terminally failed semantic job is quarantined and
reported. It
fails an output whose effective scope contains that resource, including a
resource-owned scope projected from a placed Template, but cannot poison an
unrelated scoped refresh. Reusable named sets are resolved transitively at this
boundary. The worker snapshots project semantic inputs around synthesis; a source
revision, material revision, pending semantic job, or overlay-generation change
causes one bounded retry after another drain. It gives one bounded agent the
sixteen tools in `api/shared/tool-catalog.ts`. `retrieve` returns
exact source spans and overlapping document/slide locator spans plus
application-issued, attempt-local evidence IDs. Each query consolidates
overlapping or exactly adjacent spans
from the same source snapshot before final `topK`. Citation resolution repeats
that consolidation across the agent's selected evidence from all retrieval
calls while preserving every evidence ID and use annotation.

The executable instruction is application-owned in
`api/shared/agent-instructions.ts` and shared with the development reference
surface. Authority boundaries stay explicit: `retrieve` searches exact text;
`retrieve_materials` searches inferred descriptors; `read_selection`,
`read_text`, `read_table`, `read_csv`, `read_chart`, `read_code`, and
`read_image` issue evidence from authoritative content; find/list/inspect/view
tools return orientation without minting evidence.

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

`readDerivedOutput` returns value state (`idle`, `fresh`, `stale`, or `error`)
separately from shared refresh status (`idle`, `queued`, `running`, or `failed`).
The last published value therefore remains readable while its replacement runs.
`readDerivedOutputValue` is the presentation-facing API. It returns the current
text value and content block, both state projections, response revision, named
variable resolutions, and stored citations without exposing consumers to row
layout.

The document editor now has the first Prompt Block adapter. The ordinary Block
selector converts an empty line to Prompt and opens its inspector. The inspector
creates and links an idle Derived Output, flushes the document revision, and
signals `refreshDerivedOutput`; semantic preparation and synthesis stay behind
that server boundary. The published response is copied into normal editable
document text. The document adapter keeps formatting locally by reapplying the
same absolute mark ranges, clipped only when replacement text is shorter; the
Derived Output neither accepts nor returns marks. A small star in the document's
pasteboard gutter opens settings. Editing the text marks it stale and supplies
exact ungrounded continuity on the next refresh; canonical revision and evidence
remain on the Derived Output. The Prompts context rail only lists existing
blocks.

The durable job is also the recovery record if a request or browser disappears.
The document inspector polls this server projection (more frequently while a
job is active), disables duplicate refresh interaction, and uses its local flag
only to bridge the initiating request before the first poll. A later push or
subscription transport can replace polling without changing the capability
contract.
The durable job row and claim token are the authority boundary; the shared
promise that joins callers belongs to `ServerModel.operationFlights`, not this
capability or `globalThis`. Server shutdown aborts those active provider calls
with a typed process-owned reason. That signal crosses queue preparation, both
retrieval lanes, exact resource reads, native material reads, and every model
tool boundary. The worker atomically returns its durable refresh row to `queued`,
restores the pre-claim attempt count, and leaves the output value untouched
before shutdown finishes draining. A fresh `ServerModel` then reclaims the same
request. Ordinary provider and user-facing failures remain terminal and visible;
they cannot impersonate process shutdown merely by using `AbortError` text.
The JSON-backed Store serializes claims inside one server instance; a
multi-process database adapter must preserve the same transactional claim and
lease contract. An always-on worker host and additional editor placement
adapters remain separate follow-ups.
