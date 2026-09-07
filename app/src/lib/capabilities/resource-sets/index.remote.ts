import { command, query } from "$app/server";

import { createResourceSet as createResourceSetProcedure } from "$capabilities/resource-sets/api/create-resource-set/create-resource-set";
import { readResourceSets as readResourceSetsProcedure } from "$capabilities/resource-sets/api/read-resource-sets/read-resource-sets";
import { removeResourceSet as removeResourceSetProcedure } from "$capabilities/resource-sets/api/remove-resource-set/remove-resource-set";
import { updateResourceSet as updateResourceSetProcedure } from "$capabilities/resource-sets/api/update-resource-set/update-resource-set";

export const readResourceSets = query(readResourceSetsProcedure);

export const createResourceSet = command("unchecked", async (input) => {
  const result = await createResourceSetProcedure(input);
  await readResourceSets().refresh();
  return result;
});

export const updateResourceSet = command("unchecked", async (input) => {
  const result = await updateResourceSetProcedure(input);
  await readResourceSets().refresh();
  return result;
});

export const removeResourceSet = command("unchecked", async (input) => {
  const result = await removeResourceSetProcedure(input);
  await readResourceSets().refresh();
  return result;
});

export type {
  CreateResourceSetInput,
  CreateResourceSetResult,
  ReadResourceSetsResult,
  RemoveResourceSetInput,
  RemoveResourceSetResult,
  ResourceSetItem,
  ResourceSetUnavailable,
  UpdateResourceSetInput,
  UpdateResourceSetPatch,
  UpdateResourceSetResult
} from "$capabilities/resource-sets/types/resource-sets";
