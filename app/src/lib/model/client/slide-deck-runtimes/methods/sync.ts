import { readSlideDeckBody } from "$capabilities/slide-deck/index.remote";
import type { Runtime } from "$model/client/slide-deck-runtimes/definition.svelte";
import { emptyBody } from "$model/client/slide-deck-runtimes/methods/shared/empty-body";

/**
 * A runtime with nothing of its own outstanding is a reader, and only a reader
 * may take the leader's word for what the deck says. Checked again after the
 * read, because a drag during the round trip makes the answer stale before it
 * lands.
 */
const settled = (runtime: Runtime): boolean => runtime.buffer.length === 0 && !runtime.inFlight;

/**
 * Re-read the leader body.
 *
 * The read is refreshed rather than awaited: a query answers from the client's
 * cache otherwise, and a deck would never advance past the answer the page was
 * loaded with.
 */
export const sync = async (runtime: Runtime): Promise<void> => {
  if (!settled(runtime)) return;

  try {
    const question = readSlideDeckBody({ resourceId: runtime.id });
    await question.refresh();
    const found = question.ready ? question.current : await question;

    if (!settled(runtime)) return;

    runtime.body = found === null ? emptyBody() : found.body;
    runtime.revision = found === null ? 0 : found.revision;
    runtime.sync = "saved";
  } catch {
    if (runtime.body === undefined) runtime.sync = "error";
  }
};
