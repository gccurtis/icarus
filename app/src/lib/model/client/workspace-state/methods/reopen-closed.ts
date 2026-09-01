import { invert } from "$representation/data/behavior/workspace/invert";
import type { WorkspaceOp } from "$representation/data/types/workspace/op";
import type { WorkspaceStateData } from "$model/client/workspace-state/definition.svelte";
import { perform } from "$model/client/workspace-state/methods/shared/perform";
import type { Tab } from "$model/client/workspace-state/types";

type Close = Extract<WorkspaceOp, { op: "close" }>;

const reopenable = (log: readonly WorkspaceOp[]): Close | undefined => {
  for (let at = log.length - 1; at >= 0; at -= 1) {
    const op = log[at];
    if (op.op !== "close") continue;
    const back = log.slice(at + 1).some((later) => later.op === "open" && later.tab === op.tab);
    if (!back) return op;
  }
  return undefined;
};

export const reopenClosed = (state: WorkspaceStateData): Tab | undefined => {
  const closed = reopenable(state.log);
  if (closed === undefined) return undefined;

  const was = state.tabs.activeId;
  perform(state, invert(closed));
  perform(state, { op: "activate", was, now: closed.tab });

  return state.compose(closed.tab);
};
