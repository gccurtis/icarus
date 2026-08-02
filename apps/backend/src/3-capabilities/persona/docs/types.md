# Persona types and persistence

The public surface is exported by [`index.ts`](../index.ts).

## `PersonaSectionName`

```ts
const PERSONA_SECTION_NAMES = [
  "focus", "background", "approach", "outputPreferences", "verification"
] as const;
type PersonaSectionName = (typeof PERSONA_SECTION_NAMES)[number];
```

That array is the single source of render order. The renderer and the wire decoder both
read it, so a section cannot be added in one place and forgotten in the other.

## `PersonaDefinition`

```ts
interface PersonaDefinition {
  readonly focus: string;
  readonly background: string;
  readonly approach: string;
  readonly outputPreferences: string;
  readonly verification: string;
  readonly context?: ContextEntry;
}
```

Sections are always present as strings, empty when unset — the store's columns are
`NOT NULL DEFAULT ''`, so a round trip never yields `undefined`. Bodies are trimmed at
ingress, so trailing whitespace never changes a digest.

`ContextEntry` is `{ id, kind }`, owned by Knowledge and re-exported through Context.
Persona imports it from `#context`, keeping the ownership story readable at call sites.

## `PersonaRecord`

```ts
interface PersonaRecord {
  readonly id: string;
  readonly displayName: string;
  readonly description: string;
  readonly definition: PersonaDefinition;
  readonly contextWrapperId?: string;
  readonly contextWrapperRevision?: number;
  readonly revision: number;
  readonly definitionDigest: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt?: string;
}
```

| Field | Behaviour |
|---|---|
| `id` | Random UUID, immutable, and the basis of the wrapper's name |
| `displayName` | Unique among live records, case-insensitive; trimmed at ingress |
| `description` | Catalog blurb. **Excluded from both the render and the digest.** |
| `contextWrapperId` / `contextWrapperRevision` | Present iff `definition.context` is present. Internal bookkeeping; never returned in place of `definition.context`. |
| `revision` | Monotone, starts at 1, increments on every accepted update |
| `definitionDigest` | sha256 over the canonical definition — see below |
| `deletedAt` | Soft delete; frees the display name immediately |

`description`'s exclusion from the digest is deliberate: editing a blurb bumps `revision`
but leaves `definitionDigest` unchanged, so the digest keeps answering exactly one
question — *did the behaviour change?*

## `PersonaSnapshot`

```ts
interface PersonaSnapshot {
  readonly personaId: string;        // "builtin:default" for the fallback
  readonly displayName: string;
  readonly revision: number;         // 0 for the built-in
  readonly definition: PersonaDefinition;
  readonly sections: readonly PersonaSectionName[];
  readonly prompt: string;
  readonly context?: ContextEntry;   // the private wrapper, not the authored entry
  readonly definitionDigest: string;
  readonly promptDigest: string;
  readonly frozenAt: string;
}
```

The snapshot carries the **rendered prompt string**, not only the definition. This is
redundant data bought on purpose: a pinned task becomes replayable without Persona in the
loop at all, even if the renderer changes later. The task holds a string, not a promise
that a pure function will keep behaving.

`sections` lists what actually appeared — selected *and* non-empty — in render order.

### Two digests, each answering one question

| Digest | Covers | Stable across |
|---|---|---|
| `definitionDigest` | the five sections + the authored context ref | section selection, renames, description edits |
| `promptDigest` | the exact rendered bytes | nothing — it varies with section selection |

`definitionDigest` deliberately excludes `contextWrapperId`, which is Persona's own
bookkeeping and would otherwise make two behaviourally identical personas digest
differently.

## Commands and queries

```ts
type PersonaCommand =
  | { type: "persona.create"; input: CreatePersonaInput }
  | { type: "persona.update"; input: UpdatePersonaInput }
  | { type: "persona.delete"; input: DeletePersonaInput };

type PersonaQuery =
  | { type: "persona.get";       id: string }
  | { type: "persona.getByName"; displayName: string }
  | { type: "persona.list" }
  | { type: "persona.render";    definition: PersonaDefinition;
                                 sections?: readonly PersonaSectionName[] };
```

`UpdatePersonaInput` carries `expectedRevision` and optional `displayName`,
`description`, and `definition`. **A definition is replaced wholesale, never
field-patched** — sections are free text with no merge semantics, so a partial update
would only invite a caller to guess at how two prose fragments combine.

Both dispatchers are total switches with no `default` clause, so adding a variant is a
compile error until it is handled.

