import type { GeneralResourceType } from "$revisions/types/resource";
import type { ResourceRuntimesState, Runtime } from "$model/client/resource-runtimes/definition.svelte";
import { detach } from "$model/client/resource-runtimes/methods/shared/detach";
import { runtimeKey } from "$model/client/resource-runtimes/methods/shared/runtime-key";

/**
 * Close one resource, and hand it back so the caller can submit what it holds.
 *
 * **Release submits; disposal is never a silent discard.** This detaches and
 * returns, and the definition awaits the flush — because closing is a
 * synchronous gesture and the strip must not lag behind the click.
 *
 * A key with no open runtime is a no-op rather than a throw. The workbench calls
 * this when the *last* tab on a resource closes, and "last" is a count it can
 * get wrong at the edges; a throw there would take the frame down over a
 * bookkeeping slip that costs nothing.
 */
export const release = (
  state: ResourceRuntimesState,
  type: GeneralResourceType,
  id: string
): Runtime | undefined => detach(state, runtimeKey(type, id));
