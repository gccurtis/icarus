import { createBrowserStorage } from "$model/client/storage";
import type { ClientModel, ClientModelInput } from "$model/client/types";
import { createWorkbench } from "$model/client/workbench";

/**
 * Composes the client graph, in dependency order.
 *
 * Pure composition over its input, and directly callable: a test builds two whole
 * graphs and proves they share nothing, which is the assertion this shape exists
 * for. It is not an application-facing alternative to `clientModel()` — the root
 * and tests call it, routes and views do not.
 *
 * Each leaf is reached through its own door rather than through its constructor
 * module, so the set of objects a root knows about is the set of doors it
 * imports.
 */
export const buildClientModel = ({ project, storage }: ClientModelInput): ClientModel => {
  // Storage first: the workbench restores from it during its own construction.
  const store = storage ?? createBrowserStorage(project);

  return {
    project,
    storage: store,
    workbench: createWorkbench(store)
  };
};
