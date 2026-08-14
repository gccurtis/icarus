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
