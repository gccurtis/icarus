import type { Screen } from "$representation/data/types/workspace/screens";
import type { Frame } from "$representation/data/types/workspace/tab";

export const SINGLETONS = [
  "project-overview",
  "agents",
  "templates"
] as const satisfies readonly Screen[];

export type Singleton = (typeof SINGLETONS)[number];

export const isSingleton = (screen: Screen): screen is Singleton =>
  (SINGLETONS as readonly Screen[]).includes(screen);

export const DEFAULT_FRAME: Frame = Object.freeze({
  contextWidth: 276,
  contextCollapsed: false,
  inspectorWidth: 320,
  inspectorCollapsed: false
});
