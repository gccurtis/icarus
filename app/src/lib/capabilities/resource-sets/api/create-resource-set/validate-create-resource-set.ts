import {
  descriptionOf,
  fieldsOf,
  has,
  nameOf,
  only,
  resourceSetOf
} from "$capabilities/resource-sets/api/shared/validation";
import type { CreateResourceSetInput } from "$capabilities/resource-sets/types/resource-sets";

export const validateCreateResourceSet = (input: unknown): CreateResourceSetInput => {
  const fields = fieldsOf(input, "create-resource-set");
  only(fields, ["name", "description", "set"], "create-resource-set");
  const description = has(fields, "description")
    ? descriptionOf(fields.description, "create-resource-set")
    : undefined;
  return {
    name: nameOf(fields.name, "create-resource-set"),
    ...(description === undefined || description === "" ? {} : { description }),
    set: resourceSetOf(fields.set, "create-resource-set")
  };
};
