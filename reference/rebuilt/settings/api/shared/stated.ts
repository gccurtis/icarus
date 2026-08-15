import { error } from "@sveltejs/kit";
import { SettingsError } from "$settings/errors";

/**
 * Lets a stated refusal reach the browser, and keeps a fault from doing so.
 *
 * Without this, a `SettingsError` thrown inside a remote function surfaces to
 * the client as `500 Internal Error` — kit hides thrown values on purpose, and
 * cannot tell one of ours from a null dereference. The result is that a view has
 * no way to distinguish "that key is not valid" from "the server is broken", so
 * the only honest thing it could show is the second.
 *
 * A code is a decision this capability made and states, and stating it is the
 * whole point of having codes. A fault is not ours to describe and stays a 500
 * with nothing in it.
 *
 * **Only remote wrappers call this.** A server-side caller — a load function,
 * another capability — catches `SettingsError` directly and should not be handed
 * an HTTP status it has no use for. That is why the translation lives at the
 * boundary rather than inside `record` or the procedures.
 *
 * It sits in this capability rather than somewhere shared because it is the only
 * capability so far. The second one that needs it is when it moves.
 */
export const stated = async <T>(run: () => Promise<T>): Promise<T> => {
  try {
    return await run();
  } catch (caught) {
    if (caught instanceof SettingsError) {
      // 400 rather than 422: the payload was understood and refused, and no
      // client benefits from the distinction.
      error(400, `${caught.code}: ${caught.message}`);
    }
    throw caught;
  }
};
