# A schedule trigger

| Selecting | What it is | Sections |
| --- | --- | --- |
| The schedule in the When view | When the rule fires, and when it fires next | On a schedule · Next · Advanced |

## Layout

| 300px |
| --- |
| on a schedule |
| on a schedule |
| next |
| advanced |

## On a schedule

Time, repeat and timezone. Timezone is explicit because "02:00" without one is
ambiguous for anyone but its author, and a digest that runs at the wrong hour is
a silent failure.

**Shows** — `At · 02:00`, `Repeats · **Daily** · Weekdays · Weekly · Custom`,
`Timezone · America/New_York`

**Needs** — the schedule fields on the trigger.

## Next

**Shows** — `Next fire · Tomorrow, 02:00`

Supplied by the scheduler, not computed in the panel — a computed next-fire that
disagrees with the scheduler is worse than none.

**Needs** — a next-fire time from the scheduler.

## Advanced

The stored form, for people who want it. Starts collapsed.

**Shows** — `Cron · 0 2 * * *`

**Needs** — the cron expression.

**Open** — invalid cron and an unsupported timezone are separate failures and must
be reported separately. One "invalid schedule" message for both leaves the author
guessing.
