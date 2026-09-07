import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { nameRefusal } from "$representation/data/behavior/formulas/names";
import type { Id } from "$representation/data/types/core/id";

import { validateSaveVariable } from "$capabilities/variables/api/save-variable/validate-save-variable";
import { recordOf, sameName, variableRowsOf } from "$capabilities/variables/api/shared/rows";
import type { SaveVariableResult } from "$capabilities/variables/types/variables";

/** Whether a declared type is a promise this value keeps. */
const satisfies = (type: string, kind: string): boolean => type === "any" || type === kind;

export const saveVariable = async (input: unknown): Promise<SaveVariableResult> => {
  const scope = await requireScope();
  const asked = validateSaveVariable(input);

  const refused = nameRefusal(asked.name);
  if (refused !== undefined) return { saved: false, reason: refused };
  if (!satisfies(asked.type, asked.value.kind)) {
    return { saved: false, reason: `A ${asked.type} variable cannot hold ${asked.value.kind}.` };
  }

  const store = serverModel().store;
  const projectId = scope.projectId as Id<"projects">;
  const at = Date.now();

  const fields = {
    projectId,
    name: asked.name,
    value: asked.value,
    type: asked.type,
    ...(asked.description === undefined ? {} : { description: asked.description }),
    createdBy: { kind: "user" as const, userId: scope.userId as Id<"users"> },
    updatedAt: at
  };

  const held = variableRowsOf(store, projectId).find((row) => sameName(row.name, asked.name));
  if (held === undefined) {
    const id = store.create("variables", fields);
    return { saved: true, variable: recordOf({ ...fields, _id: id, _creationTime: at } as never) };
  }

  const next = { ...held, ...fields, createdBy: held.createdBy };
  store.update(`variables.${held._id}`, next);
  return { saved: true, variable: recordOf(next) };
};
