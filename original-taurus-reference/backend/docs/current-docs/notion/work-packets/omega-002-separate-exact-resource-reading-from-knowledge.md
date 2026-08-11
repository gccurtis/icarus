---
title: "Work Packet — Ω-002 — Separate exact Resource reading from Knowledge"
notion_page_id: "3acb6410e502817e9b48ca0a34cf6729"
notion_url: "https://app.notion.com/3acb6410e502817e9b48ca0a34cf6729"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-29 23:48:42Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Work Packet — Ω-002 — Separate exact Resource reading from Knowledge

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Status:** Queued
> **Wave:** 0 — Stabilize current truth
> **Outcome:** make exact Resource reading a caller-aware Resource application service and Agent tool that reads canonical current content without depending on Knowledge admission.
<callout icon="📖" color="blue_bg">
	**Knowledge finds; Resource reads.** The Text lattice is a semantic index, not the canonical resource store. `knowledge.search` may discover relevant evidence, but listing or reading an exact named resource must resolve through the Resource catalog and read the owning family or source adapter directly.
</callout>
## Frozen baseline
The reviewed baseline is Taurus Omega main at [`50efd18413cc47935033889e51d58e9c828733e2`](https://github.com/gccurtis/taurus-omega/commit/50efd18413cc47935033889e51d58e9c828733e2).
The current implementation is partly correct:
- [`core/capability/knowledge/tool_sources.go`](https://github.com/gccurtis/taurus-omega/blob/50efd18413cc47935033889e51d58e9c828733e2/core/capability/knowledge/tool_sources.go) no longer serves a stale whole-source copy from the lattice. It calls an injected `SourceReader` and slices current origin text into exact one-based line ranges.
- [`core/wiring/source_origin.go`](https://github.com/gccurtis/taurus-omega/blob/50efd18413cc47935033889e51d58e9c828733e2/core/wiring/source_origin.go) dispatches to Document, Attachment/File, or Connector owners.
- The current tool is nevertheless named `knowledge.read`, first requires a matching Knowledge source row, accepts Knowledge `sourceType/sourceId`, and cannot read an unindexed Resource.
- `knowledge.list` lists admitted lattice sources rather than the authoritative Resource catalog. A failed, excluded, not-yet-indexed, binary, or unsupported resource can therefore exist but be invisible to the tool.
- Connector exact reading still snapshots/enumerates the connector before locating one file because the provider lacks an efficient, version-bound point-read contract.
This packet replaces the ownership and contract. It does not undo the useful origin-reading work.
## Scope
- Add caller-aware `resource.list` and `resource.read` application services and Agent tool bindings.
- Resolve a resource by stable Resource ID, or by exact human name plus optional kind. Names are conveniences, never durable identity.
- Read exact current content from the canonical owning family/source, not from a Knowledge source or window.
- Support bounded, one-based exact line reads for textual projections.
- Return a stable locator, content revision/version, content hash, line range, truncation/cursor state, and direct-origin provenance.
- Make Knowledge search results return a `ResourceLocator` that can be passed to `resource.read`.
- Retire `knowledge.list` and `knowledge.read` after compatibility telemetry proves no caller remains.
- Add a point-read port for connector items so one read does not snapshot a whole connection.
- Define honest behavior for Resource families that are structured, media, binary, or not text-projectable.
## Non-goals
- Do not move semantic search out of Knowledge.
- Do not use Resource names as unique database keys.
- Do not promise that Knowledge window offsets still identify the same bytes after the source changes.
- Do not flatten every binary or structured object into misleading text.
- Do not bypass family-specific authorization, revision, or projection rules.
- Do not add arbitrary filesystem paths, object keys, provider URLs, or credentials to a model-callable tool.
## Governing invariants
1. Resource existence and Resource readability do not depend on Knowledge admission.
2. Trusted `UserID`, `ProjectID`, role, and admission enter through execution context, never model-supplied arguments.
3. Resolve and authorize before opening origin bytes. Inaccessible and absent resources use Ω-010 undisclosing semantics.
4. Stable Resource ID is the canonical selector. Name lookup is exact, caller-filtered, and returns `resource.name_ambiguous` when more than one visible match remains.
5. Every read is bound to one current content version. The response identifies that version; optional `expectedVersion` fails with `resource.version_changed`.
6. A read result contains direct-origin content. A Knowledge result contains indexed evidence. The two provenance classes remain distinct.
7. Knowledge locators never authorize a later read. `resource.read` reauthorizes against current policy and current Resource state.
8. Line numbers are one-based, inclusive, and defined only for a named textual projection. Reads have byte, line, duration, and tool-call budgets.
9. A Knowledge result from revision `N` may lead to Resource revision `N+1`. The caller must not reuse stale Knowledge byte/line offsets against the new revision.
10. Connector reads bind provider item identity and version; rename/move does not change identity.
## Target types
```go
type ResourceSelector struct {
    ID   string        `json:"id,omitempty"`
    Name string        `json:"name,omitempty"`
    Kind resource.Kind `json:"kind,omitempty"`
}

type ResourceLocator struct {
    ResourceID string        `json:"resourceId"`
    Kind       resource.Kind `json:"kind"`
    Subpath    string        `json:"subpath,omitempty"`
    Projection string        `json:"projection,omitempty"`
}

type ExactReadRequest struct {
    Selector        ResourceSelector `json:"selector"`
    Subpath         string           `json:"subpath,omitempty"`
    Projection      string           `json:"projection,omitempty"`
    StartLine       int              `json:"startLine,omitempty"`
    EndLine         int              `json:"endLine,omitempty"`
    Cursor          string           `json:"cursor,omitempty"`
    ExpectedVersion string           `json:"expectedVersion,omitempty"`
}

type ExactReadResult struct {
    Resource     ResourceSummary `json:"resource"`
    Locator      ResourceLocator `json:"locator"`
    Version      string          `json:"version"`
    ContentHash  string          `json:"contentHash"`
    Projection   string          `json:"projection"`
    StartLine    int             `json:"startLine"`
    EndLine      int             `json:"endLine"`
    Text         string          `json:"text"`
    Truncated    bool            `json:"truncated"`
    NextCursor   string          `json:"nextCursor,omitempty"`
    Provenance   Provenance      `json:"provenance"`
}
```
The application port is Resource-owned. Families implement only the narrow projection they can support.
```go
type ReadableFamily interface {
    resource.Family
    OpenProjection(
        context.Context,
        ProjectScope,
        ResourceLocator,
        ProjectionRequest,
    ) (VersionedProjection, error)
}

type VersionedProjection struct {
    Version     string
    ContentHash string
    MediaType   string
    Text        io.ReadCloser
    LineMap     LineMap
}

type ExactResourceReader interface {
    Resolve(context.Context, ProjectScope, ResourceSelector) (ResourceLocator, error)
    Read(context.Context, ProjectScope, ExactReadRequest) (ExactReadResult, error)
}
```
Connector infrastructure supplies a point reader rather than a whole-snapshot read:
```go
type ConnectorItemReader interface {
    Open(
        context.Context,
        AuthorizedBinding,
        ProviderItemID,
        VersionID,
    ) (io.ReadCloser, ItemMeta, error)
}
```
## Tool contract
```plain text
resource.list
  input:  kind?, exactName?, cursor?, limit?
  output: caller-visible Resource summaries and stable locators

resource.read
  input:  resourceId OR exact name + optional kind,
          subpath?, projection?, startLine?, endLine?,
          cursor?, expectedVersion?
  output: exact bounded content plus current version and provenance

knowledge.search
  output addition: ResourceLocator + indexed revision/generation
```
The model may perform:
```plain text
knowledge.search("quarterly assumptions")
  → ResourceLocator{resourceId:"...", kind:"spreadsheet", subpath:"Assumptions!A1:H40"}

resource.read(locator, projection:"text", startLine:120, endLine:180)
  → current exact resource text at version "..."
```
The application must explicitly report when the indexed revision and current Resource revision differ.
## Typed failures
```plain text
resource.invalid_selector
resource.not_found
resource.name_ambiguous
resource.access_denied
resource.trashed
resource.projection_unsupported
resource.content_not_textual
resource.version_changed
resource.origin_unavailable
resource.origin_gone
resource.read_limit_exceeded
resource.cursor_invalid
```
Transport maps these through Ω-010. Tool results may explain an unsupported projection without leaking hidden Resource existence.
## Ordered implementation
1. Inventory every use of `knowledge.list`, `knowledge.read`, `SourceReader`, Knowledge `sourceType/sourceId`, and Agent prompt text naming those tools.
2. Add exact-name lookup and readable-family registration to the Resource kernel. Name lookup filters by current caller access before ambiguity is evaluated.
3. Move the origin-reader abstraction and result types from Knowledge ownership to Resource/application ownership. Reuse existing Document/File/Connector adapters in wiring.
4. Add bounded streaming line slicing with a counting reader, UTF-8 validation/normalization policy, cancellation, and content-version checks.
5. Implement `resource.list` and `resource.read` tool bindings closed over trusted `ProjectScope`.
6. Add Resource locators and indexed revision/generation to Knowledge results; prohibit Resource read authorization from trusting them.
7. Implement connector item/version point reads with Ω-032 provider contracts.
8. Update Ask, Plan, Action, Chat attachment, Prompt-block, and cross-lattice tool instructions. An attachment can be listed and read even when it was not admitted to Knowledge, when its Resource projection is supported.
9. Keep temporary compatibility aliases only behind telemetry. Remove the Knowledge membership precondition immediately; remove aliases after all consumers migrate.
10. Update route/tool inventories, architecture docs, companion docs, and the canonical backend demonstration.
## Security, concurrency, and observability
- Authorize before origin I/O and reauthorize after following any external-version reference when provider policy can change.
- Cursors are signed/opaque and bind caller, Project, Resource, projection, version, line position, and limit policy.
- Limit compressed and decoded bytes separately for provider/file projections.
- Never log exact content, names for inaccessible objects, URLs, object keys, credentials, or signed handles.
- Record bounded metrics for result class, Resource kind, bytes, lines, latency, version conflict, ambiguity, unsupported projection, and origin failure.
- A read is inline and cancellable. Conversion/OCR or expensive rendering is a separate durable job, never hidden inside `resource.read`.
## Verification
- An unindexed caller-visible Document can be resolved by name and read exactly.
- Deleting a Knowledge source does not make its canonical Resource unreadable.
- A Knowledge-only source without a current Resource/origin cannot be fabricated as a readable Resource.
- Duplicate visible names return a typed ambiguity list; a hidden duplicate does not affect or leak into the result.
- Cross-Project, removed-membership, resource-scope, trashed, purged, and mid-read revocation tests fail closed.
- Line-boundary golden tests cover empty files, final newline/no final newline, CRLF, UTF-8, oversized lines, cursors, and truncation.
- Version changes between pages/reads return `resource.version_changed`; no mixed-version response is emitted.
- Connector point-read tests prove no full snapshot is taken and the requested provider item/version is enforced.
- Agent E2E proves search → exact read and direct named read, with correct provenance and citations.
- Static/import tests prove Knowledge no longer owns or exports the exact Resource reader.
## Completion evidence
- `resource.list/read` are the only model-facing whole-Resource listing/read tools.
- A caller can read exact current text without a Knowledge row.
- Every read is authorized, bounded, versioned, and directly traceable to the canonical origin.
- Knowledge remains a search/evidence projection and no longer acts as a Resource registry.
## Dependencies and unlocks
Depends on Ω-001.
Defines the exact-read ownership and port contract that Ω-009 makes fully caller-aware, Ω-010 exposes through stable wire semantics, and Ω-015 adopts as the permanent Resource-family conformance contract.
Unblocks Ω-015, Ω-019, Ω-031, Ω-032, and exact reading for every later Resource family.
## Sources
- [Frozen Omega baseline](https://github.com/gccurtis/taurus-omega/tree/50efd18413cc47935033889e51d58e9c828733e2)
- [Current Knowledge tools](https://github.com/gccurtis/taurus-omega/blob/50efd18413cc47935033889e51d58e9c828733e2/core/capability/knowledge/tool_sources.go)
- [Current origin adapter](https://github.com/gccurtis/taurus-omega/blob/50efd18413cc47935033889e51d58e9c828733e2/core/wiring/source_origin.go)
- [Current Resource catalog](https://github.com/gccurtis/taurus-omega/blob/50efd18413cc47935033889e51d58e9c828733e2/core/capability/resource/resource.go)

