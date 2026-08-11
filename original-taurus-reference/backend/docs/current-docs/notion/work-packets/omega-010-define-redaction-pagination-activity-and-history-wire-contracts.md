---
title: "Work Packet — Ω-010 — Define redaction, pagination, Activity, and History wire contracts"
notion_page_id: "3acb6410e50281ff8cb3c5528c9470f6"
notion_url: "https://app.notion.com/3acb6410e50281ff8cb3c5528c9470f6"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-29 23:54:56Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Work Packet — Ω-010 — Define redaction, pagination, Activity, and History wire contracts

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

<callout icon="📐" color="blue_bg">
	**Frozen-baseline addendum.** Standardize `limit.From` mapping before generic provider/embedding branches, including `knowledge.project_artifact_limit`, source/run byte limits, partial embedding usage, `knowledge.evidence_changed`, and `resource.version_changed`. Resource list/read cursors bind caller, Project, kind, stable ID, projection, immutable version, line position, and policy version; they remain usable beyond the current uncursored 200-source ceiling.
</callout>
## Outcome
Publish and implement one stable wire vocabulary for inaccessible resources,
bounded lists, Activity provenance, and before/after History details. Alpha and
future clients will never infer “restricted” from missing fields, reconstruct
change provenance from timestamps, or receive a cursor that becomes invalid
because authorization filtering happened after pagination.
## As-built evidence
Current endpoints use several implicit behaviors. Direct document denial returns
`403`; collection filtering often drops rows; Alpha prefers an explicit
`redacted` representation in relationship/activity surfaces. Activity persists
`source_kind` and `source_id`, including a uniqueness constraint, but its public
JSON omits them. Document forward operations expose new values, while inverse
operations containing prior text are private persistence state. Alpha currently
matches Activity to change sets by timestamp and walks up to 12 earlier changes
to reconstruct prior text.
Ω-009 makes the internal read decisions authoritative. This packet defines how
those decisions appear on the wire without leaking identity.
## Scope
- Define by-id denial semantics.
- Define omission versus redacted-sentinel rules per collection type.
- Make pagination authorization-safe and bounded.
- Serialize Activity source provenance when visible.
- Add a public History effect projection with safe before/after values.
- Version and document cursor, error, redaction, Activity, and History schemas.
- Update backend guide and transport contract tests.
## Non-goals
- No new Activity event categories for workspace navigation.
- No general audit-log product.
- No exposure of raw `InverseOps`.
- No unbounded “all history” endpoint.
- No frontend lens implementation.
## Wire decisions
Use three distinct cases:
1. **Direct by-id read:** inaccessible is `404 resource.not_found`, preventing
	identifier probing. A write may use the same response.
2. **Primary catalogs/search:** omit inaccessible rows. Fill the requested page
	from the underlying ordered scan before returning; cursor advancement follows
	the scanned boundary, not the visible count.
3. Relationship or semantic history streams where an event/edge exists
	independently of the hidden identity: retain position using an explicit
	sentinel:
```json
{
  "redacted": true,
  "resource": null
}
```
Do not return a stable hidden id, kind, name, access rule, or metadata. Whether
even the event's existence is safe is endpoint-specific; default to dropping it
when the relationship itself is sensitive.
## Representative contracts
```json
{
  "events": [
    {
      "id": "evt_visible",
      "action": "edited",
      "target": {"id":"doc_1","kind":"document","name":"Plan"},
      "source": {"kind":"document.change_set","id":"cs_12"},
      "occurredAt": "2026-07-29T22:38:02Z"
    },
    {
      "id": "evt_opaque",
      "action": "edited",
      "target": {"redacted": true},
      "source": null,
      "occurredAt": "2026-07-29T22:39:02Z"
    }
  ],
  "nextCursor": "opaque"
}
```
```json
{
  "id": "cs_12",
  "effects": [
    {
      "kind": "text_changed",
      "address": {"rowId":"r1","blockId":"b1","atomId":"a1"},
      "before": "Draft",
      "after": "Quarterly outline",
      "beforeAvailable": true
    }
  ]
}
```
History effects are derived public data. When history pruning prevents recovery,
return `beforeAvailable:false` and omit `before`; never use an empty string to
mean “unknown.”
## Likely paths
- `core/endpoint/`
- `core/handlers/activity/activity.go`
- `core/capability/activity/`
- `core/capability/document/service_history.go`
- `core/handlers/document/`
- `core/capability/reference/`
- `core/capability/resource/`
- `core/platform/storage/sqlite/sqlite_activity.go`
- `docs/backend-guide.md`
## Ordered implementation
1. Write a wire-contract document and golden JSON fixtures before code changes.
2. Add a shared public error code and redacted-resource envelope. Keep domain
	authorization results separate from HTTP representation.
3. Convert by-id access denial to non-enumerating `404` consistently.
4. Implement authorization-aware cursor fill loops with a bounded scan multiplier
	and forward progress even when an entire segment is denied.
5. Serialize Activity `sourceKind`/`sourceID` only when the source is visible;
	preserve the existing one-event-per-change-set invariant.
6. Add a History projector that derives semantic effects from forward/inverse
	operations inside the Document capability. Do not serialize private inverse
	operations wholesale.
7. Apply sentinel/drop policy to Activity, references/backlinks, resolved
	Contexts, sessions/presence, notifications, and overview projections.
8. Update Alpha-facing backend guide, contract fixtures, completion matrix,
	companions, and record.
## Security, concurrency, persistence, and observability
Opaque cursors must be signed or store-independent encoded values that cannot be
edited into another Project/query. Bind a cursor to Project, caller-access
revision or conservative scan boundary, endpoint, filter, sort, and limit.
Redaction must happen before request logging and serialization. History
before/after computation uses one coherent document revision snapshot.
Track scan-to-visible ratios and redaction counts to detect pathological pages,
but never label metrics with resource ids or names.
## Tests and gates
- Golden wire fixtures and backward-compatibility assertions.
- Pages containing 0%, 50%, and 100% denied rows; no duplicates or skips among
	allowed rows across cursors.
- Cursor tampering, cross-Project reuse, filter mismatch, and expiry tests.
- Direct denied id returns indistinguishable 404.
- Activity source id maps exactly to the change set without timestamp inference.
- History insert/edit/delete and pruned-history effect tests.
- Redaction snapshots prove no hidden id/name/kind is present in bytes.
- Standard repository gates and Alpha contract smoke test.
## Completion evidence
- Backend guide names one behavior for each endpoint family.
- Alpha no longer performs security redaction or timestamp matching.
- Pagination remains correct under dense denials.
- History renders honest before/after without exposing private compensation data.
## Dependencies
Depends on Ω-009. Blocks Ω-011, Ω-014, Ω-017, Ω-018, and later conversion
workers that report partial imports.
## Sources
- [Alpha access-enforcement request](https://github.com/gccurtis/taurus-alpha/blob/aee846567e77d5bc13b264479fd19d2994babbc0/docs/backend-requests/resource-access-enforcement.md)
- [Alpha change-detail fallback commit](https://github.com/gccurtis/taurus-alpha/commit/90d15f1db678be7fbc2068f12a3701b62786ce0d)
- [Omega Activity storage](https://github.com/gccurtis/taurus-omega/tree/b8ba4aa05974ff21746f14b71acaf09117d38dcf/core/capability/activity)
- [Implementation — Workspace Backend](https://app.notion.com/p/3acb6410e5028138917ff768d9776e8e)

