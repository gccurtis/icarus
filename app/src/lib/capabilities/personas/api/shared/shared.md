# Shared Persona Procedures

Lives at `api/shared/shared.md`.

| File | Preserves |
| --- | --- |
| [`require-persona.ts`](require-persona.ts) | that "absent project means yours too" is stated once, and that a caller learns nothing from a persona that is not theirs |

## `requirePersona`

Promoted because its second caller is in another capability:
[`personaThreads.start`](../../../persona-threads/api/start/start.md) has to
resolve a persona exactly as editing one does, including the rule that a persona
with no project belongs to every project.

Stating that rule twice is how the two answers begin to differ — a chat that can
be opened with a persona nobody can edit, or the reverse.

**It throws "not found", never "forbidden".** Telling absence and someone else's
apart confirms a persona exists to someone with no right to know that.

Its return type is the stored row: its callers want the fields they are about to
patch, or the persona they are about to attach a thread to.
