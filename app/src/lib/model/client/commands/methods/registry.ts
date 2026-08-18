import type { CommandsState } from "$model/client/commands/definition.svelte";
import { setOpen } from "$model/client/commands/methods/shared/set-open";
import type { Command, CommandId } from "$model/client/commands/types";
import type { WorkbenchModel } from "$model/client/workbench";
import { isPermanent } from "$model/client/workbench";

/**
 * Every command, built over the state it acts on.
 *
 * `Record<CommandId, Command>` rather than a partial map, so adding an id fails
 * to compile until it does something. There is no separate registry file to keep
 * in step with the union, and no runtime branch for a command that was declared
 * and never defined.
 *
 * **Nothing here is read at build time.** Every body is a closure, so this can be
 * built during the state's own construction and still reach fields the state
 * assigns afterwards.
 *
 * A file rather than a directory while one file tells the truth. It becomes a
 * directory when it owns supporting flow — restoring persisted bindings is what
 * brings that.
 */
export const buildRegistry = (state: CommandsState): Record<CommandId, Command> => ({
  "command-bar.open": {
    // Always available. A bar that could not be opened from the bar's own
    // shortcut would have no way back once a user closed it without a mouse.
    enabled: () => true,
    run: () => setOpen(state, !state.open)
  },

  "tab.close": {
    enabled: () => !isPermanent(state.workbench.active),
    run: () => state.workbench.close(state.workbench.activeId)
  },

  "tab.next": {
    enabled: () => state.workbench.tabs.length > 1,
    run: () => step(state, 1)
  },

  "tab.previous": {
    enabled: () => state.workbench.tabs.length > 1,
    run: () => step(state, -1)
  }
});

/**
 * Moves the active tab by one, wrapping at both ends.
 *
 * Computed here from the public surface rather than added to the workbench,
 * because these two commands are its only caller. A second caller is what would
 * make it the workbench's — cycling is a fact about a tab list, and the day
 * something else needs it is the day one object should own it.
 *
 * Adding `tabs.length` before the modulo is what makes `-1` wrap to the end
 * rather than producing a negative index.
 *
 * The bar closes first. Cycling from inside the bar leaves it showing a list
 * whose enabled states have all moved underneath it, which reads as a glitch
 * rather than as a tab change.
 */
const step = (state: CommandsState, delta: number): void => {
  setOpen(state, false);
  cycle(state.workbench, delta);
};

const cycle = (workbench: WorkbenchModel, delta: number): void => {
  const { tabs, activeId } = workbench;
  const index = tabs.findIndex((tab) => tab.id === activeId);
  const next = (index + delta + tabs.length) % tabs.length;

  workbench.activate(tabs[next].id);
};
