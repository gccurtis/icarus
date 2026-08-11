import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  operationLabel,
  scopeLabel,
  listTemplates,
  type HistoryEntry,
  type HistoryPage
} from './api';

// Mock the api module for fetchDocumentHistory test
vi.mock('$data/api', () => ({
  api: vi.fn()
}));

import { api } from '$data/api';

describe('listTemplates', () => {
  it('lists templates, reading base.template.variables', async () => {
    vi.mocked(api).mockResolvedValue({
      templates: [
        { id: 't1', name: 'Brief', base: { template: { isTemplate: true, variables: [{ name: 'audience', description: 'Who' }] } } }
      ]
    });
    const tpls = await listTemplates();
    expect(api).toHaveBeenCalledWith('/documents/templates');
    expect(tpls).toEqual([{ id: 't1', name: 'Brief', variables: [{ name: 'audience', description: 'Who' }] }]);
  });

  it('defaults the name and tolerates a missing template descriptor', async () => {
    vi.mocked(api).mockResolvedValue({ templates: [{ id: 't2', name: '' }] });
    const tpls = await listTemplates();
    expect(tpls[0]).toEqual({ id: 't2', name: 'Untitled template', variables: [] });
  });
});

describe('operationLabel', () => {
  it('returns "Made a change" for empty types', () => {
    expect(operationLabel([])).toBe('Made a change');
  });

  it('maps a single known operation type', () => {
    expect(operationLabel(['insert_row'])).toBe('Added a row');
    expect(operationLabel(['delete_row'])).toBe('Deleted a row');
    expect(operationLabel(['insert_atom'])).toBe('Wrote text');
    expect(operationLabel(['delete_atom'])).toBe('Deleted text');
    expect(operationLabel(['set_atom_text'])).toBe('Edited text');
    expect(operationLabel(['splice_atom_text'])).toBe('Edited text');
    expect(operationLabel(['add_mark'])).toBe('Applied formatting');
    expect(operationLabel(['remove_mark'])).toBe('Removed formatting');
    expect(operationLabel(['set_prompt'])).toBe('Set a prompt');
    expect(operationLabel(['resolve_block'])).toBe('Resolved a prompt');
    expect(operationLabel(['set_page_layout'])).toBe('Changed page layout');
    expect(operationLabel(['set_row_height'])).toBe('Changed row height');
    expect(operationLabel(['set_block_line_height'])).toBe('Changed line spacing');
    expect(operationLabel(['set_block_alignment'])).toBe('Changed alignment');
    expect(operationLabel(['set_row_tracks'])).toBe('Changed columns');
    expect(operationLabel(['put_style_definition'])).toBe('Updated a style');
    expect(operationLabel(['set_style_default'])).toBe('Changed a default style');
    expect(operationLabel(['assign_block_style'])).toBe('Applied a style');
    expect(operationLabel(['set_block_style_overrides'])).toBe('Adjusted style');
    expect(operationLabel(['set_block_custom_typography'])).toBe('Changed font');
    expect(operationLabel(['move_row'])).toBe('Moved a row');
    expect(operationLabel(['move_block'])).toBe('Moved a block');
  });

  it('falls back to underscore-replaced label for unknown types', () => {
    expect(operationLabel(['set_header'])).toBe('set header');
    expect(operationLabel(['some_new_op'])).toBe('some new op');
  });

  it('summarizes multiple operations as "first + N more"', () => {
    expect(operationLabel(['insert_row', 'insert_block', 'insert_atom'])).toBe('Added a row + 2 more');
    expect(operationLabel(['set_atom_text', 'add_mark'])).toBe('Edited text + 1 more');
  });

  it('falls back for unknown type as first operation in multi-op', () => {
    expect(operationLabel(['unknown_op', 'insert_row'])).toBe('unknown op + 1 more');
  });
});

describe('scopeLabel', () => {
  it('returns "Document" for empty affected', () => {
    expect(scopeLabel({})).toBe('Document');
  });

  it('returns "1 row" for single row', () => {
    expect(scopeLabel({ rowIds: ['r1'] })).toBe('1 row');
  });

  it('returns "N rows" for multiple rows', () => {
    expect(scopeLabel({ rowIds: ['r1', 'r2', 'r3'] })).toBe('3 rows');
  });

  it('returns "1 block" for single block', () => {
    expect(scopeLabel({ blockIds: ['b1'] })).toBe('1 block');
  });

  it('returns "N blocks" for multiple blocks', () => {
    expect(scopeLabel({ blockIds: ['b1', 'b2'] })).toBe('2 blocks');
  });

  it('prioritizes rows over blocks when both present', () => {
    // rows > 1 takes priority
    expect(scopeLabel({ rowIds: ['r1', 'r2'], blockIds: ['b1', 'b2', 'b3'] })).toBe('2 rows');
  });

  it('falls back to blocks when no rows', () => {
    expect(scopeLabel({ blockIds: ['b1'] })).toBe('1 block');
  });
});

describe('fetchDocumentHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps API response to HistoryEntry shapes', async () => {
    const mockApi = api as ReturnType<typeof vi.fn>;

    // We need to import the real function fresh to avoid hoisting issues
    const { fetchDocumentHistory } = await import('./api');

    mockApi.mockResolvedValueOnce({
      entries: [{
        id: 'cs-1',
        revision: 1,
        authoredRevision: 1,
        priorRevision: 0,
        createdAt: '2026-07-24T15:14:00Z',
        author: { id: 'u-1', name: 'Dev' },
        summary: {
          operationCount: 2,
          operationTypes: ['insert_row', 'insert_block'],
          affected: { rowIds: ['r1'] }
        },
        detailAvailable: true,
        canUndo: true,
        canRedo: false
      }],
      nextCursor: 'cursor-2'
    });

    const page = await fetchDocumentHistory('doc-1');
    expect(page.entries).toHaveLength(1);
    expect(page.entries[0].authorName).toBe('Dev');
    expect(page.entries[0].authorId).toBe('u-1');
    expect(page.entries[0].action).toBe('Added a row + 1 more');
    expect(page.entries[0].scope).toBe('1 row');
    expect(page.entries[0].detailAvailable).toBe(true);
    expect(page.entries[0].canUndo).toBe(true);
    expect(page.entries[0].canRedo).toBe(false);
    expect(page.nextCursor).toBe('cursor-2');
  });

  it('builds the query string with limit and optional cursor', async () => {
    const mockApi = api as ReturnType<typeof vi.fn>;
    const { fetchDocumentHistory } = await import('./api');

    mockApi.mockResolvedValueOnce({ entries: [], nextCursor: null });
    await fetchDocumentHistory('doc-1', 10, 'cursor-abc');

    expect(mockApi).toHaveBeenCalledWith('/documents/doc-1/history?limit=10&cursor=cursor-abc');
  });
});
