import { browser } from "$app/environment";
import { buildClientModel } from "$runtime/client/models/build";
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

let instance: ClientModel | undefined;

export const initClientModel = (input: ClientModelInput): ClientModel =>
  (instance = buildClientModel(input));

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
