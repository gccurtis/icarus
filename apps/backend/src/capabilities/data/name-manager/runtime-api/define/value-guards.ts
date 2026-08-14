import { NameManagerError } from "#name-manager/errors.js";

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const invalidValue = (path: string, expectation: string): never => {
  throw new NameManagerError("invalid-value", `${path} must be ${expectation}`);
};
