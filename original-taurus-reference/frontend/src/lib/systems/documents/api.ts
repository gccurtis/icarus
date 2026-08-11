import { api } from '$data/api';
import type { Doc, DocumentTemplate, NewRow, ChangeOp, ChangeSet, Job } from './types';
import { defaultPageLayout, defaultLayoutRules } from './types';

export { newUnitId } from './types';

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

export async function listDocuments(): Promise<Doc[]> {
  const res = await api<{ documents: Doc[] }>('/documents');
  return res.documents.map(normalizeDocument);
}

export async function getDocument(id: string): Promise<Doc> {
  return normalizeDocument(await api<Doc>(`/documents/${id}`));
}

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

export async function createDocument(name: string, rows: NewRow[]): Promise<Doc> {
  return normalizeDocument(
    await api<Doc>('/documents', { method: 'POST', body: JSON.stringify({ name, rows }) })
  );
}

export function deleteDocument(id: string): Promise<unknown> {
  return api(`/documents/${id}`, { method: 'DELETE' });
}

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
  // Jobs live under the /dev operator surface now (taurus-omega
  // docs/frontend-requests/job-routes-moved-to-dev.md) — the old /jobs/:id 404s.
  // The body is unchanged: lifecycle fields only, never the payload.
  return api<Job>(`/dev/jobs/${jobId}`);
}

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

// A change set's before/after now lives in `./change-detail`, which reconstructs
// the prior text from preceding change sets instead of projecting only the ops
// this one carries. Omega returns just the new text — the previous value is
// private undo state (`InverseOps`, `json:"-"`) — and a result with nothing to
// compare it against does not tell a reader what changed.

export function undoChange(documentId: string, changeSetId: string): Promise<void> {
  return api(`/documents/${documentId}/changes/${changeSetId}/undo`, { method: 'POST' }).then(() => {});
}

export function redoChange(documentId: string, changeSetId: string): Promise<void> {
  return api(`/documents/${documentId}/changes/${changeSetId}/redo`, { method: 'POST' }).then(() => {});
}
