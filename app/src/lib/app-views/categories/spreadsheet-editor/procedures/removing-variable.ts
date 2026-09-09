import type { VariableRegister } from "$app-views/categories/spreadsheet-editor/procedures/variables.svelte";

export const removesTheVariable = async (
  register: VariableRegister,
  name: string,
  cleared: () => void
): Promise<void> => {
  await register.remove(name);
  cleared();
};
