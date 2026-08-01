# Derived Outputs types and persistence

## Public domain family

All public types originate in [`domain/model.ts`](../domain/model.ts) and are re-exported by [`index.ts`](../index.ts).

### Output and definition

```ts
type DerivedOutputKind = "prompt";

interface DerivedOutput {
  id: string;                       // random 32 lowercase hex characters
  kind: "prompt";
  definition: DerivedOutputDefinition;
  headRevision: number;             // 0 before publication
  freshness: DerivedOutputFreshness;
  createdAt: string;
  updatedAt: string;
}

interface DerivedOutputDefinition {
  prompt: string;
  contextEntries: ContextEntry[];
  stabilisationText: string;
  definitionRevision: number;
}
```

There is no `deletedAt`: output deletion is hard.

### Immutable revision and status

`DerivedOutputRevision` contains output ID, 1-based revision, frozen definition revision, content, evidence array, status, and creation timestamp. Status is `ok`, `insufficient`, or `contradiction`.

### Evidence and spans

```ts
interface DerivedEvidence {
  resourceId: string;
  resourceKind: string;
  resourceRevision?: number;
  span: DerivedTextSpan | DerivedLineSpan;
  sourceId?: string;
  relevanceRank: number;
  contribution: string;
}

interface DerivedTextSpan {
  kind: "characters";
  start: number;
  end: number;
}

interface DerivedLineSpan {
  kind: "lines";
  startLine: number;
  endLine: number;
}
```

`DerivedByteSpan` is a deprecated type alias to `DerivedTextSpan`, not a distinct runtime kind.

### Freshness and references

`DerivedOutputFreshness.state` is `current | stale | refreshing | failed`, with nullable last check, optional stale timestamp, and optional typed diagnostic. `DerivedOutputRef` is the narrow `{outputId, appliedRevision}` shape another capability stores.

### Requests, options, and results

| Type | Shape / semantics |
|---|---|
| `DeclareDerivedOutputRequest` | prompt; optional Context entries and stabilization text |
| `DeclareDerivedOutputOptions` | optional service-only idempotency key |
| `UpdateDefinitionRequest` | complete new definition plus expected definition revision |
| `UpdateDerivedOutputDefinitionOptions` | optional service-only idempotency key |
| `RefreshDerivedOutputOptions` | optional service-only idempotency key |
| `DerivedRefreshResult` | output, optional published revision, `skipped` flag |

Current HTTP mappings do not accept/forward idempotency options; these contracts are used by in-process callers such as authored resource workflows.

### Attempts and change descriptions

`RefreshAttempt` persists a 32-hex attempt ID, output/frozen definition/context digest, optional candidate metadata, settlement/discard data, four token counts, and timestamps. `DerivedOutputChangeOperation` is an exported descriptive union; the current service/store do not use it as a replay log.

## Error family

| Error | Meaning / payload | Current reachability |
|---|---|---|
| `DerivedOutputNotFoundError(outputId)` | Missing output for update/refresh/delete | service and HTTP |
| `DerivedOutputConflictError(outputId)` | Generic exported conflict | mapped by HTTP but not currently raised by service |
| `DerivedOutputIdempotencyConflictError(key)` | Declaration key reused with different request | optional service path; mapped 409 |
| `DerivedOutputRefreshIdempotencyConflictError(key)` | Refresh key reused for another digest/output | optional service path; not explicitly mapped by current endpoint helper |
| `DerivedOutputDefinitionUpdateIdempotencyConflictError(key)` | Definition key divergent/reused | optional service path; not explicitly mapped by current endpoint helper |
| `StaleDefinitionRevisionError(outputId,expected,actual)` | Definition CAS mismatch | service and HTTP 409 |

Other pipeline errors are normally caught by `refresh` and converted to a failed/skipped `DerivedRefreshResult`, not thrown through HTTP.

## Resource and Knowledge scope ports

[`ResourceReader`](../derived-outputs.ts) defines `describeSource`, `list(scope)`, and bounded `read(resourceId,kind,startLine,endLine,scope)`. `ResourceDescriptor` aliases Knowledge's `{sourceId,resourceId,resourceKind,resourceRevision?}`. `ResourceContent` adds text and byte size.

[`KnowledgeScopeManifest`](../../../0-platform/knowledge/types.ts) contains frozen canonical input/resolved entries, trusted descriptors, sorted admissible source IDs, context/scope SHA-256 digests, and resolution time.

## Store command/result types

[`store.ts`](../store.ts) defines:

- declaration/refresh/definition-update claim records;
- `UpdateOutputDefinitionInput` and `updated | not_found | stale` result;
- `SettleRefreshInput`, settlement states `published | definition_changed | head_changed | knowledge_changed | output_deleted`, and result;
- `FailRefreshInput` and `failed` plus discard states;
- Knowledge invalidation generation/count result.

These types make the exact atomic comparison inputs explicit.

## SQLite representation

[`SQLiteDerivedOutputStore`](../sqlite-store.ts) opens `./data/derived-outputs.db` in WAL mode, `synchronous=NORMAL`, 5-second busy timeout, foreign keys enabled, and prefix `do_${sha256(projectId).slice(0,16)}`.

| Table | Durable purpose |
|---|---|
| `_outputs` | Definition, head, freshness, timestamps |
| `_runtime_state` | Singleton Knowledge generation |
| `_declarations` | Declaration idempotency key/digest/output |
| `_refresh_claims` | Refresh key/digest/output and canonical JSON result |
| `_definition_update_claims` | Definition key/digest/output and canonical JSON result |
| `_revisions` | Immutable content/evidence/status history |
| `_refresh_attempts` | Operational frozen inputs, candidate/discard, token usage |

The schema constrains claim key/digest shapes and generation non-negativity but relies substantially on service validation for statuses/revisions/JSON content. Revisions/attempts are explicitly deleted by `deleteOutput`; their tables do not declare output foreign keys.

## Wire representation

HTTP returns domain objects/revisions/results directly as JSON. Idempotent results are serialized to JSON in claim rows and replayed in that canonical JSON shape. Evidence spans persist as JSON. Intelligence structured outputs are validated and converted into domain records before persistence; untrusted model objects are never stored as accepted revisions.
