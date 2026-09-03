import type { TabView, Target } from "$representation/data/types/workspace/tab";
import { openingView } from "$representation/data/behavior/workspace/opening";

export const mintView = (target: Target): TabView =>
  openingView(target.category, { content: target.content, focus: target.focus });
