import type { PromptBlock } from "$representation/data/types/content/content-block";
import type { PresentationOp } from "$representation/data/types/presentations/op";

/** The represented question while an unlinked block is its sole owner. */
export const promptDefinitionOps = (block: PromptBlock, prompt: string): PresentationOp[] => {
  if (block.derivedOutputId !== undefined) return [];
  const next = prompt.trim() === "" ? undefined : prompt;
  if ((next ?? null) === (block.prompt ?? null)) return [];
  return [{
    op: "set",
    target: "block",
    path: `${block.id}/prompt`,
    value: next ?? null,
    was: block.prompt ?? null
  }];
};
