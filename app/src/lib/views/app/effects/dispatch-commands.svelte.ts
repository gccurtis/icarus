import type { CommandsModel } from "$model/client";
import { chordOf } from "$model/client";

/**
 * Turns keystrokes into commands, for as long as the frame is mounted.
 *
 * Trigger: a `keydown` anywhere in the document.
 * Writes: nothing of its own — it calls `run`, and the command writes.
 * Cleanup: removes the listener. It is on `window` rather than in the frame's
 * markup because a shortcut has to work wherever focus is, including in a panel
 * that has not been built yet.
 *
 * **The DOM stops here.** The model never sees a `KeyboardEvent`: this reads the
 * event into `ChordParts` and `chordOf` spells them. That is what keeps the
 * command registry testable without a browser, and it is the same function the
 * binding editor will use to capture a chord — so a gesture recorded one way and
 * dispatched the other cannot disagree.
 *
 * **`$mod` is resolved here, not stored twice.** A binding says `$mod+k`; on this
 * machine that is Control or Meta, and accepting either is deliberate rather than
 * lax. A user on a Mac keyboard plugged into a Linux box means the same thing by
 * both.
 */
export const dispatchCommands = (commands: CommandsModel): void => {
  $effect(() => {
    const onKeydown = (event: KeyboardEvent) => {
      // A held key repeats; a command is one intent per press.
      if (event.repeat) return;

      const chord = chordOf({
        mod: event.ctrlKey || event.metaKey,
        alt: event.altKey,
        shift: event.shiftKey,
        key: event.key
      });

      const id = commands.bindings[chord];
      if (!id) return;

      /**
       * `preventDefault` only once a binding matched, so every unbound gesture
       * still reaches the browser and the page beneath. Doing it before the
       * lookup would swallow typing.
       *
       * A bound chord always takes the keystroke, including one the browser
       * wanted. What a host reserves is the host's business, and there is
       * nothing here that could ask it.
       */
      event.preventDefault();

      // The bar greys what is disabled and this refuses it, because `run`
      // throws rather than no-ops — a chord bound to an inapplicable command is
      // an ordinary state, not a defect.
      if (!commands.enabled(id)) return;

      commands.run(id);
    };

    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  });
};
