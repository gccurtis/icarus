import type { ReadProjectPersonInput } from "$capabilities/project/types/project";
import { projectInput, projectRowId } from "$capabilities/project/api/shared/input";

export const validateReadProjectPerson = (input: unknown): ReadProjectPersonInput => {
  const message = "project/read-project-person: only one exact current users id is accepted";
  const asked = projectInput(input, ["userId"], message);
  return { userId: projectRowId(asked.userId, "users", message) };
};
