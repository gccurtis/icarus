# src/lib/systems/documents/api.ts — breakdown

Companion to [api.ts](api.ts). The document API client: CRUD operations, change
submission, prompt resolution, job polling, and the full document history layer
(list, detail fetch, undo, redo, plus UI-label helpers and type mapping).

## Imports and re-exports

### Import the generic API client, document types, and defaults; re-export newUnitId

```ts
import { api } from '$data/api';
import type { Doc, DocumentTemplate, NewRow, ChangeOp, ChangeSet, Job } from './types';
import { defaultPageLayout, defaultLayoutRules } from './types';

export { newUnitId } from './types';

```

The module imports the base `api` client from the data layer and all document
domain types from the sibling `types.ts` — including `DocumentTemplate`, the
reduced template shape the template list below produces. `newUnitId` is re-exported
so callers outside the system can use it without reaching into `types.ts` directly.
The blank line after the export separates imports/re-exports from the first
function.

## Document normalization

### Fill in missing defaults so every Doc is shape-stable

```ts
function normalizeDocument(doc: Doc): Doc {
  const base = doc.base ?? ({} as Doc['base']);
  const canonicalLayout = base.pageLayout != null && base.layoutRules != null;
  const revisionSubmissions = Number.isSafeInteger(doc.revision);
  return {
    ...doc,
    revision: revisionSubmissions ? doc.revision : 0,
    clientCapabilities: { canonicalLayout, revisionSubmissions },
    base: {
      pageLayout: { ...defaultPageLayout, ...base.pageLayout },
      layoutRules: { ...defaultLayoutRules, ...base.layoutRules },
      styleRegistry: {
        definitions: base.styleRegistry?.definitions ?? [],
        defaults: base.styleRegistry?.defaults ?? []
      },
      rows: (base.rows ?? []).map((row) => ({
        ...row,
        style: { heightIncrease: row.style?.heightIncrease ?? 0 },
        blocks: (row.blocks ?? []).map((block) => ({
          ...block,
          style: {
            horizontalAlign: block.style?.horizontalAlign ?? 'left',
            verticalAlign: block.style?.verticalAlign ?? 'top'
          },
          // Preserve the block's semantic style reference (styleId + overrides).
          styleRef: block.styleRef ?? null
        }))
      }))
    }
  };
}

```

Every document from the API flows through `normalizeDocument` so the rest of the
codebase can assume safe defaults. `revision` is clamped to 0 when missing or
arbitrary. `clientCapabilities` tells Omega which protocol features we support:
canonical layout and revision-aware change submission. Page layout and layout
rules each merge over the module-level defaults. The `styleRegistry` is surfaced
with `definitions`/`defaults` arrays (empty when Omega omits them). Rows and blocks
receive default `style` sub-objects — row height increase defaults to 0, block
alignment defaults to `left`/`top` — and each block's semantic `styleRef` (styleId +
overrides) is preserved (null when unstyled).

## Document CRUD

### List and fetch a single document

```ts
export async function listDocuments(): Promise<Doc[]> {
  const res = await api<{ documents: Doc[] }>('/documents');
  return res.documents.map(normalizeDocument);
}

export async function getDocument(id: string): Promise<Doc> {
  return normalizeDocument(await api<Doc>(`/documents/${id}`));
}

```

`listDocuments` GETs `/documents` and normalizes each returned document.
`getDocument` fetches a single document by ID and normalizes it.

## Document templates

### Template wire type, the mapper, and the template list endpoint

```ts
// A template list item is a full document; the picker reads only id/name and the
// template descriptor at `base.template`.
type TemplateDoc = {
  id: string;
  name: string;
  base?: { template?: { isTemplate?: boolean; variables?: { name: string; description?: string }[] } };
};

function toTemplate(d: TemplateDoc): DocumentTemplate {
  return {
    id: d.id,
    name: d.name || 'Untitled template',
    variables: (d.base?.template?.variables ?? []).map((v) => ({
      name: v.name,
      description: v.description || undefined
    }))
  };
}

/** List the project's document templates (`GET /documents/templates`). */
export async function listTemplates(): Promise<DocumentTemplate[]> {
  const res = await api<{ templates: TemplateDoc[] }>('/documents/templates');
  return (res.templates ?? []).map(toTemplate);
}

```

`TemplateDoc` is the raw wire item — a full Omega document, of which the picker reads
only `id`/`name` and the template descriptor at `base.template`. `toTemplate` narrows one
to the UI `DocumentTemplate`: it defaults a blank name to "Untitled template" and maps
each declared context variable, coercing an empty `description` to `undefined`.
`listTemplates` GETs `/documents/templates`, tolerates a missing `templates` array, and
maps each entry through `toTemplate`.

## Document creation and deletion

### Create and delete documents

```ts
export async function createDocument(name: string, rows: NewRow[]): Promise<Doc> {
  return normalizeDocument(
    await api<Doc>('/documents', { method: 'POST', body: JSON.stringify({ name, rows }) })
  );
}

export function deleteDocument(id: string): Promise<unknown> {
  return api(`/documents/${id}`, { method: 'DELETE' });
}

```

