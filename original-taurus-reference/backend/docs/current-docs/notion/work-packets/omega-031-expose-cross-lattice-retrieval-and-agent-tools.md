---
title: "Work Packet — Ω-031 — Expose cross-lattice retrieval and Agent tools"
notion_page_id: "3adb6410e5028192a491c1bb4a8d9097"
notion_url: "https://app.notion.com/3adb6410e5028192a491c1bb4a8d9097"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-30 00:09:07Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Work Packet — Ω-031 — Expose cross-lattice retrieval and Agent tools

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

<callout icon="🔎" color="blue_bg">
	**Frozen-baseline ownership correction.** This packet owns cross-lattice **search**, grouping, hydration, and evidence policy. It consumes Ω-002/Ω-015 Resource exact-read ports; it must not re-create canonical Text/Resource read tools inside Knowledge or Retrieval. Text evidence identifies immutable indexed generation/revision/hash/window IDs. Structured/Media descriptors remain discovery metadata and their exact handles are independently authorized and version-bound.
</callout>
**Type:** Supporting  
**Wave:** 3 — Complete ingestion, retrieval, and connectors  
**Gate:** Project Backend Complete  
**Depends on:** Ω-009, Ω-014, Ω-019, Ω-028–Ω-030  
**Unblocks:** complete grounded Agent/Chat/Prompt workflows
## Outcome
Agents and supported clients can search Text, Structured Data, and Media through
one caller-aware application coordinator while each lattice performs its own
embedding, descent, score interpretation, result hydration, and authorization.
Text results return exact cited regions. Structured and Media results return
descriptors plus opaque handles, followed by explicit exact-artifact read/open
tools.
Raw similarity scores from different vector spaces are never compared.
## Current evidence
Knowledge retrieval accepts Project ID but not caller identity and is exposed
mostly through internal Agent/Chat/Prompt adapters and `/dev/knowledge`.
Structured/Media do not yet exist at baseline. Existing Agent document access
has a narrower Resource authorization adapter, but Knowledge evidence hydration
is caller-blind until Ω-009.
## Before and after
```plain text
core/application/retrieval/
  coordinator.go policy.go grouping.go pagination.go evidence.go errors.go
core/wiring/retrieval_tools.go
core/handlers/retrieval/

RetrievalCoordinator
  ├── TextSearchPort
  ├── StructuredSearchPort + StructuredReadPort
  └── MediaSearchPort + MediaOpenPort
```
## Scope
- Caller-aware typed search APIs and Agent tools.
- Parallel independent lattice retrieval under one overall budget.
- Grouped results and optional ordinal rank fusion.
- Exact Structured read and Media open operations.
- Stable evidence/citation/provenance envelopes.
- Context/source filters, pagination, budgets, redaction, telemetry.
## Non-goals
- No joint vector space or direct image-vector search.
- No descriptor-only grounding for table values or visual claims.
- No arbitrary SQL over structured artifacts.
- No media editing, audio/video, or public unauthenticated search.
- No user-level cross-Project search in V1.
## Governing invariants
1. Trusted Project/caller/role enter through execution context, never tool
	arguments.
2. Each lattice embeds and ranks within its own declared vector identity.
3. Cross-lattice output is grouped, or fused by rank position with a documented
	algorithm such as RRF; raw cosine/distance values are never compared.
4. Every candidate is authorized before inclusion and every artifact is
	re-authorized before hydration.
5. Text evidence returns literal text and locators.
6. Structured/Media descriptors are clearly labeled generated discovery
	metadata.
7. A grounded structured claim requires `read_structured_artifact`; a grounded
	visual claim requires `open_media_artifact`.
8. Pagination cursors bind Project, caller-access policy version, filters,
	lattice generation, and sort mode.
9. Revocation between search and read blocks hydration.
10. Budgets cap query bytes, lattices, candidates, hydrated bytes, tool calls,
	duration, and provider usage.
