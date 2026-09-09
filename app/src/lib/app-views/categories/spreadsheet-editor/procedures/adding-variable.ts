import type { VariableRegister } from "$app-views/categories/spreadsheet-editor/procedures/variables.svelte";

/** Create a variable under the first project-local name nothing has taken. */
export const addsAVariable = async (
  register: VariableRegister,
  opened: (name: string) => void
): Promise<void> => {
  const taken = new Set(register.records.map((variable) => variable.name.toLowerCase()));
  let index = 1;
  while (taken.has(`variable${index}`)) index += 1;

  const wanted = `variable${index}`;
  const answer = await register.save({ name: wanted, value: { kind: "empty" }, type: "any" });
  if (answer.saved) opened(wanted);
};
