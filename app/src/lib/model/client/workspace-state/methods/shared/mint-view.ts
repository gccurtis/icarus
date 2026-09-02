import type { TabView, Target } from "$representation/data/types/workspace/tab";
import { DEFAULT_FRAME } from "$model/client/workspace-state/methods/shared/defaults";
import { defaultContent, defaultContext } from "$model/client/workspace-state/methods/shared/rails";

export const mintView = (target: Target): TabView => {
  const content = target.content ?? defaultContent(target.category);
  if (content === undefined) {
    throw new Error(`'${target.category}' has no content view to open on`);
  }
  return {
    content,
    focus: target.focus ?? null,
    contextId: defaultContext(target.category) ?? null,
    inspected: "empty",
    selection: null,
    frame: { ...DEFAULT_FRAME }
  };
};
