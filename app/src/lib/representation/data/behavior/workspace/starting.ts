import type { Category } from "$representation/data/types/workspace/categories";
import type { TabId, TabRecord, TabView } from "$representation/data/types/workspace/tab";
import { openingView } from "$representation/data/behavior/workspace/opening";

/**
 * The categories a workspace always holds one of, and nothing else about them.
 *
 * **A singleton's id is its category.** Minted ids are per instance, which is
 * fine for a tab keyed by a resource and wrong for the three tabs every
 * workspace has: `activate project-overview` means the same thing in every
 * client and in the store, and `activate t1` means whatever that client happened
 * to count to.
 *
 * What each one opens on is not here. That is `OPENING`'s, the same as for every
 * other category, so a singleton cannot drift from the category it is one of.
 */
export const SINGLETONS = ["project-overview", "agents", "templates"] as const;

export type Singleton = (typeof SINGLETONS)[number];

export const isSingleton = (category: Category): category is Singleton =>
  (SINGLETONS as readonly Category[]).includes(category);

export type StartingWorkspace = {
  readonly tabs: readonly TabRecord[];
  readonly activeId: TabId;
  readonly views: Record<TabId, TabView>;
};

/**
 * What a workspace is before anybody has done anything to it.
 *
 * Definitional because two parties construct it: a client when nothing is
 * stored, and the server when it applies a first change set.
 */
export const startingWorkspace = (): StartingWorkspace => ({
  tabs: SINGLETONS.map((category) => ({ id: category, category })),
  activeId: SINGLETONS[0],
  views: Object.fromEntries(SINGLETONS.map((category) => [category, openingView(category)]))
});
