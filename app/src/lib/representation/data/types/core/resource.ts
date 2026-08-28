/**
 * What a project holds and works over. An open string, prefix-matched on `::`,
 * so `externalFile` names every subkind under it.
 *
 * Base kinds: `document` `slides` `spreadsheet` `externalFile` `connection`
 * `finding`. Nothing validates the string, so a typo is a silent miss.
 * `kindMatches`, in `behavior/core/resource.ts`, is what reads the separator.
 */
export type ResourceKind = string;

/** A specific resource. `id` is a plain string: several tables answer to it. */
export type ResourceRef = { kind: ResourceKind; id: string };
