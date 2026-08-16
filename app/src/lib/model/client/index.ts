import { browser } from "$app/environment";
import { buildClientModel } from "$model/client/constructor";
import type { ClientModel, ClientModelInput } from "$model/client/types";

export type { ClientModel, ClientModelInput } from "$model/client/types";
export type {
  ClientStorage,
  PersistedClient,
  PersistedPanels,
  PersistedTab,
  PersistedTabOptions,
  PersistedWorkbench
} from "$model/client/storage";
export type {
  ContextId,
  Inspection,
  InspectionNode,
  Panels,
  ResourceKind,
  ResourceRef,
  Tab,
  TabId,
  TabOptions,
  WorkbenchModel
} from "$model/client/workbench";
export {
  CONTEXTS_BY_KIND,
  CONTEXT_IDS,
  DEFAULTS,
  PROJECT_OVERVIEW,
  RESOURCE_KINDS,
  isContextId,
  isResourceKind
} from "$model/client/workbench";

/**
 * The one client model for this client instance.
 *
 * A client instance is one browser tab holding the application: the `/app`
 * layout persists, tabs are workbench state rather than route state, and views
 * do not remount on navigation. One instance, one graph, for that tab's whole
 * life.
 *
 * Module state is safe here *because none of it is shared*. There is no second
 * person inside a tab to leak to, which is the whole reason a shape that would be
 * a defect on the server is correct in this file — and why no other module in
 * this tree may hold one.
 *
 * See [`client.md`](client.md).
 */
let instance: ClientModel | undefined;

/** Called once by the `/app` layout that owns this client instance. */
export const initClientModel = (input: ClientModelInput): ClientModel =>
  (instance = buildClientModel(input));

/**
 * The graph the layout built.
 *
 * Two refusals, because they are two different mistakes. Reaching this from a
 * server path is a category error — the graph belongs to a tab, and no amount of
 * waiting produces one. Reaching it in the browser before the layout ran is a
 * question of order.
 *
 * The `browser` guard is what makes this module safe to import from anywhere:
 * the client tree being browser-only becomes a fact about the code rather than a
 * consequence of `ssr = false` on a route, which someone could flip.
 */
export const clientModel = (): ClientModel => {
  if (!browser) {
    throw new Error(
      "The client model is browser-only — it belongs to one browser tab. " +
        "See src/lib/model/client/client.md."
    );
  }
  if (!instance) {
    throw new Error(
      "The client model has not been built — the /app layout that owns this client " +
        "instance calls initClientModel(). See src/lib/model/client/client.md."
    );
  }
  return instance;
};
