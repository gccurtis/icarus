/**
 * The entry for Commands.
 *
 * The composition root takes the constructor; every other object takes the type.
 * Nothing outside this directory reaches past this file, because a definition, a
 * method, and a private type are all things Commands may change without
 * telling anyone.
 */
export type {
  Chord,
  ChordParts,
  Command,
  CommandId,
  CommandsModel
} from "$model/client/commands/types";
export { COMMAND_IDS, DEFAULT_BINDINGS, isCommandId } from "$model/client/commands/types";
export { chordOf } from "$model/client/commands/methods/chord-of";
export { createCommands } from "$model/client/commands/constructor";
