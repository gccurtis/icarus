import type { Category } from "$representation/data/types/workspace/categories";
import type { Frame } from "$representation/data/types/workspace/tab";

export const SINGLETONS = [
  "project-overview",
  "agents",
  "templates"
] as const satisfies readonly Category[];

export type Singleton = (typeof SINGLETONS)[number];

export const isSingleton = (category: Category): category is Singleton =>
  (SINGLETONS as readonly Category[]).includes(category);

export const DEFAULT_FRAME: Frame = Object.freeze({
  contextWidth: 276,
  contextCollapsed: false,
  inspectorWidth: 320,
  inspectorCollapsed: false
});
