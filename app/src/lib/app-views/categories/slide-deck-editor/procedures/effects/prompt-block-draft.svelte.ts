import type { PromptBlockState } from "$app-views/categories/slide-deck-editor/inspector/prompt-block.state.svelte";
import type { PromptBlock } from "$representation/data/types/content/content-block";

export const synchronizePromptBlockDraft = (
  state: PromptBlockState,
  selected: () => PromptBlock | undefined
): void => {
  $effect(() => {
    const block = selected();
    state.select(block?.id, block?.prompt);
  });
};
