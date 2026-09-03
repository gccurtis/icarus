import type { WorkspaceOp } from "$representation/data/types/workspace/op";
import type { TabId, TabRecord, TabView } from "$representation/data/types/workspace/tab";

export type WorkspaceBody = {
  readonly tabs: readonly TabRecord[];
  readonly activeId: TabId;
  readonly views: Readonly<Record<TabId, TabView>>;
};

/** `undefined` is not storable, so a tab with no resource carries no key for one. */
const recordOf = (tab: TabId, target: { category: string; resourceId?: string }): TabRecord =>
  ({
    id: tab,
    category: target.category,
    ...(target.resourceId === undefined ? {} : { resourceId: target.resourceId })
  }) as TabRecord;

const withView = (body: WorkspaceBody, tab: TabId, change: Partial<TabView>): WorkspaceBody => {
  const held = body.views[tab];
  if (held === undefined) throw new Error(`no tab ${tab} to change`);

  return { ...body, views: { ...body.views, [tab]: { ...held, ...change } } };
};

const inserted = (
  tabs: readonly TabRecord[],
  record: TabRecord,
  at: number
): readonly TabRecord[] => {
  const kept = tabs.filter((held) => held.id !== record.id);
  const index = Math.min(Math.max(at, 0), kept.length);

  return [...kept.slice(0, index), record, ...kept.slice(index)];
};

const applyOp = (body: WorkspaceBody, op: WorkspaceOp): WorkspaceBody => {
  switch (op.op) {
    case "open":
      return {
        ...body,
        tabs: inserted(body.tabs, recordOf(op.tab, op.target), op.at),
        views: { ...body.views, [op.tab]: op.view }
      };

    case "close": {
      const { [op.tab]: gone, ...kept } = body.views;
      void gone;

      return { ...body, tabs: body.tabs.filter((held) => held.id !== op.tab), views: kept };
    }

    case "activate":
      if (!body.tabs.some((held) => held.id === op.now)) {
        throw new Error(`no tab ${op.now} to activate`);
      }
      return { ...body, activeId: op.now };

    case "land":
      return withView(body, op.tab, op.now);

    case "context":
      return withView(body, op.tab, { contextId: op.now });

    case "inspect":
      return withView(body, op.tab, { inspected: op.now, selection: op.selection });

    case "resize":
      return withView(body, op.tab, { frame: op.now });

    case "zoom":
      return withView(body, op.tab, { zoom: op.now });
  }
};

export const applyOps = (body: WorkspaceBody, ops: readonly WorkspaceOp[]): WorkspaceBody =>
  ops.reduce(applyOp, body);
