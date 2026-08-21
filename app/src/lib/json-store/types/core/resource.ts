/**
 * What a project holds and works over. An open string, prefix-matched on `::`,
 * so `externalFile` names every subkind under it.
 *
 * Base kinds: `document` `slides` `spreadsheet` `externalFile` `connection`
 * `finding`. Nothing validates the string, so a typo is a silent miss.
 */
export type ResourceKind = string;

/** A specific resource. `id` is a plain string: several tables answer to it. */
export type ResourceRef = { kind: ResourceKind; id: string };

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
