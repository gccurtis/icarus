import { readDocumentBody } from "$capabilities/document/index.remote";
import type { Runtime } from "$model/client/document-runtimes/definition.svelte";
import { emptyBody } from "$model/client/document-runtimes/methods/shared/empty-body";

/**
 * A runtime with nothing of its own outstanding is a reader, and only a reader
 * may take the leader's word for what the document says. Checked again after the
 * read, because a keystroke during the round trip makes the answer stale before
 * it lands.
 */
const settled = (runtime: Runtime): boolean =>
  runtime.buffer.length === 0 && !runtime.inFlight;

/**
 * Re-read the leader body.
 *
 * The read is refreshed rather than awaited, because a query answers from the
 * client's cache otherwise and a document would never advance past the answer
 * the page was loaded with.
 */
export const sync = async (runtime: Runtime): Promise<void> => {
  if (!settled(runtime)) return;

  try {
    const question = readDocumentBody({ resourceId: runtime.id });
    await question.refresh();
    const found = question.ready ? question.current : await question;

    if (!settled(runtime)) return;

    runtime.body = found === null ? emptyBody() : found.body;
    runtime.revision = found === null ? 0 : found.revision;
    if (runtime.sync !== "needs-review") runtime.sync = "saved";
  } catch {
    if (runtime.body === undefined) runtime.sync = "error";
  }
};
