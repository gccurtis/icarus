# Everyone

| Selecting | What it is | Sections |
| --- | --- | --- |
| The overflow presence chip, or People as a whole | Everybody at once, rather than one person | Here now · Everyone · Note |

What you get when you click "+4 more" instead of a face. A roster, not a profile;
every row from here opens the [person lens](person.md).

## Layout

| 300px |
| --- |
| here now |
| everyone |
| everyone |
| note |

## Here now

**Shows** — Ana Reyes (Q3 Resilience Memo · you), Tomas Kaur (page 3), Mira Jain
(Outage Cost Model)

**Needs** — presence with a location.

## Everyone

Every member with their role, truncated with an overflow row that summarises the
rest rather than hiding it.

**Shows** — Ana Reyes · Owner, Mira Jain · Owner, Tomas Kaur · Editor, *+4 more · 3 editors · 1 viewer*

**Needs** — the membership list with roles.

## Note

Presence requires an ephemeral collaboration channel. It is never inferred from
`lastSeenAt` and never from Activity — both would report someone as present who
closed the tab an hour ago.
