import { error } from "@sveltejs/kit";
import { RichContentError } from "$rich-content/errors";

/**
 * Lets a stated refusal reach the browser, and keeps a fault from doing so.
 *
 * Without this, a `RichContentError` thrown inside a remote function surfaces to the
 * client as `500 Internal Error` — kit hides thrown values on purpose and cannot
 * tell one of ours from a null dereference. A view is then unable to distinguish
 * "that input was refused" from "the server is broken", so the only honest thing
 * it can show is the second.
 *
 * **Only remote wrappers call this.** A server-side caller catches
 * `RichContentError` directly and has no use for an HTTP status, which is why the
 * translation lives at the boundary rather than in `record` or the procedures.
 */
export const stated = async <T>(run: () => Promise<T>): Promise<T> => {
  try {
    return await run();
  } catch (caught) {
    if (caught instanceof RichContentError) {
      error(400, `${caught.code}: ${caught.message}`);
    }
    throw caught;
  }
};
