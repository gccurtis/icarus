import { createCommands } from "$model/client/commands";
import { createConfiguration } from "$model/client/configuration";
import { createCopilot } from "$model/client/copilot";
import { createResourceRuntimes } from "$model/client/resource-runtimes";
import { createBrowserStorage } from "$model/client/storage";
import type { ClientModel, ClientModelInput } from "$model/client/types";
import { createViewState } from "$model/client/view-state";
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
export const buildClientModel = ({
  project,
  configuration,
  storage
}: ClientModelInput): ClientModel => {
  // Configuration first: it depends on nothing, and objects built below it read
  // their tuned values during their own construction.
  const settings = createConfiguration(configuration);

  // Storage is built and, for now, read by nothing. The workbench does not
  // persist while its stored shape is unsettled, and storage holds exactly that
  // one section — so it stands intact and unused rather than being torn out and
  // rebuilt when persistence returns. See workbench/workbench.md.
  const store = storage ?? createBrowserStorage(project);

  // Before the workbench, which borrows it: the workbench attaches a runtime
  // when a resource tab opens and releases it when the last one closes.
  const resourceRuntimes = createResourceRuntimes(settings);

  const workbench = createWorkbench(resourceRuntimes);

  // Borrows nothing: what is open is decided by the person, not by anything else
  // in the graph, so it could be built first. It is built here to keep the
  // reading order of this function the order the objects were added in.
  const viewState = createViewState(project);

  return {
    project,
    viewState,
    configuration: settings,
    storage: store,
    resourceRuntimes,
    workbench,
    commands: createCommands(workbench),
    copilot: createCopilot(workbench),

    /**
     * Releases in reverse construction order, so an object is never torn down
     * while something built after it still holds a reference.
     *
     * `releaseAll` submits every buffer on the way out — disposal is never a
     * silent discard. It is synchronous by design: a browser gives a closing tab
     * very little time, and awaiting three submits in sequence is how the third
     * one does not happen.
     */
    close: () => {
      // The workbench first, so its tabs hand their runtimes back before the
      // register disposes what is left. `closeAll` calls `releaseAll` itself;
      // the second call is what covers a runtime attached without a tab, and it
      // is a no-op when there is none.
      workbench.closeAll();
      resourceRuntimes.releaseAll();
    }
  };
};
