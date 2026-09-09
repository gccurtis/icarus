import type { VariableRegister } from "$app-views/categories/spreadsheet-editor/procedures/variables.svelte";

/**
 * The project's named values, fetched once for whoever asks first.
 *
 * Two panels show variables and either may be opened alone, so the fetch cannot
 * belong to one of them. Asking again while the register already holds them is
 * the no-op that makes it safe for both to ask.
 */
export const loadsTheVariables = (register: VariableRegister): void => {
  $effect(() => {
    if (!register.loaded) void register.load();
  });
};
