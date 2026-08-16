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
import type { WorkbenchModel } from "$model/client/workbench";

/**
 * The instance's state, and the only thing a method is handed.
 *
 * A class rather than a bag of fields on `Commands` because `open` is a
 * primitive: a method cannot reassign it through a value it was passed unless
 * something owns the binding. This owns it.
 *
 * **The registry is assigned after the fields it reaches.** Every command body
 * is a closure, so `buildRegistry(this)` reads nothing during construction — but
 * the assignment is written last anyway, because a future command that did read
 * something eagerly would otherwise fail in a way that points at the wrong file.
 *
 * `workbench` is assigned explicitly rather than declared as a parameter
 * property, so the order of the two assignments is visible here rather than
 * decided by how class fields happen to be emitted.
 */
export class CommandsState {
  open = $state(false);

  readonly workbench: WorkbenchModel;
  readonly registry: Record<CommandId, Command>;
  /** Defaults only. Editing these is what brings persistence with it. */
  readonly bindings: Readonly<Record<Chord, CommandId>> = DEFAULT_BINDINGS;

  constructor(workbench: WorkbenchModel) {
    this.workbench = workbench;
    this.registry = buildRegistry(this);
  }
}

/**
 * `.svelte.ts` because the state it holds declares `$state`, and runes do not
 * compile in a plain `.ts`. Fields are private and the public surface is
 * getters: reassigning an exported `let` does not propagate across a module
 * boundary, but reading through a getter does — which is what lets the bar's
 * `$derived` see `open` change.
 *
 * Every body here is one call. The surface is what this file is for; the flow
 * behind it lives in `methods/`.
 */
export class Commands implements CommandsModel {
  #state: CommandsState;

  constructor(workbench: WorkbenchModel) {
    this.#state = new CommandsState(workbench);
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
