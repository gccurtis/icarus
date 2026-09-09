import type { PromptBlockState } from "$app-views/categories/slide-deck-editor/inspector/prompt-block.state.svelte";

export const synchronizePromptBlockDraft = (
  state: PromptBlockState,
  selected: () => string | undefined
): void => {
  $effect(() => state.select(selected()));
};
