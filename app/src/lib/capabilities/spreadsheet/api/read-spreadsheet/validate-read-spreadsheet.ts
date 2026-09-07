import type { ReadSpreadsheetInput } from "$capabilities/spreadsheet/types/read-spreadsheet";

export const validateReadSpreadsheet = (input: unknown): ReadSpreadsheetInput => {
  if (typeof input !== "object" || input === null) {
    throw new Error("spreadsheet/read-spreadsheet: an object is required");
  }

  const { resourceId } = input as { resourceId?: unknown };
  if (typeof resourceId !== "string" || resourceId.length === 0) {
    throw new Error("spreadsheet/read-spreadsheet: resourceId is required");
  }

  return { resourceId };
};
