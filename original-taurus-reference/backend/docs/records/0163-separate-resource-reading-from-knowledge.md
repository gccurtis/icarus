# 0163 — Separate exact Resource reading from Knowledge (Ω-002)

**Baseline SHA:** `50efd18413cc47935033889e51d58e9c828733e2`
**Prerequisite:** Ω-001 (0162-freeze-completion-baseline.md)

## What changed and why

Exact Resource reading is now a caller-aware Resource application service and
Agent tool that reads canonical current content without depending on Knowledge
admission. `resource.list` and `resource.read` are the only model-facing
whole-Resource listing/read tools.

### Problem

`knowledge.list` and `knowledge.read` required an admitted Knowledge source row,
making unindexed resources invisible and unreadable. `knowledge.list` enumerated
lattice sources rather than the authoritative Resource catalog. A caller could
not list or read a resource that was not yet, or could not be, indexed by
Knowledge.

### Solution

New `resource.list` and `resource.read` Agent tools bypass Knowledge entirely.
They resolve resources through the Resource catalog, authorize access, and read
canonical current content from the owning family's origin adapter.

## Files changed

### New files
- `core/capability/resource/reader.go` — `ReadableFamily`, `ExactResourceReader`,
  `ResourceSelector`, `ResourceLocator`, `ExactReadRequest`, `ExactReadResult`,
  `ProjectScope`, `VersionedProjection`, `LineMap`, and typed error variables.
- `core/capability/resource/line_slicer.go` — `LineSlicer` for bounded 1-based
  line slicing, `CountingReader`, `NormalizeNewlines`.
- `core/capability/resource/tool_sources.go` — `ToolSource` wrapping Resources
  to produce `resource.list` and `resource.read` `ToolBinding`s.
- `core/capability/resource/tool_sources_test.go` — Tests for the tool bindings,
  line slicer, error mapping, and scope binding.
- `core/wiring/resource_tools.go` — `resourceToolSource` adapter bridging the
  resource and agent packages.

### Modified files
- `core/capability/resource/resource.go` — Added `ReadableFamily` tracking in
  `Resources`, `Resolve()` (name lookup + ID resolution), `Read()` (exact content
  read), `context` import.
- `core/capability/knowledge/tool_search.go` — Added `ResourceLocator` to
  `searchToolRegion` output so search results can be passed to `resource.read`.
- `core/capability/agent/ask.go` — Added `ResourceToolSource` interface,
  `ResourceScope`, `CallerID` field on `Scope`, `evidenceProducingTools` updated
  to include `resource.read`.
- `core/capability/agent/runner.go` — Updated default tool instructions to
  mention `resource.list` and `resource.read`.
- `core/wiring/chat_engine.go` — Passes `CallerID` through from chat scope to
  agent scope.
- `core/wiring/wiring.go` — Passes `ResourceTools` to Ask engine.

### Tests
- 14 new tests in `core/capability/resource/tool_sources_test.go` covering:
  - `resource.list` enumerates resources and filters by kind/name
  - `resource.read` by ID returns content, version, provenance
  - `resource.read` not-found and ambiguous-name errors
  - Line slicer: basic, empty, no-final-newline, past-end, CRLF normalization
  - Line counting
  - Tool name and schema verification

All existing tests continue to pass with no regressions.

## Architecture and data-model decisions

- **ReadableFamily** extends `resource.Family` with `OpenProjection()`. Families
  that don't support textual projection return `ErrProjectionUnsupported`.
- **ResourceSelector** uses ID first; name lookup is exact, caller-filtered, and
  returns `resource.name_ambiguous` when multiple visible matches exist.
- **Knowledge search** results now carry an optional `ResourceLocator` so the
  model can pass search findings to `resource.read`. The locator identifies the
  *indexed* revision — Knowledge may be stale.
- **Evidence provenance** remains distinct: `knowledge.search` = indexed evidence,
  `resource.read` = direct origin.

## Corrective completion

The first cut declared the ownership boundary but did not connect the registered
production families, populate Knowledge locators, or enforce the complete read
contract. The follow-up completed the packet rather than preserving a partially
working compatibility path:

- Document, File, and Connector adapters now implement `ReadableFamily`.
  Document reads resolve current canonical text, File reads report non-textual
  media honestly, and Connector reads use `ConnectorItemReader.OpenItem` without
  calling `Snapshot`.
- Resource exact-name resolution now uses catalog summaries with merged access
  attributes before ambiguity evaluation; hidden duplicates cannot leak names or
  turn a visible match into ambiguity. Every read reauthorizes immediately before
  origin I/O.
- Resource owns the byte, UTF-8, line, version/hash, truncation, and encrypted
  cursor contract. A cursor is bound to caller, Project, Resource, projection,
  version, and policy; changed content fails with `resource.version_changed`.
- `knowledge.search` now emits a Resource locator plus indexed revision where a
  current family exists. The locator never authorizes the subsequent read.
  Knowledge's model-facing `list`/`read` tools and `SourceReader` were removed;
  it is now search/evidence only.
- Ask, Plan, Action, and chat-attachment guidance use Resource listing/reading.
  Chat attachments expose stable File Resource IDs even when Knowledge did not
  admit them.

The corrective tests cover unindexed Document/File reads, hidden duplicate
names, cursor binding, textual bounds, Knowledge locator output, Agent binding,
and Connector point-read-without-snapshot behavior.

### Corrective file map

- `core/capability/resource/{reader.go,resource.go,line_slicer.go,read_cursor.go,
  tool_sources.go}` and `tool_sources_test.go` centralize scope validation,
  catalog-filtered name resolution, reauthorization, bounded UTF-8 reads,
  encrypted cursors, direct-origin evidence, and their regression coverage.
- `core/capability/connector/{provider.go,sync.go,localfolder.go,httpprovider.go,
  connector.go}` define and use the version-aware `ConnectorItemReader` port.
  Local-folder point reads also resolve symlinks beneath the configured root so a
  model-controlled subpath cannot escape it.
- `core/wiring/{resource_document.go,resource_connector.go,resource_file.go,
  resource_read_test.go,source_origin.go}` supply the concrete current-origin
  projections and prove their observable contract. `wiring.go`, `resource_tools.go`,
  `knowledge_resource_locator.go`, and `attachment_lattice.go` compose those
  families into Ask/Plan/Action and attachment/search flows.
- `core/capability/knowledge/{tool_search.go,regions.go,knowledge.go,line_count.go}`
  retain only indexed-evidence search and locator metadata. The former
  `tool_sources.go` and its tests were removed with the retired whole-source
  Knowledge tools.
- `core/capability/agent/{ask.go,runner.go,workflow.go,attachment_tools.go}` and
  their tests bind the caller-aware Resource tools in every Agent mode and keep
  direct-origin citations distinct from indexed evidence.
- `docs/architecture/capabilities/resources/README.md`,
  `docs/architecture/live-document-walkthrough.md`, and the Ω matrix/import map
  describe the finished ownership boundary and keep the Ω-001 executable
  architecture inventory current.

## Validation

```bash
./scripts/check-format.sh   # All Go files are gofmt-clean
go build ./...              # BUILD OK
go test ./...               # All packages pass, no regressions
```
