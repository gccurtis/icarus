import type { PersistedTabOptions } from "$model/client/storage";
import type { TabOptions } from "$model/client/workbench/types";
import { DEFAULTS, isContextId } from "$model/client/workbench/types";

/**
 * Stored options, as options this workbench will accept.
 *
 * Storage already proved these values *could be* what they claim — an integer
 * width, a string id. What it cannot know is what this build still recognises,
 * because knowing would make the stored format follow every domain change. This
 * is where that judgment is made, and it is the one input the object takes with
 * no caller to blame.
 *
 * Geometry is merged over `DEFAULTS` rather than trusted whole, so a field added
 * to `Panels` after a document was written has a value on the first load.
 */
export const storedOptions = (stored: PersistedTabOptions): Partial<TabOptions> => {
  const patch: Partial<TabOptions> = {};

  // A stored id can outlive the context it named. Dropping it falls back to the
  // kind's default, which is a reset rail where a crash is not.
  if (stored.contextId !== undefined && isContextId(stored.contextId)) {
    patch.contextId = stored.contextId;
  }
  if (stored.panels) {
    patch.panels = { ...DEFAULTS, ...stored.panels };
  }

  return patch;
};
