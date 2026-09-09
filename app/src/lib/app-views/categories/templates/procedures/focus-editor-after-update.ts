import { tick } from "svelte";

/** Focuses and selects an editor after Svelte has mounted it. */
export const focusEditorAfterUpdate = async (
  editor: () => HTMLInputElement | HTMLTextAreaElement | null
): Promise<void> => {
  await tick();
  editor()?.focus();
  editor()?.select();
};
