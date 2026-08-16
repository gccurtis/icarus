/**
 * The surface Commands offers, and the values that cross it.
 *
 * A consumer depends on this and on nothing else in the directory. Past the door
 * are a definition, its state, and its methods — none of which this object
 * promised to keep stable.
 *
 * Nothing here names a Svelte component, and nothing here carries display copy.
 * A command's label and description are the command bar's, for the reason a
 * context's are the rail's: rewording or translating either must not change what
 * a chord points at.
 */

/**
 * Every command, as a value.
 *
 * A value rather than only a type because a bound chord will outlive a build:
 * once bindings persist, a stored id written by an older version has to be
 * checked before it is trusted, and `isCommandId` is what drops it. The type is
 * derived from the value, so the two cannot drift.
 *
 * Adding a member forces the registry and the bar's display map to handle it,
 * because both are `Record<CommandId, …>`.
 */
export const COMMAND_IDS = [
  "command-bar.open",
  "tab.close",
  "tab.next",
  "tab.previous"
] as const;

export type CommandId = (typeof COMMAND_IDS)[number];

export const isCommandId = (value: string): value is CommandId =>
  (COMMAND_IDS as readonly string[]).includes(value);

/**
 * One gesture, normalised: `$mod+k`, `$mod+shift+k`, `alt+pagedown`.
 *
 * `$mod` is Control everywhere and Meta on Mac — the one platform branch in the
 * system, and it is resolved by the surface that reads the keyboard rather than
 * stored twice here.
 *
 * Modifiers appear in a fixed order so one gesture has exactly one spelling.
 * Without that the binding map could hold `$mod+shift+k` and `shift+$mod+k` as
 * two keys meaning the same thing, and only one of them would ever fire.
 */
export type Chord = string;

/**
 * A gesture before it is spelled, as the pieces a keyboard event carries.
 *
 * This object exists so the model never sees a `KeyboardEvent`. The view reads
 * the event and fills this in; `chordOf` turns it into the string. Both the
 * dispatcher and, later, the binding editor's capture field go through the same
 * pair, so a captured chord and a dispatched one cannot spell differently.
 */
export type ChordParts = {
  readonly mod: boolean;
  readonly alt: boolean;
  readonly shift: boolean;
  /** As `KeyboardEvent.key`. Case is normalised by `chordOf`, not by the caller. */
  readonly key: string;
};

/**
 * One command: whether it applies, and what it does. Neither half takes an
 * argument.
 *
 * A command is the zero-argument subset of things this application can do. A
 * keystroke cannot supply an argument, so anything needing one is a model method
 * — a command may wrap a method with a fixed argument, and two commands may wrap
 * the same method with different ones.
 *
 * **`enabled` is separate from `run` because the bar greys rather than hides.**
 * With the check inside `run`, the only way to learn whether a command applies
 * would be to run it, and the list would become a menu of items that silently do
 * nothing.
 */
export type Command = {
  enabled(): boolean;
  run(): void;
};

/**
 * What is bound out of the box.
 *
 * `tab.close` is deliberately unbound. `$mod+w` is the obvious chord for it and
 * browsers refuse to give that keystroke up, so binding it by default would ship
 * a shortcut that does nothing on the machines most people run. It stays
 * reachable from the bar — which is where its disabled state is worth seeing
 * anyway — and `bindingsFor` returning nothing for it is a real case the bar has
 * to render.
 *
 * Nothing else is reserved. Once bindings are editable, any gesture may be
 * bound, including ones a browser uses: the dispatcher calls `preventDefault`
 * on everything it matched. What a host reserves is a property of the
 * environment, not of this object, and this object has no way to ask.
 */
export const DEFAULT_BINDINGS: Readonly<Record<Chord, CommandId>> = Object.freeze({
  "$mod+k": "command-bar.open",
  "$mod+pagedown": "tab.next",
  "$mod+pageup": "tab.previous"
});

/**
 * The object the command bar and the dispatcher both read.
 *
 * Two shapes of consumer, one surface: the dispatcher looks a chord up and runs
 * what it finds, the bar enumerates everything and renders each with its state.
 */
export type CommandsModel = {
  /** Every command, in declaration order. What the bar lists. */
  readonly ids: readonly CommandId[];
  /** Whether a command applies right now. The bar greys what returns false. */
  enabled(id: CommandId): boolean;
  /** Runs a command. Throws for an unknown id, and for a disabled one. */
  run(id: CommandId): void;

  /**
   * Chord to command, which is the direction dispatch reads and the direction
   * the uniqueness constraint lives in: one chord cannot mean two things.
   */
  readonly bindings: Readonly<Record<Chord, CommandId>>;
  /** The other direction, derived. A command may have several chords, or none. */
  bindingsFor(id: CommandId): readonly Chord[];

  /**
   * Whether the command bar is showing.
   *
   * It lives here rather than in the view because `command-bar.open` is itself a
   * command, so the thing a command toggles has to be reachable from the
   * registry. It is not per-tab, which is why it is not the workbench's.
   */
  readonly open: boolean;
  /** Closes the bar. What selecting an item, Escape, and a click away all reach. */
  hide(): void;
  toggle(): void;
};
