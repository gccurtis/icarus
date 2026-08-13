# Document Persistence and Transactions

## Tables

Document owns five normalized tables. Rich Content continues to own
`rich_content`.

### `documents`

| Column | Type | Purpose |
| ------ | ---- | ------- |
| `id` | `text` primary key | Stable Document identity. |
| `revision` | `integer` | Current Document structural version. |
| `title` | `text` | Plain title. |
| `page_settings` | `jsonb` | Current validated page dimensions and margins. |
| `created_at` | `timestamptz` | Creation time. |
| `updated_at` | `timestamptz` | Latest structural mutation. |

Character metrics, alignment, and line spacing are not stored here. Character
metrics derive from resolved font size; relational styling is Block-scoped.

### `document_rich_content_styles`

| Column | Type | Purpose |
| ------ | ---- | ------- |
| `document_id` | `text` | Owning Document. |
| `id` | `text` | Rich Content library Style identity. |
| `name` | `text` | Human-readable name. |
| `based_on_style_id` | `text` nullable | Same-family parent. |
| `properties` | `jsonb` | Validated Block-wide Rich Content characteristics. |

### `document_block_styles`

| Column | Type | Purpose |
| ------ | ---- | ------- |
| `document_id` | `text` | Owning Document. |
| `id` | `text` | Document Block library Style identity. |
| `name` | `text` | Human-readable name. |
| `based_on_style_id` | `text` nullable | Same-family parent. |
| `properties` | `jsonb` | Validated relational layout properties. |

Separate tables make cross-family inheritance impossible at the storage
boundary.

### `document_rows`

| Column | Type | Purpose |
| ------ | ---- | ------- |
| `document_id` | `text` | Owning Document. |
| `id` | `text` | Stable Row identity. |
| `ordinal` | `integer` | Dense zero-based Row order. |

### `document_blocks`

| Column | Type | Purpose |
| ------ | ---- | ------- |
| `document_id` | `text` | Owning Document. |
| `row_id` | `text` | Owning Row. |
| `id` | `text` | Stable Block identity. |
| `ordinal` | `integer` | Dense zero-based order within Row. |
| `kind` | `text` | `rich-content`, `horizontal-rule`, or `page-break`. |
| `content_id` | `text` nullable | Exclusively owned Rich Content object. |
| `rich_content_style_id` | `text` nullable | Optional Rich Content library reference. |
| `rich_content_style_properties` | `jsonb` nullable | Ad hoc Rich Content properties. |
| `document_style_id` | `text` nullable | Optional Document Block library reference. |
| `document_style_properties` | `jsonb` nullable | Ad hoc relational properties. |
| `width_units` | `integer` | Owning Row's normalized track for this Block. |
| `structural_presentation` | `jsonb` nullable | Horizontal Rule presentation only. |

Ad hoc property columns use empty JSON objects rather than `null` for a Rich
Content Block. Library IDs remain nullable because an application can be fully
ad hoc.

## Keys and Constraints

```text
both Style Library tables
  primary key (document_id, id)
  foreign key document_id → documents.id ON DELETE CASCADE
  foreign key (document_id, based_on_style_id) → same table

document_rows
  primary key (document_id, id)
  unique (document_id, ordinal)
  foreign key document_id → documents.id ON DELETE CASCADE

document_blocks
  primary key (document_id, id)
  unique content_id
  unique (document_id, row_id, ordinal)
  foreign key (document_id, row_id) → document_rows ON DELETE CASCADE
  foreign key (document_id, rich_content_style_id)
    → document_rich_content_styles
  foreign key (document_id, document_style_id)
    → document_block_styles
  foreign key content_id → rich_content.id ON DELETE RESTRICT
```

Block-kind checks enforce:

```text
kind = rich-content
  content_id IS NOT NULL
  both ad hoc property objects are present
  structural_presentation IS NULL

kind = horizontal-rule
  content_id and both library Style IDs are NULL
  both ad hoc Style objects are NULL
  structural_presentation IS NOT NULL
  width_units = FULL_ROW_WIDTH_UNITS

kind = page-break
  content_id and both library Style IDs are NULL
  all property/presentation JSON is NULL
  width_units = FULL_ROW_WIDTH_UNITS
```

