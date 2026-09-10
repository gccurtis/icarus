import type { QuerySemanticMaterialsInput } from "$capabilities/semantic-overlay/types/query-semantic-materials";
import type { MaterialKind } from "$representation/data/types/semantic/material";
import {
  onlyQueryFields,
  queryRecord,
  queryResourceSet
} from "$capabilities/semantic-overlay/api/shared/query-input";

const KINDS: readonly MaterialKind[] = ["table", "csv", "chart", "image", "code"];

export const validateQuerySemanticMaterials = (input: unknown): Required<Pick<QuerySemanticMaterialsInput, "text" | "topK">> & Omit<QuerySemanticMaterialsInput, "text" | "topK"> => {
  const value = queryRecord(input, "material query input must be an object");
  onlyQueryFields(value, ["text", "topK", "kinds", "scope"], "material query input");
  if (typeof value.text !== "string" || !value.text.trim() || value.text.length > 2_000) {
    throw new Error("material query text must contain 1 through 2,000 characters");
  }
  const topK = value.topK ?? 8;
  if (!Number.isInteger(topK) || (topK as number) < 1 || (topK as number) > 100) {
    throw new Error("material query topK must be an integer from 1 through 100");
  }
  let kinds: MaterialKind[] | undefined;
  if (value.kinds !== undefined) {
    if (
      !Array.isArray(value.kinds) ||
      value.kinds.length === 0 ||
      value.kinds.length > KINDS.length ||
      value.kinds.some((kind) => typeof kind !== "string" || !KINDS.includes(kind as MaterialKind)) ||
      new Set(value.kinds).size !== value.kinds.length
    ) {
      throw new Error("material query kinds must be a non-empty array of supported kinds");
    }
    kinds = [...value.kinds] as MaterialKind[];
  }
  return {
    text: value.text.trim(),
    topK: topK as number,
    ...(kinds === undefined ? {} : { kinds }),
    ...(value.scope === undefined
      ? {}
      : { scope: queryResourceSet(value.scope, "material query scope") })
  };
};