## Errors

| Error | Payload | Raised by | HTTP |
|---|---|---|---|
| `PersonaNotFoundError` | `personaId` | get/update/delete/resolve on a missing or deleted id | 404 `persona_not_found` |
| `PersonaConflictError` | `displayName` | create, and rename onto a taken name | 409 `persona_name_conflict` |
| `StalePersonaRevisionError` | `personaId`, `expectedRevision`, `actualRevision` | update/delete revision check | 409 `persona_revision_conflict` |
| `BuiltInPersonaImmutableError` | `personaId` | update/delete targeting `builtin:default` | 409 `persona_builtin_immutable` |
| `PersonaValidationError` | `field`, `reason` | ingress validation | 400 `persona_invalid` |
| `PersonaWireError` | message | wire decoding | 400 `persona_invalid` |

Domain throws typed errors and never mentions a status code; job wiring maps them.
Anything else becomes a 500 with the fixed message `"Persona operation failed"`, with the
real message logged.

## Limits

[`DEFAULT_PERSONA_LIMITS`](../domain/validation.ts), overridable via
`PersonaDependencies.limits`:

| Limit | Default | Applied to |
|---|---:|---|
| `maxSectionChars` | 4,000 | Each section body, after trimming |
| `maxDefinitionChars` | 12,000 | The five sections summed |
| `maxDisplayNameChars` | 120 | Trimmed display name |
| `maxDescriptionChars` | 500 | Description |
| `maxPersonas` | 500 | Live records per project, checked on create |

## Ports

```ts
interface PersonaStore {
  get(id): Promise<PersonaRecord | undefined>;
  getByName(displayName): Promise<PersonaRecord | undefined>;   // case-insensitive, live
  list(): Promise<PersonaRecord[]>;                             // live, name-sorted
  countLive(): Promise<number>;
  insert(record): Promise<void>;
  update(record, expectedRevision): Promise<boolean>;           // false ⇒ stale
  softDelete(id, expectedRevision, deletedAt): Promise<boolean>; // false ⇒ stale
}

interface PersonaContextPort {
  declare(displayName, entries, options?): Promise<{ id, revision }>;
  update(id, entries, expectedRevision): Promise<{ id, revision }>;
  delete(id): Promise<void>;
}
```

`PersonaStore` is `Promise`-returning, matching the other layered capabilities, even
though the SQLite implementation is synchronous underneath.

`PersonaContextPort` is satisfied structurally by `ContextManager`, which has many more
methods. Persona states exactly what it uses — there is deliberately no `get`, `resolve`,
`combine`, or `list` on this port.

## SQLite representation

One table in `./data/personas.db`, prefixed `psn_<sha256(projectId)[0..16]>_personas`.

```sql
CREATE TABLE IF NOT EXISTS psn_${prefix}_personas (
  id                       TEXT    PRIMARY KEY,
  display_name             TEXT    NOT NULL,
  description              TEXT    NOT NULL DEFAULT '',
  focus                    TEXT    NOT NULL DEFAULT '',
  background               TEXT    NOT NULL DEFAULT '',
  approach                 TEXT    NOT NULL DEFAULT '',
  output_preferences       TEXT    NOT NULL DEFAULT '',
  verification             TEXT    NOT NULL DEFAULT '',
  context_json             TEXT,
  context_wrapper_id       TEXT,
  context_wrapper_revision INTEGER,
  definition_digest        TEXT    NOT NULL,
  revision                 INTEGER NOT NULL DEFAULT 1,
  created_at               TEXT    NOT NULL,
  updated_at               TEXT    NOT NULL,
  deleted_at               TEXT,
  CHECK ((context_json IS NULL AND context_wrapper_id IS NULL)
      OR (context_json IS NOT NULL AND context_wrapper_id IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS psn_${prefix}_personas_name_live_nocase
  ON psn_${prefix}_personas(display_name COLLATE NOCASE)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS psn_${prefix}_personas_live
  ON psn_${prefix}_personas(deleted_at, display_name);
```

Sections are columns rather than one definition blob: the schema is fixed and known, so
"which personas mention retrieval" stays a plain query instead of JSON extraction. The
context reference is a single nullable JSON object because it is a two-field value, not a
list.

The `CHECK` makes "a context with no wrapper" unrepresentable — the pairing invariant is
enforced by the database, not only by the service.

The name index is partial on `deleted_at IS NULL`, so a soft delete frees the display
name for immediate reuse.
