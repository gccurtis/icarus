import type { TabView, Target } from "$representation/data/types/views/tab";
import { DEFAULT_FRAME } from "$model/client/view-state/methods/shared/defaults";
import { defaultContext, defaultSubscreen } from "$model/client/view-state/methods/shared/rails";

export const mintView = (target: Target): TabView => {
  const subscreen = target.subscreen ?? defaultSubscreen(target.screen);
  return {
    subscreen,
    focus: target.focus ?? null,
    contextId: defaultContext(target.screen, subscreen) ?? null,
    inspected: "empty",
    selection: null,
    frame: { ...DEFAULT_FRAME }
  };
};
