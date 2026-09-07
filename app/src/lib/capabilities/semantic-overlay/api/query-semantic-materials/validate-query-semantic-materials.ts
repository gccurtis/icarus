import type { QuerySemanticMaterialsInput } from "$capabilities/semantic-overlay/types/query-semantic-materials";
import type { MaterialKind } from "$representation/data/types/semantic/material";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceSet, SetTerm } from "$representation/data/types/core/resource-set";

const KINDS: readonly MaterialKind[] = ["table", "csv", "chart", "image", "code"];

const record = (value: unknown, message: string): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
};

const nonblank = (value: unknown, message: string): string => {
  if (typeof value !== "string" || !value.trim()) throw new Error(message);
  return value.trim();
};

const ref = (value: unknown): ResourceRef => {
  const held = record(value, "material query resource refs must be objects");
  return {
    kind: nonblank(held.kind, "material query resource kind must not be blank"),
    id: nonblank(held.id, "material query resource id must not be blank")
  };
};

const term = (value: unknown): SetTerm => {
  const held = record(value, "material query scope terms must be objects");
  if (held.select === "project") return { select: "project" };
  if (held.select === "kinds") {
    if (!Array.isArray(held.kinds) || held.kinds.some((kind) => typeof kind !== "string" || !kind)) {
      throw new Error("material query kinds must be non-blank strings");
    }
    return { select: "kinds", kinds: [...held.kinds] as string[] };
  }
  if (held.select === "resources") {
    if (!Array.isArray(held.refs)) throw new Error("material query resources must be an array");
    return { select: "resources", refs: held.refs.map(ref) };
  }
  if (held.select === "set") {
    return {
      select: "set",
      setId: nonblank(held.setId, "material query set id must not be blank") as Id<"resourceSets">
    };
  }
  throw new Error("material query scope has an unknown term");
};

const scope = (value: unknown): ResourceSet => {
  const held = record(value, "material query scope must be an object");
  if (!Array.isArray(held.include) || !Array.isArray(held.exclude)) {
    throw new Error("material query scope requires include and exclude arrays");
  }
  return { include: held.include.map(term), exclude: held.exclude.map(term) };
};

export const validateQuerySemanticMaterials = (input: unknown): Required<Pick<QuerySemanticMaterialsInput, "text" | "topK">> & Omit<QuerySemanticMaterialsInput, "text" | "topK"> => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("material query input must be an object");
  }
  const value = input as Record<string, unknown>;
  if (typeof value.text !== "string" || !value.text.trim() || value.text.length > 2_000) {
    throw new Error("material query text must contain 1 through 2,000 characters");
  }
  const topK = value.topK ?? 8;
  if (!Number.isInteger(topK) || (topK as number) < 1 || (topK as number) > 100) {
    throw new Error("material query topK must be an integer from 1 through 100");
  }
  let kinds: MaterialKind[] | undefined;
  if (value.kinds !== undefined) {
    if (!Array.isArray(value.kinds) || value.kinds.length === 0 || value.kinds.some((kind) => !KINDS.includes(kind as MaterialKind))) {
      throw new Error("material query kinds must be a non-empty array of supported kinds");
    }
    kinds = [...new Set(value.kinds as MaterialKind[])];
  }
  return {
    text: value.text.trim(),
    topK: topK as number,
    ...(kinds === undefined ? {} : { kinds }),
    ...(value.scope === undefined ? {} : { scope: scope(value.scope) })
  };
};
