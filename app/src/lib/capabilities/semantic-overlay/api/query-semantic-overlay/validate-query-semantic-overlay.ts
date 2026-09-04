import type { ResourceRef } from "$representation/data/types/core/resource";
import type { ResourceSet, SetTerm } from "$representation/data/types/core/resource-set";
import type { Id } from "$representation/data/types/core/id";
import type { QuerySemanticOverlayInput } from "$capabilities/semantic-overlay/types/query-semantic-overlay";

const record = (value: unknown, message: string): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
};

const nonblank = (value: unknown, message: string): string => {
  if (typeof value !== "string" || !value.trim()) throw new Error(message);
  return value;
};

const resource = (value: unknown): ResourceRef => {
  const candidate = record(value, "semantic query resource refs must be objects");
  return {
    kind: nonblank(candidate.kind, "semantic query resource kind must not be blank"),
    id: nonblank(candidate.id, "semantic query resource id must not be blank")
  };
};

const term = (value: unknown): SetTerm => {
  const candidate = record(value, "semantic query scope terms must be objects");
  if (candidate.select === "project") return { select: "project" };
  if (candidate.select === "kinds") {
    if (!Array.isArray(candidate.kinds) || candidate.kinds.some((kind) => typeof kind !== "string" || !kind)) {
      throw new Error("semantic query kinds must be strings");
    }
    return { select: "kinds", kinds: [...candidate.kinds] as string[] };
  }
  if (candidate.select === "resources") {
    if (!Array.isArray(candidate.refs)) throw new Error("semantic query resources must be an array");
    return { select: "resources", refs: candidate.refs.map(resource) };
  }
  if (candidate.select === "set") {
    return {
      select: "set",
      setId: nonblank(
        candidate.setId,
        "semantic query setId must not be blank"
      ) as Id<"resourceSets">
    };
  }
  throw new Error("semantic query scope has an unknown term");
};

const scope = (value: unknown): ResourceSet => {
  const candidate = record(value, "semantic query scope must be an object");
  if (!Array.isArray(candidate.include) || !Array.isArray(candidate.exclude)) {
    throw new Error("semantic query scope requires include and exclude arrays");
  }
  return { include: candidate.include.map(term), exclude: candidate.exclude.map(term) };
};

export const validateQuerySemanticOverlay = (input: unknown): QuerySemanticOverlayInput => {
  const candidate = record(input, "semantic query input must be an object");
  const text = nonblank(candidate.text, "semantic query text must not be blank");
  const topK = candidate.topK;
  if (!Number.isInteger(topK) || (topK as number) < 1 || (topK as number) > 100) {
    throw new Error("semantic query topK must be an integer from 1 through 100");
  }
  return {
    text,
    topK: topK as number,
    ...(candidate.scope === undefined ? {} : { scope: scope(candidate.scope) })
  };
};
