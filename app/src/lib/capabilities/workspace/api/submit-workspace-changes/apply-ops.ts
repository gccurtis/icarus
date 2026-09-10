import type { WorkspaceOp } from "$representation/data/types/workspace/op";
import type { TabId, TabRecord, TabView } from "$representation/data/types/workspace/tab";
import { isSingleton } from "$representation/data/behavior/workspace/starting";
import { isStoredWorkspaceBody } from "$representation/data/behavior/workspace/stored-rows";
import { isStoredTabViewFor } from "$representation/data/behavior/workspace/stored-values";

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

const same = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") {
    return false;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
      left.every((entry, index) => same(entry, right[index]));
  }
  const leftFields = left as Record<PropertyKey, unknown>;
  const rightFields = right as Record<PropertyKey, unknown>;
  const leftKeys = Reflect.ownKeys(leftFields);
  const rightKeys = Reflect.ownKeys(rightFields);
  return leftKeys.length === rightKeys.length &&
    leftKeys.every((key) => rightKeys.includes(key) && same(leftFields[key], rightFields[key]));
};

const landingOf = (view: TabView) => ({
  content: view.content,
  focus: view.focus,
  contextId: view.contextId,
  inspected: view.inspected,
  selection: view.selection
});

const withView = (body: WorkspaceBody, tab: TabId, change: Partial<TabView>): WorkspaceBody => {
  const held = body.views[tab];
  if (held === undefined) throw new Error(`no tab ${tab} to change`);
  const record = body.tabs.find((candidate) => candidate.id === tab);
  if (record === undefined) throw new Error(`no tab ${tab} to change`);
  const next = { ...held, ...change };
  if (!isStoredTabViewFor(next, record.category)) {
    throw new Error(`tab ${tab} cannot hold that view for ${record.category}`);
  }
  return { ...body, views: { ...body.views, [tab]: next } };
};

const inserted = (
  tabs: readonly TabRecord[],
  record: TabRecord,
  at: number
): readonly TabRecord[] => {
  const kept = tabs.filter((held) => held.id !== record.id);
  return [...kept.slice(0, at), record, ...kept.slice(at)];
};

const applyOp = (body: WorkspaceBody, op: WorkspaceOp): WorkspaceBody => {
  switch (op.op) {
    case "open":
      if (body.tabs.some((held) => held.id === op.tab)) {
        throw new Error(`tab ${op.tab} is already open`);
      }
      if (op.at > body.tabs.length) {
        throw new Error(`tab ${op.tab} cannot open at position ${op.at}`);
      }
      return {
        ...body,
        tabs: inserted(body.tabs, recordOf(op.tab, op.target), op.at),
        views: { ...body.views, [op.tab]: op.view }
      };

    case "close": {
      const at = body.tabs.findIndex((held) => held.id === op.tab);
      const held = body.tabs[at];
      if (held === undefined) throw new Error(`no tab ${op.tab} to close`);
      if (body.activeId === op.tab) throw new Error(`active tab ${op.tab} must be left before it is closed`);
      if (isSingleton(held.category)) throw new Error(`singleton tab ${op.tab} cannot be closed`);
      if (at !== op.at || !same(held, recordOf(op.tab, op.target)) || !same(body.views[op.tab], op.view)) {
        throw new Error(`tab ${op.tab} no longer matches the close operation`);
      }
      const { [op.tab]: gone, ...kept } = body.views;
      void gone;

      return { ...body, tabs: body.tabs.filter((held) => held.id !== op.tab), views: kept };
    }

    case "activate":
      if (body.activeId !== op.was) {
        throw new Error(`active tab is ${body.activeId}, not ${op.was}`);
      }
      if (!body.tabs.some((held) => held.id === op.now)) {
        throw new Error(`no tab ${op.now} to activate`);
      }
      return { ...body, activeId: op.now };

    case "land":
      if (body.views[op.tab] === undefined) throw new Error(`no tab ${op.tab} to change`);
      if (!same(landingOf(body.views[op.tab]), op.was)) {
        throw new Error(`tab ${op.tab} no longer matches the landing operation`);
      }
      return withView(body, op.tab, op.now);

    case "context":
      if (body.views[op.tab]?.contextId !== op.was) {
        throw new Error(`tab ${op.tab} no longer matches the context operation`);
      }
      return withView(body, op.tab, { contextId: op.now });

    case "inspect":
      if (
        body.views[op.tab]?.inspected !== op.was ||
        !same(body.views[op.tab]?.selection ?? null, op.wasSelection)
      ) throw new Error(`tab ${op.tab} no longer matches the inspect operation`);
      return withView(body, op.tab, { inspected: op.now, selection: op.selection });

    case "resize":
      if (!same(body.views[op.tab]?.frame, op.was)) {
        throw new Error(`tab ${op.tab} no longer matches the resize operation`);
      }
      return withView(body, op.tab, { frame: op.now });

    case "zoom":
      if (body.views[op.tab] === undefined) throw new Error(`no tab ${op.tab} to change`);
      if ((body.views[op.tab]?.zoom ?? null) !== op.was) {
        throw new Error(`tab ${op.tab} no longer matches the zoom operation`);
      }
      return withView(body, op.tab, { zoom: op.now });
  }
};

export const applyOps = (body: WorkspaceBody, ops: readonly WorkspaceOp[]): WorkspaceBody => {
  const next = ops.reduce(applyOp, body);
  if (!isStoredWorkspaceBody(next)) {
    throw new Error("workspace operations do not produce one exact current workspace");
  }
  return next;
};
