/**
 * Dates, as authored and as stored.
 *
 * Input and value shapes are separate for one reason: `dayName` is optional on
 * the way in and mandatory on the way out. It is **derived, never trusted** —
 * admission recomputes it from the year, month, and day rather than believing
 * what an author supplied, so a stored date cannot claim a weekday it does not
 * have.
 *
 * Time is admitted only as the complete five-field group. A date carrying an
 * hour but no time zone is ambiguous, and storing an ambiguity is worse than
 * refusing it.
 */
export type Calendar = "gregorian";

export interface GregorianDateInput {
  readonly calendar: "gregorian";
  readonly dayName?: string;
  readonly day: number;
  readonly month: number;
  readonly year: number;
}

export interface GregorianDateTimeInput extends GregorianDateInput {
  readonly timeZone: string;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly millisecond: number;
}

export type DateInput = GregorianDateInput | GregorianDateTimeInput;

export interface GregorianDateValue {
  readonly calendar: "gregorian";
  readonly dayName: string;
  readonly day: number;
  readonly month: number;
  readonly year: number;
}

export interface GregorianDateTimeValue extends GregorianDateValue {
  readonly timeZone: string;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly millisecond: number;
}

export type DateValue = GregorianDateValue | GregorianDateTimeValue;
