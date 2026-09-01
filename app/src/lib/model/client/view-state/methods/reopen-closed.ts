import { invert } from "$representation/data/behavior/views/invert";
import type { ViewOp } from "$representation/data/types/views/op";
import type { ViewStateData } from "$model/client/view-state/definition.svelte";
import { perform } from "$model/client/view-state/methods/shared/perform";
import type { Tab } from "$model/client/view-state/types";

type Close = Extract<ViewOp, { op: "close" }>;

const reopenable = (log: readonly ViewOp[]): Close | undefined => {
  for (let at = log.length - 1; at >= 0; at -= 1) {
    const op = log[at];
    if (op.op !== "close") continue;
    const back = log.slice(at + 1).some((later) => later.op === "open" && later.tab === op.tab);
    if (!back) return op;
  }
  return undefined;
};

export const reopenClosed = (state: ViewStateData): Tab | undefined => {
  const closed = reopenable(state.log);
  if (closed === undefined) return undefined;

  const was = state.tabs.activeId;
  perform(state, invert(closed));
  perform(state, { op: "activate", was, now: closed.tab });

  return state.compose(closed.tab);
};