`createDocument` POSTs a name and initial row structure, normalizing the returned
document. `deleteDocument` sends a DELETE and returns the API's raw promise — callers
expect no meaningful response body.

## Change submission

### Append a batch of operations as a change set with revision checking

```ts
export function appendChanges(
  documentId: string,
  expectedRevision: number,
  operations: ChangeOp[],
  submissionId = crypto.randomUUID().replace(/-/g, '')
): Promise<ChangeSet> {
  return api<ChangeSet>(`/documents/${documentId}/changes`, {
    method: 'POST',
    body: JSON.stringify({ submissionId, expectedRevision, operations, ops: operations })
  });
}

```

`appendChanges` posts a batch of change operations to
`/documents/:id/changes`. The `expectedRevision` enables optimistic concurrency:
Omega rejects the submission when the revision has moved. A UUID
`submissionId` (dashes stripped for brevity) makes the batch idempotent.
Both `operations` and `ops` are sent — the older `ops` field is a legacy
compat key required by some Omega versions.

## Prompt resolution and job polling

### Trigger a prompt block resolution and poll the resulting job

```ts
export function resolvePromptBlock(
  documentId: string,
  blockId: string,
  mode: '' | 'reload' | 'refresh' = ''
): Promise<{ jobId: string }> {
  return api<{ jobId: string }>(`/documents/${documentId}/blocks/${blockId}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ mode })
  });
}

export function getJob(jobId: string): Promise<Job> {
  return api<Job>(`/dev/jobs/${jobId}`);
}

```

`resolvePromptBlock` POSTs to the resolve endpoint for a specific block and
returns the `jobId` that callers can poll. `getJob` is a thin wrapper over
**`/dev/jobs/:id`** — any component that needs to poll a job uses this directly.

The `/dev` prefix is not a typo (adopted 2026-07-27 from
`taurus-omega/docs/frontend-requests/job-routes-moved-to-dev.md`): jobs are
operator observability, not a product surface — the jobs table carries no owner
column, so there is nothing to authorize a per-user route against, and Omega
moved the whole family under its `/dev` diagnostic prefix. The old `/jobs/:id`
is gone. The body is unchanged (lifecycle fields only; the payload is never
serialized). It is a safe `GET`, so it needs the session cookie but no CSRF
header.

## Document history types

### Wire type (API shape) and UI-friendly types

```ts
// --- document history -------------------------------------------------------

type ApiHistoryEntry = {
  id: string;
  revision: number;
  authoredRevision: number;
  priorRevision: number;
  createdAt: string;
  author: { id: string; name: string };
  summary: { operationCount: number; operationTypes: string[]; affected: { rowIds?: string[]; blockIds?: string[] } };
  detailAvailable: boolean;
  canUndo: boolean;
  canRedo: boolean;
};

export type HistoryEntry = {
  id: string;
  authorId: string;
  authorName: string;
  action: string;
  scope: string;
  occurredAt: number;
  detailAvailable: boolean;
  canUndo: boolean;
  canRedo: boolean;
};

export type HistoryPage = {
  entries: HistoryEntry[];
  nextCursor: string | null;
};

```

`ApiHistoryEntry` is the raw Omega shape — never exported. `HistoryEntry` is the
UI-ready shape that flattens the author sub-object, replaces raw `createdAt` with
a parsed `occurredAt` timestamp, and pre-computes `action` and `scope` labels.
`HistoryPage` supports cursor-based pagination of the history list.

## Label helpers

### Derive human-readable action and scope labels from raw operation data

```ts
export function operationLabel(types: string[]): string {
  const names: Record<string, string> = {
    insert_row: 'Added a row',
    delete_row: 'Deleted a row',
    insert_block: 'Added a block',
    delete_block: 'Deleted a block',
    set_block: 'Changed block style',
    insert_atom: 'Wrote text',
    delete_atom: 'Deleted text',
    set_atom_text: 'Edited text',
    splice_atom_text: 'Edited text',
    add_mark: 'Applied formatting',
    remove_mark: 'Removed formatting',
    set_prompt: 'Set a prompt',
    resolve_block: 'Resolved a prompt',
    set_page_layout: 'Changed page layout',
    set_row_height: 'Changed row height',
    set_block_line_height: 'Changed line spacing',
    set_block_alignment: 'Changed alignment',
    set_row_tracks: 'Changed columns',
    put_style_definition: 'Updated a style',
    set_style_default: 'Changed a default style',
    assign_block_style: 'Applied a style',
    set_block_style_overrides: 'Adjusted style',
    set_block_custom_typography: 'Changed font',
    move_row: 'Moved a row',
    move_block: 'Moved a block'
  };
  if (types.length === 0) return 'Made a change';
  if (types.length === 1) return names[types[0]] ?? types[0].replace(/_/g, ' ');
  const first = names[types[0]] ?? types[0].replace(/_/g, ' ');
  return `${first} + ${types.length - 1} more`;
}

