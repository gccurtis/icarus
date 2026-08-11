# `presence/types.ts`

The vocabulary for **project** presence — who is on a project right now.

## Why this system exists separately from document collaboration

`systems/documents/collaboration` answers "who has THIS DOCUMENT open", and it is real: Omega's
presence capability is keyed by document (`core/capability/presence/presence.go`,
`byDoc map[string]map[string]Entry`) and its session records carry a `currentDocumentId`.

"Who is on this project" is a different question with a different key, and Omega cannot answer it — a
user sitting on the project overview has no document open, so they appear in no presence entry at all,
including their own. Rather than bend the document plumbing into pretending, this system is **mocked**
and the real capability is requested in
[`docs/backend-requests/project-level-presence.md`](../../../../docs/backend-requests/project-level-presence.md).

## The `mock` flag is per entry, not per list

```ts
export type PresentUser = {
  userId: string;
  name: string;
  mock: boolean;
};
```

Because one entry is genuinely real: **you**. The current user is looking at the project, which is
exactly the point the request is built around ("you should see yourself"). Everyone else is invented
until Omega can answer. A single list-level flag would have forced the UI to badge your own row as
fake or to call the invented ones real; per-entry keeps both honest.

```ts
export type ProjectPresence = {
  projectId: string;
  present: PresentUser[];
  mocked: boolean;
};
```

`projectId` is carried so a consumer can check the value belongs to the project it is rendering —
strict project isolation, the same shape the `roster` store uses. `mocked` is the roll-up (true when
*any* entry is invented) and is what drives the lens's `Mock` badge and its explanatory sentence, so
a project where you are the only member shows no badge at all — nothing was invented there.