Database constraints provide local safety. Domain validation additionally
enforces Row composition, complete Row track sets, exact width sums, dense
ordinals, valid Style resolution, and acyclic inheritance.

`width_units` is stored beside each Block for simple ordered reads, but the
complete set is conceptually owned by its Row layout.

## Document Compare-and-Swap

Every structural mutation advances the Document revision exactly once:

```sql
UPDATE documents
SET revision = expected_revision + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE id = document_id
  AND revision = expected_revision;
```

The transaction performs this CAS before candidate child writes. Zero updated
rows means either missing Document or stale revision; the store distinguishes
them and rolls back.

Child rows do not have independent revisions. Their authoritative version is
the owning `documents.revision`.

## Shared Rich Content Transactions

Document ownership changes and Rich Content changes must not commit
independently. Rich Content therefore supplies a narrow transaction participant:

```ts
export interface RichContentTransactionParticipant {
  create(
    transaction: Transaction<BackendDatabase>,
    initialText: string
  ): Promise<ContentMutationResult>;

  display(
    transaction: Transaction<BackendDatabase>,
    id: RichContentId,
    options?: RichContentDisplayOptions
  ): Promise<DisplayContent>;

  mutate(
    transaction: Transaction<BackendDatabase>,
    id: RichContentId,
    expectedVersion: number,
    mutation: RichContentMutationWithoutContentId
  ): Promise<ContentMutationResult>;

  destroy(
    transaction: Transaction<BackendDatabase>,
    revision: ContentRevision
  ): Promise<void>;

  split(
    transaction: Transaction<BackendDatabase>,
    input: SplitContentInput
  ): Promise<SplitContentResult>;

  partitionLines(
    transaction: Transaction<BackendDatabase>,
    revision: ContentRevision
  ): Promise<RichContentLinePartitionResult>;

  combineAsList(
    transaction: Transaction<BackendDatabase>,
    input: CombineAsListInput
  ): Promise<ContentMutationResult>;
}
```

The participant exposes behavior, not raw atoms or marks. It shares domain
procedures with the standalone Rich Content runtime.

## Transaction Ordering

Foreign keys require Block references to be released before owned content is
destroyed:

```text
split / combine / Block deletion
  1. begin transaction
  2. CAS Document revision
  3. delete affected document_blocks references
  4. Rich Content CAS-deletes or replaces exact content revisions
  5. insert replacement Rows and Blocks
  6. validate and rewrite order/width state
  7. commit
```

Any Rich Content error rolls back the prior Document CAS and structural writes.

Creation uses the inverse dependency order:

```text
create Document / insert Block
  1. begin transaction
  2. CAS or insert Document state
  3. create Rich Content objects
  4. insert Blocks referencing them
  5. commit
```

Permanent Document deletion first deletes the expected Document row, allowing
cascades to release Block references, then destroys every expected Rich Content
revision before commit.

## Read Consistency

Display composition uses `REPEATABLE READ` across both capability tables:

```text
begin repeatable-read
  load Document, both Style libraries, Rows, Blocks, and tracks
  resolve each Block's style applications
  render owned Rich Content with Block-wide base characteristics
  derive capacities and page placement
commit
```

## Line Partition Result

Every logical line becomes a new Rich Content object, including empty lines:

```ts
export interface RichContentLinePartitionResult {
  readonly contents: readonly ContentMutationResult[];
}
```

`partitionLines` consumes the source, copies each logical line to a new content
object, preserves applicable inline Style and Link Marks, and drops List Item
Marks. An empty logical line produces an empty version-1 Rich Content object,
which Document owns through an ordinary Rich Content Block.

## Failure Guarantees

- A failed Document CAS changes neither Document nor Rich Content.
- A stale Rich Content revision rolls back its accompanying structural change.
- No successful operation leaves an owned content object without a Block.
- No successful operation leaves a Block referring to destroyed content.
- A failed multi-object change restores every source Row, Block, and content
  object.
- Horizontal Rule and Page Break operations never create Rich Content rows.
- Current Rich Content writes use `line-break`; legacy translation remains
  owned by Rich Content.

## Deletion

Deletion is permanent in the first increment. There are no history or tombstone
tables. The API requires both the expected Document version and every owned
Rich Content version so concurrent authored work cannot be silently discarded.

