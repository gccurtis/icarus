import { bindingsFor } from "$model/client/commands/methods/bindings-for";
import { enabled } from "$model/client/commands/methods/enabled";
import { hide } from "$model/client/commands/methods/hide";
import { buildRegistry } from "$model/client/commands/methods/registry";
import { run } from "$model/client/commands/methods/run";
import { toggle } from "$model/client/commands/methods/toggle";
import type {
  Chord,
  Command,
  CommandId,
  CommandsModel
} from "$model/client/commands/types";
import { COMMAND_IDS, DEFAULT_BINDINGS } from "$model/client/commands/types";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

export class CommandsState {
  open = $state(false);

  readonly view: WorkspaceStateModel;
  readonly registry: Record<CommandId, Command>;
  readonly bindings: Readonly<Record<Chord, CommandId>> = DEFAULT_BINDINGS;

  constructor(view: WorkspaceStateModel) {
    this.view = view;
    this.registry = buildRegistry(this);
  }
}

export class Commands implements CommandsModel {
  #state: CommandsState;

  constructor(view: WorkspaceStateModel) {
    this.#state = new CommandsState(view);
  }

  get ids(): readonly CommandId[] {
    return COMMAND_IDS;
  }

  enabled(id: CommandId): boolean {
    return enabled(this.#state, id);
  }

  run(id: CommandId): void {
    run(this.#state, id);
  }

  get bindings(): Readonly<Record<Chord, CommandId>> {
    return this.#state.bindings;
  }

  bindingsFor(id: CommandId): readonly Chord[] {
    return bindingsFor(this.#state, id);
  }

  get open(): boolean {
    return this.#state.open;
  }

  hide(): void {
    hide(this.#state);
  }

  toggle(): void {
    toggle(this.#state);
  }
}
