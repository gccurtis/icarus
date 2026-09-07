export type DecimalMark = "." | ",";

export type Thousands = "none" | "," | "." | " ";

export type NumberFormatParts = {
  readonly prefix: string;
  readonly suffix: string;
  readonly decimals: number | undefined;
  readonly mark: DecimalMark;
  readonly thousands: Thousands;
};

export const PLAIN: NumberFormatParts = { prefix: "", suffix: "", decimals: undefined, mark: ".", thousands: "none" };

export const PREFIXES = ["$", "€", "£", "¥"] as const;

export const SUFFIXES = ["%"] as const;

const INTEGER: Record<Thousands, string> = { none: "0", ",": "#,##0", ".": "#.##0", " ": "# ##0" };

const THOUSANDS_OF: Record<string, Thousands> = { "0": "none", "#,##0": ",", "#.##0": ".", "# ##0": " " };

const PATTERN = /^(?:"([^"]*)"|([^#0]*?))(#,##0|#\.##0|# ##0|0)(?:([.,])(#|0+))?(?:"([^"]*)"|(.*))$/;

const quoted = (text: string): string => (/[#0.,"]/.test(text) ? `"${text.replace(/"/g, "")}"` : text);

export const partsOf = (pattern: string | undefined): NumberFormatParts => {
  if (pattern === undefined || pattern === "" || pattern === "General") return PLAIN;
  const match = PATTERN.exec(pattern);
  if (match === null) return PLAIN;
  const [, quotedPrefix, prefix, integer, mark, fraction, quotedSuffix, suffix] = match;
  return {
    prefix: quotedPrefix ?? prefix ?? "",
    suffix: quotedSuffix ?? suffix ?? "",
    decimals: fraction === undefined ? 0 : fraction === "#" ? undefined : fraction.length,
    mark: mark === "," ? "," : ".",
    thousands: THOUSANDS_OF[integer] ?? "none"
  };
};

export const isPlain = (parts: NumberFormatParts): boolean =>
  parts.prefix === "" && parts.suffix === "" && parts.decimals === undefined && parts.thousands === "none";

export const patternOf = (parts: NumberFormatParts): string | null => {
  if (isPlain(parts)) return null;
  const fraction =
    parts.decimals === undefined ? `${parts.mark}#` : parts.decimals === 0 ? "" : `${parts.mark}${"0".repeat(parts.decimals)}`;
  return `${quoted(parts.prefix)}${INTEGER[parts.thousands]}${fraction}${quoted(parts.suffix)}`;
};

export const reconciled = (parts: NumberFormatParts, changed: "mark" | "thousands"): NumberFormatParts => {
  if (parts.thousands !== parts.mark) return parts;
  if (changed === "mark") return { ...parts, thousands: parts.mark === "." ? "," : "." };
  return { ...parts, mark: parts.thousands === "." ? "," : "." };
};

export const formatNumber = (value: number, pattern?: string): string => {
  if (pattern === undefined || pattern === "" || pattern === "General") return String(value);
  const parts = partsOf(pattern);
  const percent = parts.suffix.trim() === "%";
  const shown = percent ? value * 100 : value;
  const [whole = "", fraction] = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: parts.decimals ?? 0,
    maximumFractionDigits: parts.decimals ?? 10,
    useGrouping: parts.thousands !== "none"
  })
    .format(Math.abs(shown))
    .split(".");
  const grouped = whole.split(",").join(parts.thousands === "none" ? "" : parts.thousands);
  const digits = fraction === undefined ? grouped : `${grouped}${parts.mark}${fraction}`;
  return `${shown < 0 ? "-" : ""}${parts.prefix}${digits}${parts.suffix}`;
};
