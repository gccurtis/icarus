import type { ExternalFileUsageItem, ExternalFileUsageKind } from "$capabilities/external-files/types/read";

export const representedName = (
  names: ReadonlyMap<string, string>,
  id: string,
  subject: string
): string => {
  const name = names.get(id);
  if (name === undefined) throw new Error(`${subject} reference has no represented resource`);
  return name;
};

export const usageItem = (
  kind: ExternalFileUsageKind,
  id: string,
  name: string
): ExternalFileUsageItem => ({ kind, id, name });
