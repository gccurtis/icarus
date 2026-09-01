import type { ResourceSetExpression, Selector } from "$shared/types/resource-set-expression";
import { address } from "$model/client/copilot/methods/address";
import { attach } from "$model/client/copilot/methods/attach";
import { blocked } from "$model/client/copilot/methods/blocked";
import { clearAttachments } from "$model/client/copilot/methods/clear-attachments";
import { clearScope } from "$model/client/copilot/methods/clear-scope";
import { detach } from "$model/client/copilot/methods/detach";
import { dropSelector } from "$model/client/copilot/methods/drop-selector";
import { exclude } from "$model/client/copilot/methods/exclude";
import { focus } from "$model/client/copilot/methods/focus";
import { include } from "$model/client/copilot/methods/include";
import { selectPersona } from "$model/client/copilot/methods/select-persona";
import { sent } from "$model/client/copilot/methods/sent";
import { setMode } from "$model/client/copilot/methods/set-mode";
import { write } from "$model/client/copilot/methods/write";
import type {
  Attachment,
  Blocked,
  CopilotModel,
  Destination,
  Mode
} from "$model/client/copilot/types";
import { emptyScope } from "$model/client/copilot/types";

/**
 * The instance's state, and the only thing a method is handed.
 *
 * A class rather than a bag of fields on `Copilot` because every field here is a
 * primitive or a whole-value replacement: a method cannot reassign one through a
 * value it was passed unless something owns the binding. This owns them.
 *
 * The workbench is held rather than read at construction, because what the
 * active tab is changes. It is borrowed — the root built it and the root owns
 * it — and today nothing here reads it: the screen describes its own selection
 * as a `part` selector and the inspector passes it in. The dependency is
 * declared because it is what the inspector's scope editor will resolve through,
 * and because the composition order the standard checks has to say so.
 */
export class CopilotState {
  mode = $state<Mode>("ask");
  destination = $state<Destination>({ kind: "new" });
  personaId = $state<string | undefined>(undefined);
  draft = $state("");

  /**
   * Replaced wholesale on every write — `normalize` returns a new expression —
   * so `$state.raw` is exactly right: nothing mutates into it, and a deep proxy
   * over two selector lists would cost on every read for granularity nothing
   * uses.
   */
  scope = $state.raw<ResourceSetExpression>(emptyScope());
  attachments = $state.raw<readonly Attachment[]>([]);

  focusRequests = $state(0);

}

/**
 * `.svelte.ts` because the state it holds declares `$state`, and runes do not
 * compile in a plain `.ts`. Fields are private and the public surface is
 * getters: reassigning an exported `let` does not propagate across a module
 * boundary, but reading through a getter does.
 *
 * Every body here is one call. The surface is what this file is for — the flow
 * behind it lives in `methods/`, where it can be read one method at a time.
 */
export class Copilot implements CopilotModel {
  readonly #state: CopilotState;

  constructor() {
    this.#state = new CopilotState();
  }

  get mode(): Mode {
    return this.#state.mode;
  }

  get destination(): Destination {
    return this.#state.destination;
  }

  get personaId(): string | undefined {
    return this.#state.personaId;
  }

  get draft(): string {
    return this.#state.draft;
  }

  get scope(): ResourceSetExpression {
    return this.#state.scope;
  }

  get attachments(): readonly Attachment[] {
    return this.#state.attachments;
  }

  get focusRequests(): number {
    return this.#state.focusRequests;
  }

  get blocked(): Blocked {
    return blocked(this.#state);
  }

  setMode(mode: Mode): void {
    setMode(this.#state, mode);
  }

  write(text: string): void {
    write(this.#state, text);
  }

  selectPersona(id?: string): void {
    selectPersona(this.#state, id);
  }

  address(destination: Destination): void {
    address(this.#state, destination);
  }

  include(selector: Selector): void {
    include(this.#state, selector);
  }

  exclude(selector: Selector): void {
    exclude(this.#state, selector);
  }

  dropSelector(selector: Selector): void {
    dropSelector(this.#state, selector);
  }

  clearScope(): void {
    clearScope(this.#state);
  }

  attach(attachment: Attachment): void {
    attach(this.#state, attachment);
  }

  detach(attachment: Attachment): void {
    detach(this.#state, attachment);
  }

  clearAttachments(): void {
    clearAttachments(this.#state);
  }

  sent(destination: Destination): void {
    sent(this.#state, destination);
  }

  focus(): void {
    focus(this.#state);
  }
}
