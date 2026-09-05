# A persona

| Selecting | What it is | Sections |
| --- | --- | --- |
| A persona, from the library or as the default lens | The profile: who it is, what it has done, how it behaves, what it may see and do | Profile · Record · Behaviour · Can look up · May do · Removal |

A profile, not a form. Picture and name first, then a record of what it has done,
then how it is configured — in that order, because that is the order the
questions come in.

## Layout

| 300px |
| --- |
| profile |
| profile |
| record |
| behaviour |
| can look up |
| may do |
| removal |

## Profile

Picture, name and description, all editable, plus scope.

**Shows** — an avatar, `Name · Grid Analyst`, `Describes · Reads field data and
relay logs.`, `Picture · Choose`, `Available in · This project | Everywhere`

**Needs** — the `Persona` record with an avatar field.

**Open** — where an avatar image is stored, and whether a persona can have a
generated one.

## Record

**Shows** — `41 tasks · 128 findings`

**Needs** — a per-persona aggregate, which does not exist.

## Behaviour

A summary of the five sections, with the detail in
[the Behaviour view](../../context/agents/behaviour.md).

**Shows** — "Focus · Background · Approach · Output · Verification — all five
written."

**Needs** — which of the five are non-empty.

## Can look up

Its Context, as one row.

**Shows** — *Field reports 2024–25* — 96

**Needs** — the persona's `ResourceSet` reference.

## May do

Tools and model, as counts. Starts collapsed.

**Shows** — `Tools · 4 of 6 allowed`, `Model · analyst-default`

**Needs** — the tool allowance and model binding.

## Removal

Delete is removed rather than shown.

**Open** — gated on a dependency and tombstone policy. Forty-one tasks and six
conversations name this persona, and hard deletion would break every one of those
labels. A disabled button would imply the policy exists and is merely unmet.
