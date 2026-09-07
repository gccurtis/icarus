import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type { ResourceSet, SetTerm } from "$representation/data/types/core/resource-set";

export const inputRecord = (value: unknown, message: string): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
};

export const nonblank = (value: unknown, message: string): string => {
  if (typeof value !== "string" || !value.trim()) throw new Error(message);
  return value.trim();
};

export const derivedOutputId = (value: unknown): Id<"derivedOutputs"> =>
  nonblank(value, "derived output id must not be blank") as Id<"derivedOutputs">;

export const resourceRef = (value: unknown): ResourceRef => {
  const candidate = inputRecord(value, "derived output resource refs must be objects");
  return {
    kind: nonblank(candidate.kind, "derived output resource kind must not be blank"),
    id: nonblank(candidate.id, "derived output resource id must not be blank")
  };
};

const term = (value: unknown): SetTerm => {
  const candidate = inputRecord(value, "derived output scope terms must be objects");
  if (candidate.select === "project") return { select: "project" };
  if (candidate.select === "kinds") {
    if (
      !Array.isArray(candidate.kinds) ||
      candidate.kinds.some((kind) => typeof kind !== "string" || !kind)
    ) {
      throw new Error("derived output kinds must be non-blank strings");
    }
    return { select: "kinds", kinds: [...candidate.kinds] as string[] };
  }
  if (candidate.select === "resources") {
    if (!Array.isArray(candidate.refs)) throw new Error("derived output resources must be an array");
    return { select: "resources", refs: candidate.refs.map(resourceRef) };
  }
  if (candidate.select === "set") {
    return {
      select: "set",
      setId: nonblank(candidate.setId, "derived output setId must not be blank") as Id<"resourceSets">
    };
  }
  throw new Error("derived output scope has an unknown term");
};

export const resourceSet = (value: unknown): ResourceSet => {
  const candidate = inputRecord(value, "derived output scope must be an object");
  if (!Array.isArray(candidate.include) || !Array.isArray(candidate.exclude)) {
    throw new Error("derived output scope requires include and exclude arrays");
  }
  return { include: candidate.include.map(term), exclude: candidate.exclude.map(term) };
};
