import type { ResourceOption } from "$capabilities/research-chat/index.remote";

/** Stable control value for one exact represented-resource identity. */
export const resourceOptionKey = (option: ResourceOption): string =>
  `${option.kind} ${option.id}`;

/** External path worth showing separately from its filename. */
export const distinctResourcePath = (
  option: ResourceOption | undefined
): string | undefined => {
  if (option === undefined || option.relativePath === null || option.relativePath === option.name) {
    return undefined;
  }
  return option.relativePath;
};

/** Accessible identity that disambiguates equal External filenames. */
export const resourceOptionLabel = (option: ResourceOption): string => {
  const path = distinctResourcePath(option);
  return path === undefined ? option.name : `${option.name} — ${path}`;
};

export const resourceOptionForKey = (
  options: readonly ResourceOption[],
  key: string
): ResourceOption | undefined =>
  options.find((option) => resourceOptionKey(option) === key);

export const resourceOptionForRef = (
  options: readonly ResourceOption[],
  ref: { readonly kind: string; readonly id: string }
): ResourceOption | undefined =>
  options.find((option) => option.kind === ref.kind && option.id === ref.id);
