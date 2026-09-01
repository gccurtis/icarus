import type { TabView, Target } from "$representation/data/types/workspace/tab";
import { DEFAULT_FRAME } from "$model/client/workspace-state/methods/shared/defaults";
import { defaultContext, defaultSubscreen } from "$model/client/workspace-state/methods/shared/rails";

export const mintView = (target: Target): TabView => {
  const subscreen = target.subscreen ?? defaultSubscreen(target.category);
  return {
    subscreen,
    focus: target.focus ?? null,
    contextId: defaultContext(target.category, subscreen) ?? null,
    inspected: "empty",
    selection: null,
    frame: { ...DEFAULT_FRAME }
  };
};
