import type { ResourceKind } from "$representation/data/types/core/resource";

/** A resource kind's subkind separator. `externalFile::image` is under `externalFile`. */
const SUBKIND = "::";

/**
 * Whether `kind` falls under `pattern`, comparing segments rather than raw
 * string prefixes — `externalFile::doc` must not match `externalFile::document`.
 */
export const kindMatches = (pattern: ResourceKind, kind: ResourceKind): boolean => {
  const patternSegments = pattern.split(SUBKIND);
  const kindSegments = kind.split(SUBKIND);

  return (
    patternSegments.length <= kindSegments.length &&
    patternSegments.every((segment, index) => segment === kindSegments[index])
  );
};
