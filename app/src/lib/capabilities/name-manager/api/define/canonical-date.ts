import { NameManagerError } from "$name-manager/errors";
import { invalidValue, isRecord } from "$name-manager/api/define/value-guards";
import type { DateValue, GregorianDateTimeValue } from "$name-manager/types/dates";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
] as const;
const DATE_FIELDS = ["calendar", "dayName", "day", "month", "year"] as const;
const TIME_FIELDS = ["timeZone", "hour", "minute", "second", "millisecond"] as const;

const requiredInteger = (
  value: unknown,
  path: string,
  minimum: number,
  maximum: number
): number => {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    return invalidValue(path, `an integer from ${minimum} through ${maximum}`);
  }
  return value;
};

const daysInGregorianMonth = (year: number, month: number): number => {
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
};

/**
 * Admits a time zone by asking the platform to resolve it.
 *
 * A list of names would be wrong within a year — the IANA database changes — so
 * this defers to `Intl`, which throws on a name it does not know and returns the
 * canonical spelling for one it does.
 */
const canonicalTimeZone = (value: unknown, path: string): string => {
  if (typeof value !== "string" || value.length === 0) {
    return invalidValue(path, "an IANA time-zone name");
  }
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return invalidValue(path, "an IANA time-zone name");
  }
};

const assertOnlyKeys = (
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  path: string
): void => {
  const extra = Object.keys(value).find((key) => !allowed.has(key));
  if (extra) {
    throw new NameManagerError("invalid-value", `${path} has unknown field '${extra}'`);
  }
};

/**
 * Admits a Gregorian date.
 *
 * Two properties are the reason this is not a one-line parse.
 *
 * **`dayName` is derived, never trusted.** Whatever the author supplied is
 * checked for type and then discarded; the weekday is recomputed from the year,
 * month, and day. A stored date therefore cannot claim a weekday it does not
 * have, which a round trip through someone else's formatter easily produces.
 *
 * **Time is admitted only as the complete five-field group.** A date carrying an
 * hour but no time zone is ambiguous, and storing an ambiguity is worse than
 * refusing it — so a partial time names the first field that is missing rather
 * than defaulting it.
 */
export const canonicalDate = (input: unknown, path: string): DateValue => {
  if (!isRecord(input)) return invalidValue(path, "a Gregorian date object");
  if (input.calendar !== "gregorian") {
    return invalidValue(`${path}.calendar`, 'the supported value "gregorian"');
  }
  if (input.dayName !== undefined && typeof input.dayName !== "string") {
    return invalidValue(`${path}.dayName`, "text when supplied");
  }

  const year = requiredInteger(input.year, `${path}.year`, 1, 9999);
  const month = requiredInteger(input.month, `${path}.month`, 1, 12);
  const day = requiredInteger(input.day, `${path}.day`, 1, daysInGregorianMonth(year, month));

  // Built in UTC and with the year set explicitly: the two-digit-year mapping
  // in `new Date(year, ...)` would silently turn year 99 into 1999.
  const clock = new Date(0);
  clock.setUTCHours(0, 0, 0, 0);
  clock.setUTCFullYear(year, month - 1, day);
  const dayName = DAY_NAMES[clock.getUTCDay()]!;
  const presentTimeFields = TIME_FIELDS.filter((field) => input[field] !== undefined);

  if (presentTimeFields.length === 0) {
    assertOnlyKeys(input, new Set(DATE_FIELDS), path);
    return { calendar: "gregorian", dayName, day, month, year };
  }
  const missing = TIME_FIELDS.find((field) => input[field] === undefined);
  if (missing) {
    throw new NameManagerError(
      "invalid-value",
      `${path} has a partial time; '${missing}' is required when time is present`
    );
  }
  assertOnlyKeys(input, new Set([...DATE_FIELDS, ...TIME_FIELDS]), path);

  const result: GregorianDateTimeValue = {
    calendar: "gregorian",
    dayName,
    day,
    month,
    year,
    timeZone: canonicalTimeZone(input.timeZone, `${path}.timeZone`),
    hour: requiredInteger(input.hour, `${path}.hour`, 0, 23),
    minute: requiredInteger(input.minute, `${path}.minute`, 0, 59),
    second: requiredInteger(input.second, `${path}.second`, 0, 59),
    millisecond: requiredInteger(input.millisecond, `${path}.millisecond`, 0, 999)
  };
  return result;
};
