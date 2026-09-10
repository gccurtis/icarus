export type TemplateAddress = { readonly column: string; readonly row: number };

export const MAX_TEMPLATE_ROWS = 10_000;
export const MAX_TEMPLATE_COLUMNS = 256;
export const MAX_TEMPLATE_CELLS = 20_000;
export const MAX_TEMPLATE_FORMAT_RULES = 1_000;

const rawColumnNumber = (label: string): number =>
  [...label].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0);

export const templateColumnNumber = (value: string): number | undefined => {
  if (value.length === 0 || value.length > 3 || !/^[A-Z]+$/i.test(value)) return undefined;
  const number = rawColumnNumber(value.toUpperCase());
  return number <= MAX_TEMPLATE_COLUMNS ? number : undefined;
};

export const templateRowNumber = (value: string): number | undefined => {
  if (value.length === 0 || value.length > 5 || !/^[1-9][0-9]*$/.test(value)) return undefined;
  const row = Number(value);
  return Number.isSafeInteger(row) && row <= MAX_TEMPLATE_ROWS ? row : undefined;
};

export const templateAddress = (value: string): TemplateAddress | undefined => {
  if (value.length > 9) return undefined;
  const match = /^([A-Z]+)([1-9][0-9]*)$/i.exec(value);
  if (match === null) return undefined;
  const column = templateColumnNumber(match[1]);
  const row = templateRowNumber(match[2]);
  return column === undefined || row === undefined
    ? undefined
    : { column: match[1].toUpperCase(), row };
};

export const validTemplateAddress = (value: string): boolean =>
  value === value.toUpperCase() && templateAddress(value) !== undefined;

const selectionParts = (value: string): readonly string[] | undefined => {
  if (value.length === 0 || value.length > 2_000) return undefined;
  const parts = value.split(",").map((entry) => entry.trim()).filter(Boolean);
  return parts.length > 0 && parts.length <= 100 ? parts : undefined;
};

export const validTemplateRowSelection = (value: string): boolean => {
  const parts = selectionParts(value);
  return (
    parts !== undefined &&
    parts.every((part) => {
      const [from, to, ...extra] = part.split(":");
      return (
        extra.length === 0 &&
        templateRowNumber(from) !== undefined &&
        (to === undefined || templateRowNumber(to) !== undefined)
      );
    })
  );
};

export const validTemplateColumnSelection = (value: string): boolean => {
  const parts = selectionParts(value);
  return (
    parts !== undefined &&
    parts.every((part) => {
      if (part !== part.toUpperCase()) return false;
      const [from, to, ...extra] = part.split(":");
      return (
        extra.length === 0 &&
        templateColumnNumber(from) !== undefined &&
        (to === undefined || templateColumnNumber(to) !== undefined)
      );
    })
  );
};

export const templateColumnLabel = (number: number): string => {
  let value = number;
  let label = "";
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
};
