import assert from "node:assert/strict";
import { test } from "vitest";
import { canonicalDate } from "$name-manager/api/define/canonical-date";
import { NameManagerError } from "$name-manager/errors";

/** Tier one: pure. No database, no clock — the date arrives as data. */
const code = (expected: string) => (error: unknown): boolean =>
  error instanceof NameManagerError && error.code === expected;

const admit = (input: unknown) => canonicalDate(input, "value");

test("derives dayName instead of trusting the one it was given", () => {
  // The property worth stating twice: a stored date cannot claim a weekday it
  // does not have, however confidently the payload asserted one.
  assert.deepEqual(
    admit({ calendar: "gregorian", dayName: "Monday", day: 12, month: 8, year: 2026 }),
    { calendar: "gregorian", dayName: "Wednesday", day: 12, month: 8, year: 2026 }
  );
});

test("derives dayName when none was supplied at all", () => {
  assert.equal(admit({ calendar: "gregorian", day: 1, month: 1, year: 2000 }).dayName, "Saturday");
});

test("counts days per month, and leap years by the full rule", () => {
  assert.equal(admit({ calendar: "gregorian", day: 29, month: 2, year: 2024 }).day, 29);
  assert.equal(admit({ calendar: "gregorian", day: 29, month: 2, year: 2000 }).day, 29);

  // 2025 is not a leap year; 1900 is the century that is not either.
  assert.throws(() => admit({ calendar: "gregorian", day: 29, month: 2, year: 2025 }), code("invalid-value"));
  assert.throws(() => admit({ calendar: "gregorian", day: 29, month: 2, year: 1900 }), code("invalid-value"));
  assert.throws(() => admit({ calendar: "gregorian", day: 31, month: 4, year: 2026 }), code("invalid-value"));
});

test("a two-digit year is that year, not nineteen-hundred-something", () => {
  // `new Date(99, 0, 1)` maps to 1999, which is why the year is set explicitly
  // through `setUTCFullYear`. Nothing but the weekday would notice: the stored
  // year would still read 99, and only `dayName` would quietly be 1999's.
  const dayName = admit({ calendar: "gregorian", day: 1, month: 1, year: 99 }).dayName;

  assert.equal(dayName, "Thursday", "0099-01-01 is a Thursday");
  assert.notEqual(dayName, "Friday", "Friday is 1999-01-01 — the two-digit mapping bit");
});

test("admits a complete time, canonicalizing the zone", () => {
  const value = admit({
    calendar: "gregorian",
    day: 12,
    month: 8,
    year: 2026,
    timeZone: "America/Chicago",
    hour: 9,
    minute: 30,
    second: 4,
    millisecond: 125
  });

  assert.deepEqual(value, {
    calendar: "gregorian",
    dayName: "Wednesday",
    day: 12,
    month: 8,
    year: 2026,
    timeZone: "America/Chicago",
    hour: 9,
    minute: 30,
    second: 4,
    millisecond: 125
  });
});

test("refuses a partial time, naming the field that is missing", () => {
  // Storing an ambiguity is worse than refusing it: an hour without a zone is
  // not a moment.
  assert.throws(
    () => admit({ calendar: "gregorian", day: 12, month: 8, year: 2026, hour: 9 }),
    (error: unknown) =>
      error instanceof NameManagerError &&
      error.code === "invalid-value" &&
      error.message.includes("timeZone")
  );
});

test("refuses a time zone the platform does not know", () => {
  assert.throws(
    () =>
      admit({
        calendar: "gregorian",
        day: 12,
        month: 8,
        year: 2026,
        timeZone: "Mars/Olympus",
        hour: 9,
        minute: 0,
        second: 0,
        millisecond: 0
      }),
    code("invalid-value")
  );
});

test("refuses another calendar, and an unknown field", () => {
  assert.throws(() => admit({ calendar: "julian", day: 1, month: 1, year: 2026 }), code("invalid-value"));
  assert.throws(
    () => admit({ calendar: "gregorian", day: 1, month: 1, year: 2026, era: "CE" }),
    code("invalid-value")
  );
});

test("refuses a non-integer or out-of-range component", () => {
  for (const broken of [
    { calendar: "gregorian", day: 1.5, month: 1, year: 2026 },
    { calendar: "gregorian", day: 1, month: 13, year: 2026 },
    { calendar: "gregorian", day: 1, month: 1, year: 0 },
    { calendar: "gregorian", day: 0, month: 1, year: 2026 }
  ]) {
    assert.throws(() => admit(broken), code("invalid-value"));
  }
});
