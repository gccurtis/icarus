const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SOURCE = /^src\/lib\/components\/(authored|vendored)\/[a-z0-9-]+\/[a-z0-9-]+\.(svelte|ts)$/;

export const isSafeName = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 64 && NAME.test(value);

export const isSafeSourcePath = (value: unknown): value is string =>
  typeof value === "string" && !value.includes("..") && SOURCE.test(value);
