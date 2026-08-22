import { isSingleton, type Tab, type Target } from "$model/client/view-state/types";

/**
 * The whole definition of "already open".
 *
 * One function, called by `open` to look for a match and by nothing else, so
 * there is exactly one answer to a question three surfaces ask. A second
 * definition anywhere would be a second answer, and the two would disagree the
 * first time a screen gained an identity.
 *
 * **Three cases, and the third is the interesting one.** A singleton is one per
 * project, so its screen is the whole key. A resource tab is keyed by what it
 * edits, so two documents are two tabs and one document reached twice is one. A
 * launcher has no identity at all — `undefined` — so it never dedupes: open five
 * and get five, which is what a launcher is for.
 */
export const targetKey = (target: Target | Tab): string | undefined => {
  if (isSingleton(target.screen)) return target.screen;
  if (target.resourceId !== undefined) return `${target.screen}:${target.resourceId}`;
  return undefined;
};