## Typed API
```go
type SearchRequest struct {
    Query   string
    Kinds   []LatticeKind
    Filters RetrievalFilters
    Limits  RetrievalLimits
    Cursor  string
}

type SearchResponse struct {
    Text       []TextMatch
    Structured []StructuredMatch
    Media      []MediaMatch
    NextCursor string
    Generations map[LatticeKind]int64
}

type StructuredMatch struct {
    Handle      string
    Descriptor  StructuredDescriptorSummary
    Source      SourceCitation
    Rank        int
    ScoreWithinLattice float32
}
```
Recommended Agent functions:
```plain text
search_text(query, filters, limit)
search_structured_data(query, filters, limit)
read_structured_artifact(handle, rows, columns)
search_media(query, filters, limit)
open_media_artifact(handle)
search_project_sources(query, kinds, filters, per_kind_limit)
```
`search_project_sources` returns groups. If a compact mixed list is needed,
Reciprocal Rank Fusion uses only ordinal ranks:
```plain text
rrf(item) = Σ 1 / (k + rank_in_lattice)
```
The response still identifies the source lattice and descriptor/evidence class.
## HTTP surface
```javascript
POST /retrieval/search
POST /retrieval/text
POST /retrieval/structured
POST /retrieval/media
GET  /retrieval/structured/:handle
GET  /retrieval/media/:handle
```
Handles are signed/opaque, short-lived or revision-bound references—not raw
storage keys.
## Ordered implementation tasks
1. Freeze request/result/evidence/handle/cursor/budget/error schemas.
2. Implement caller-aware Text port after Ω-009 and conformance tests.
3. Add Structured and Media search/hydration ports.
4. Implement parallel coordinator with cancellation and per-lattice budgets.
5. Add grouped results and optional RRF; prohibit raw cross-score sort in code
	review/static tests.
6. Add opaque handle signing/validation, exact reads, authorization, redaction,
	pagination, and stale-generation behavior.
7. Register Agent/Chat/Prompt tools through wiring and enforce tool budgets.
8. Add transport, telemetry, negative-security, load, grounded-response, and live
	E2E tests.
## Security, concurrency, jobs, and observability
- Search filters are intersected with caller access; they never broaden it.
- Undisclosing errors prevent existence leaks for inaccessible sources.
- Hydration enforces row/image byte limits and safe content disposition.
- Query embedding can run concurrently by lattice under an overall semaphore;
	one lattice failure yields typed partial status only when policy permits.
- Retrieval is normally inline and bounded; it is not a durable job. Agent Runs
	persist the chosen evidence snapshot.
- Emit latency/candidates/hydration bytes per lattice, filtered result count,
	generation, embedding usage/cost, partial/failure code, tool sequence, and
	revocation blocks. Never log query/source content by default.
## Verification
- Independent-lattice ranking and explicit test that raw scores cannot drive
	mixed order.
- Authorization at candidate and hydration, including mid-flow revocation.
- Descriptor result cannot be serialized as literal evidence.
- Cursor tamper/staleness/access-policy change.
- Prompt-injection content cannot alter trusted tool scope.
- Load and cancellation across three concurrent searches.
- Agent E2E: search descriptor, read exact table; search image, open image; cite
	text region; produce a response whose evidence chain is auditable.
## Migration and rollback
Add coordinator and tools beside current Knowledge adapters, then switch Agent,
Chat, and Prompt consumers one at a time. Keep old internal Text tool only until
parity and authorization are proven. Rollback restores caller-aware Text-only
retrieval; Structured/Media data remains independently persisted.
## Completion evidence
- Conformance and negative-security matrices are green for all ports.
- Mixed-search tests prove no cross-vector comparison.
- Grounding E2E demonstrates descriptor → exact artifact two-step use.
- Agent/Chat/Prompt live suites use only the new coordinator.
## Sources
- Taurus Yesod Design — Multi-lattice ingestion
- Model — Structured Data capability
- Model — Media capability
- `core/capability/knowledge/retrieve.go`
- `core/wiring/agent_*`
- Ω-009 and Ω-028–Ω-030
---

