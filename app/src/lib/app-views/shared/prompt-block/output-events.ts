import type { Id } from "$representation/data/types/core/id";

type Listener = () => void;

const eventName = (id: Id<"derivedOutputs">): string => `icarus:prompt-output:${id}`;

const browserTarget = (): EventTarget => {
  if (typeof globalThis.addEventListener !== "function") {
    throw new Error("Prompt output events require a browser event target");
  }
  return globalThis as unknown as EventTarget;
};

/** Tell every mounted inspector of one Derived Output to re-read its shared value. */
export const announcePromptOutput = (
  id: Id<"derivedOutputs">,
  target: EventTarget = browserTarget()
): void => void target.dispatchEvent(new Event(eventName(id)));

/** Document and slide adapters can overlap without owning each other. */
export const observePromptOutput = (
  id: Id<"derivedOutputs">,
  listener: Listener,
  target: EventTarget = browserTarget()
): (() => void) => {
  const name = eventName(id);
  target.addEventListener(name, listener);
  return () => target.removeEventListener(name, listener);
};
