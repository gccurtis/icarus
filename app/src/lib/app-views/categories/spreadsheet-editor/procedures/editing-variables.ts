import { parseTyped } from "$app-views/categories/spreadsheet-editor/procedures/values";
import type {
  VariableRecord,
  VariableRegister
} from "$app-views/categories/spreadsheet-editor/procedures/variables.svelte";

export type VariableType = VariableRecord["type"];

export type Rename = {
  readonly register: VariableRegister;
  readonly record: VariableRecord;
  readonly name: string;
  readonly type: VariableType;
  readonly literal: string;
  readonly refused: (reason: string | undefined) => void;
  readonly opened: (name: string) => void;
};

/**
 * A new variable, under the first name nothing else has taken.
 *
 * Named rather than left blank because a variable is reached by name: an unnamed
 * one is a row nothing can refer to, and the reader renames it in the lens the
 * moment it opens.
 */
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

/**
 * What the lens holds, saved.
 *
 * A rename is a save under the new name and a delete of the old one, in that
 * order: the value exists under both names for an instant, and never under
 * neither. Changing only the letter case is the exception — the same name — and
 * deleting the old one there would delete what was just written.
 */
export const savesTheVariable = async (asked: Rename): Promise<void> => {
  const { register, record } = asked;
  const wanted = asked.name.trim();
  const parsed = parseTyped(asked.literal);

  const answer = await register.save({
    name: wanted,
    value: parsed.kind === "value" ? parsed.value : { kind: "empty" },
    type: asked.type
  });
  if (!answer.saved) {
    asked.refused(answer.reason);
    return;
  }

  asked.refused(undefined);
  if (wanted === record.name) return;
  if (wanted.toLowerCase() !== record.name.toLowerCase()) await register.remove(record.name);
  asked.opened(wanted);
};

export const removesTheVariable = async (
  register: VariableRegister,
  name: string,
  cleared: () => void
): Promise<void> => {
  await register.remove(name);
  cleared();
};
