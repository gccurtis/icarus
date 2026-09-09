import { loadVariables, variablesLoaded } from "$app-views/categories/spreadsheet-editor/procedures/variables.svelte";

/**
 * The project's named values, fetched once for whoever asks first.
 *
 * Two panels show variables and either may be opened alone, so the fetch cannot
 * belong to one of them. Asking again while the register already holds the
 * project is the no-op that makes it safe for both to ask.
 */
export const loadsTheVariables = (project: () => string): void => {
  $effect(() => {
    const held = project();
    if (!variablesLoaded(held)) void loadVariables(held);
  });
};
