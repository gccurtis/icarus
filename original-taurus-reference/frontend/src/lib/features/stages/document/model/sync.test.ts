import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Node as PmNode } from 'prosemirror-model';

// Omega answers 409 for TWO different things: a genuine revision conflict, and
// the requireProject gate ("select a project first") which fires BEFORE the
// handler runs. Confusing them cost real data: the flush discarded its queued
// ops and reloaded the document, throwing away unsaved edits and collapsing the
// user's selection, for a condition that only needed the project re-selected.

const appendChanges = vi.fn();
const getDocument = vi.fn();
const openProject = vi.fn();

vi.mock('$data/documents', () => ({
  appendChanges: (...args: unknown[]) => appendChanges(...args),
  getDocument: (...args: unknown[]) => getDocument(...args),
  createDocument: vi.fn(),
  listDocuments: vi.fn(),
  defaultPageLayout: { width: 612, height: 792, marginTop: 72, marginRight: 72, marginBottom: 72, marginLeft: 72 },
  defaultLayoutRules: { maxFontHeight: 24, minRowPadding: 4, maxHeightIncrease: 144 }
}));
vi.mock('$data/projects', () => ({ openProject: (...args: unknown[]) => openProject(...args) }));
vi.mock('../editor/bridge', () => ({
  diffDoc: () => ({ ops: [{ op: 'set_atom_text', blockId: 'b1', atomId: 'a1', setText: 'x' }], nextRows: [], fixups: new Map() })
}));

const { SyncEngine } = await import('./sync');
const { OptimisticOverlay } = await import('./overlay');

class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

function makeEngine() {
  const host = {
    doc: () => ({}) as PmNode,
    replaceState: vi.fn(),
    applyFixups: vi.fn(),
    captureSelection: vi.fn(() => ({ blockId: 'b1', offset: 0 })),
    restoreSelection: vi.fn(),
    setInfo: vi.fn(),
    savePending: vi.fn(() => true),
    refreshView: vi.fn(),
    onLoaded: vi.fn()
  };
  const engine = new SyncEngine(host, new OptimisticOverlay(), 'proj-1', 'res-1');
  engine.docId = 'doc-1';
  engine.revision = 7;
  return { engine, host };
}

beforeEach(() => {
  appendChanges.mockReset();
  getDocument.mockReset();
  openProject.mockReset();
});

describe('SyncEngine.flush — the two kinds of 409', () => {
  it('recovers a "select a project first" 409 by selecting and retrying, not reloading', async () => {
    const { engine, host } = makeEngine();
    appendChanges
      .mockRejectedValueOnce(new ApiError(409, 'select a project first'))
      .mockResolvedValueOnce({ seq: 8, createdAt: '2026-07-27T00:00:00Z' });

    await engine.flush();

    expect(openProject).toHaveBeenCalledWith('proj-1');
    expect(appendChanges).toHaveBeenCalledTimes(2);
    // The recovery path must NOT reload: the edits are still ours.
    expect(getDocument).not.toHaveBeenCalled();
    expect(host.replaceState).not.toHaveBeenCalled();
    expect(engine.revision).toBe(8);
    expect(host.setInfo).toHaveBeenCalledWith({ save: 'saved', updatedAt: '2026-07-27T00:00:00Z' });
  });

  it('still reloads when the 409 survives the retry (a real revision conflict)', async () => {
    const { engine, host } = makeEngine();
    appendChanges.mockRejectedValue(new ApiError(409, 'revision conflict'));
    getDocument.mockResolvedValue({
      id: 'doc-1',
      revision: 12,
      base: { rows: [], pageLayout: {}, layoutRules: {}, styleRegistry: {}, defaultTypography: null },
      clientCapabilities: { canonicalLayout: true },
      createdAt: '',
      updatedAt: '',
      creatorId: '',
      creatorName: ''
    });

    await engine.flush();

    expect(appendChanges).toHaveBeenCalledTimes(2);
    expect(host.replaceState).toHaveBeenCalled();
    expect(engine.revision).toBe(12);
  });

  it('does not reload on a non-409 failure — it retries later instead', async () => {
    const { engine, host } = makeEngine();
    appendChanges.mockRejectedValue(new ApiError(500, 'server error'));

    await engine.flush();

    expect(host.replaceState).not.toHaveBeenCalled();
    expect(host.setInfo).toHaveBeenCalledWith({ save: 'error' });
    engine.dispose();
  });
});
