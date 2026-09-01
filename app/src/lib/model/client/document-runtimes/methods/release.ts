import type { DocumentRuntimesState, Runtime } from "$model/client/document-runtimes/definition.svelte";
import { detach } from "$model/client/document-runtimes/methods/shared/detach";

/**
 * Close one document, and hand it back so the caller can submit what it holds.
 *
 * **Release submits; disposal is never a silent discard.** This detaches and
 * returns, and the definition awaits the flush — because closing is a
 * synchronous gesture and the strip must not lag behind the click.
 *
 * An id with no open runtime is a no-op rather than a throw. The workbench calls
 * this when the *last* tab on a document closes, and "last" is a count it can
 * get wrong at the edges; a throw there would take the frame down over a
 * bookkeeping slip that costs nothing.
 */
export const release = (state: DocumentRuntimesState, id: string): Runtime | undefined =>
  detach(state, id);