export function scopeLabel(affected: { rowIds?: string[]; blockIds?: string[] }): string {
  const rows = affected.rowIds?.length ?? 0;
  const blocks = affected.blockIds?.length ?? 0;
  if (rows > 1) return `${rows} rows`;
  if (blocks > 1) return `${blocks} blocks`;
  if (rows === 1) return '1 row';
  if (blocks === 1) return '1 block';
  return 'Document';
}

```

`operationLabel` maps Omega's internal operation type strings to short,
past-tense summaries — a single operation gets its label, multiple operations
get a "first + N more" summary. `scopeLabel` reads the `affected` object and
returns a compact scope string describing which rows or blocks were touched,
defaulting to `"Document"` when neither is present.

## History mapping

### Convert an API history entry to the UI shape

```ts
export function toHistoryEntry(entry: ApiHistoryEntry): HistoryEntry {
  return {
    id: entry.id,
    authorId: entry.author.id,
    authorName: entry.author.name,
    action: operationLabel(entry.summary.operationTypes),
    scope: scopeLabel(entry.summary.affected),
    occurredAt: Date.parse(entry.createdAt),
    detailAvailable: entry.detailAvailable,
    canUndo: entry.canUndo,
    canRedo: entry.canRedo
  };
}

```

`toHistoryEntry` flattens the nested `author` sub-object, derives `action` and
`scope` via the label helpers, and parses `createdAt` into a numeric timestamp.
The other fields pass through unchanged.

## History API functions

### Fetch paginated history, fetch change set detail, undo, and redo

```ts
export async function fetchDocumentHistory(
  documentId: string,
  limit = 20,
  cursor?: string
): Promise<HistoryPage> {
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor) query.set('cursor', cursor);
  const res = await api<{ entries: ApiHistoryEntry[]; nextCursor: string | null }>(
    `/documents/${documentId}/history?${query}`
  );
  return {
    entries: res.entries.map(toHistoryEntry),
    nextCursor: res.nextCursor
  };
}

export async function fetchChangeSetDetail(
  documentId: string,
  changeSetId: string
): Promise<{ before: string; after: string }> {
  const cs = await api<{
    id: string;
    authorId: string;
    authorName: string;
    ops: Array<{ op: string; setText?: string; setKind?: string; rowId?: string; blockId?: string; afterRow?: string }>;
  }>(`/documents/${documentId}/history/${changeSetId}`);
  const before: string[] = [];
  const after: string[] = [];
  for (const op of cs.ops) {
    if (op.setKind) { before.push(`kind → ${op.setKind}`); after.push(`kind: ${op.setKind}`); }
    else if (op.setText) { before.push('text'); after.push(`"${op.setText.slice(0, 60)}${op.setText.length > 60 ? '…' : ''}"`); }
    else if (op.op === 'insert_row') { after.push('row inserted'); }
    else if (op.op === 'delete_row') { before.push('row deleted'); }
    else if (op.op === 'insert_block') { after.push('block inserted'); }
    else if (op.op === 'delete_block') { before.push('block deleted'); }
    else if (op.op === 'add_mark') { after.push('formatting applied'); }
    else if (op.op === 'remove_mark') { before.push('formatting removed'); }
    else { after.push(op.op.replace(/_/g, ' ')); }
  }
  return {
    before: before.length > 0 ? before.join(', ') : 'No content before this change.',
    after: after.length > 0 ? after.join(', ') : 'No content after this change.'
  };
}

export function undoChange(documentId: string, changeSetId: string): Promise<void> {
  return api(`/documents/${documentId}/changes/${changeSetId}/undo`, { method: 'POST' }).then(() => {});
}

export function redoChange(documentId: string, changeSetId: string): Promise<void> {
  return api(`/documents/${documentId}/changes/${changeSetId}/redo`, { method: 'POST' }).then(() => {});
}
```

`fetchDocumentHistory` GETs `/documents/:id/history` with a `limit` and optional
`cursor` for pagination, then maps each raw entry through `toHistoryEntry`.
**Change-set before/after no longer lives here.** `fetchChangeSetDetail` was
removed in favour of [`change-detail.ts`](change-detail.ts.md), which reconstructs
the *prior* text by walking older change sets rather than projecting only the ops
the target change set carries.

The reason: Omega returns the new text and nothing else — the previous value is
computed and stored as the change set's `InverseOps` but marked `json:"-"`,
private undo state. The old function coped by pushing the literal word `"text"`
into `before`, later by omitting `before` and labelling the survivor "Result".
Both were honest and useless; a result with nothing to compare it against does
not tell a reader what changed. Exposing the prior value directly is requested in
[`resource-access-enforcement.md`](../../../../docs/backend-requests/resource-access-enforcement.md),
which would let that module go away.
`undoChange` and `redoChange` POST to the undo/redo endpoints for a specific
change set, swallowing the response body so callers get a clean `Promise<void>`.
Omega appends a new inverse operation; no existing history is rewritten.
