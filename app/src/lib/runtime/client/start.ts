import { browser } from "$app/environment";
import { createCommands } from "$model/client/commands";
import { createConfiguration } from "$model/client/configuration";
import { createCopilot } from "$model/client/copilot";
import { createResourceRuntimes } from "$model/client/resource-runtimes";
import { createBrowserStorage } from "$model/client/storage";
import { createViewState } from "$model/client/view-state";
import { createWorkbench } from "$model/client/workbench";
import type { ClientModel, ClientModelInput } from "$runtime/client/types";

export type { ClientModel, ClientModelInput } from "$runtime/client/types";
export type {
  Chord,
  ChordParts,
  Command,
  CommandId,
  CommandsModel
} from "$model/client/commands";
export { COMMAND_IDS, DEFAULT_BINDINGS, chordOf, isCommandId } from "$model/client/commands";
export type { ConfigurationModel, ConfigurationSnapshot } from "$model/client/configuration";
export { requiredNumber } from "$model/client/configuration";
export type {
  ClientStorage,
  PersistedClient,
  PersistedPanels,
  PersistedTab,
  PersistedTabOptions,
  PersistedWorkbench
} from "$model/client/storage";
export type {
  Frame,
  InspectionKey,
  ScreenKind,
  Selection,
  SingletonScreen,
  Tab,
  TabId,
  TabTarget,
  ViewStateFor,
  ViewStatePatch,
  WorkbenchModel,
  WorkbenchViewState
} from "$model/client/workbench";
export {
  DEFAULT_FRAME,
  SINGLETON_SCREENS,
  SINGLETON_TARGETS,
  isPermanent,
  screenKindOf
} from "$model/client/workbench";

/**
 * How a client instance comes up: composed, held, handed out — in that order,
 * which is the order this file reads in.
 *
 * A client instance is one browser tab holding the application. The `/app` layout
 * persists, tabs are view state rather than route state, and views do not remount
 * on navigation. One instance, one graph, for that tab's whole life.
 *
 * See [`client.md`](client.md).
 */

/**
 * Composes the graph, in dependency order. Holds nothing.
 *
 * Not exported: `initClientModel` is the only way to build one, and it returns
 * what it built, so a test that wants two graphs calls it twice and asserts on
 * the two values rather than on the instance. A second exported way to stand up
 * a graph is the one failure this file's shape exists to prevent, and exporting
 * it for tests would have been exactly that.
 *
 * Each object is reached through its own door rather than its constructor
 * module, so the set of objects the runtime knows about is the set of doors it
 * imports.
 */
const buildClientModel = ({
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
  // in the graph, so its position here is a reading order rather than a
  // dependency — it would be just as correct first.
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

/**
 * The one graph, for this tab.
 *
 * Module state is safe here *because none of it is shared*. There is no second
 * person inside a tab to leak to, which is the whole reason a shape that would be
 * a defect on the server is correct in this file — and why no other module may
 * hold one.
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
        "See src/lib/runtime/client/client.md."
    );
  }
  if (!instance) {
    throw new Error(
      "The client model has not been built — the /app layout that owns this client " +
        "instance calls initClientModel(). See src/lib/runtime/client/client.md."
    );
  }
  return instance;
};
