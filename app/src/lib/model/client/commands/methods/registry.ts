import type { CommandsState } from "$model/client/commands/definition.svelte";
import { setOpen } from "$model/client/commands/methods/shared/set-open";
import type { Command, CommandId } from "$model/client/commands/types";
import type { WorkspaceStateModel } from "$model/client/workspace-state";
import { isSingleton } from "$model/client/workspace-state";

export const buildRegistry = (state: CommandsState): Record<CommandId, Command> => ({
  "command-bar.open": {
    enabled: () => true,
    run: () => setOpen(state, !state.open)
  },

  "tab.close": {
    enabled: () => !isSingleton(state.view.active.category),
    run: () => state.view.close(state.view.activeId)
  },

  "tab.next": {
    enabled: () => state.view.tabs.length > 1,
    run: () => step(state, 1)
  },

  "tab.previous": {
    enabled: () => state.view.tabs.length > 1,
    run: () => step(state, -1)
  }
});

const step = (state: CommandsState, delta: number): void => {
  setOpen(state, false);
  cycle(state.view, delta);
};

const cycle = (view: WorkspaceStateModel, delta: number): void => {
  const { tabs, activeId } = view;
  const index = tabs.findIndex((tab) => tab.id === activeId);
  const next = (index + delta + tabs.length) % tabs.length;

  view.activate(tabs[next].id);
};
