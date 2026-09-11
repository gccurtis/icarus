import type { ReadPresentationBodyInput } from "$capabilities/presentation/types/read-presentation-body";
import {
  hasExactFields,
  isStoredRowId,
  storedFields
} from "$representation/data/behavior/core/stored";

/** Refuses anything the procedure could not act on. Throws; it never returns a partial. */
export const validateReadPresentationBody = (input: unknown): ReadPresentationBodyInput => {
  const fields = storedFields(input);
  if (fields === undefined || !hasExactFields(fields, ["resourceId"])) {
    throw new Error("presentation/read-presentation-body: exactly one plain resourceId field is required");
  }
  if (!isStoredRowId(fields.resourceId, "presentations")) {
    throw new Error("presentation/read-presentation-body: resourceId is one current presentation id");
  }
  return { resourceId: fields.resourceId };
};
