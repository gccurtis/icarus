import type { Id } from "$representation/data/types/core/id";

type Listener = () => void;

const listeners = new Map<Id<"derivedOutputs">, Set<Listener>>();

/** Tell every mounted inspector of one Derived Output to re-read its shared value. */
export const announcePromptOutput = (id: Id<"derivedOutputs">): void => {
  for (const listener of listeners.get(id) ?? []) listener();
};

/** Document and slide adapters can overlap without owning each other. */
export const observePromptOutput = (
  id: Id<"derivedOutputs">,
  listener: Listener
): (() => void) => {
  const held = listeners.get(id) ?? new Set<Listener>();
  held.add(listener);
  listeners.set(id, held);

  return () => {
    held.delete(listener);
    if (held.size === 0) listeners.delete(id);
  };
};
