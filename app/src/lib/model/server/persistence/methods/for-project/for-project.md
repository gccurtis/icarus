# Method: `forProject`

The one way to reach a project's database. Called by `projectDatabase` on the
composition root, which is what every capability procedure uses; nothing else
opens a database, because a second instance over one directory is a corruption
rather than a duplication.

## Classification

- **Effect:** mutator
- **Entry:** [`for-project.ts`](for-project.ts)
- **Exposed as:** `persistence.forProject()` on `Persistence`
- **Synchronous:** no — it returns the in-flight open, which the caller awaits

## Signature

```ts
export const forProject = (
  state: PersistenceState,
  projectId: string
): Promise<ProjectDatabase> => ...;
```

State arrives as a parameter from the definition. Nothing here is read from
module scope, so two instances of `Persistence` cannot interfere.

## Inputs

| Input | Type | Description |
| ----- | ---- | ----------- |
| `projectId` | `string` | The project, and the directory its database lives in. It must already be usable as a directory name |

## Output

`Promise<ProjectDatabase>` — the project id, its typed client, and the close that
belongs to it. The same promise is answered to every later caller, so the
`ProjectDatabase` is shared and must not be closed by a consumer; shutdown owns
that.

## Failures

| Failure | Cause |
| ------- | ----- |
| `Project id '…' is not usable as a directory name` | The id could escape the projects directory, or would fold onto another id on a case-insensitive filesystem |
| whatever the open failed with | The directory could not be created, or the instance or its schema could not be brought up |

The first is a decision, and it is taken before anything is touched. The second
is a fault, and it evicts the entry so the next caller retries rather than
replaying it.

## Effects

- Writes one entry into `state.open`, keyed by project id.
- Removes that entry again if the open rejects.
- Acquires a PGlite instance and creates the project's directory.

## Concurrency

The read of the map, the call to open, and the write back into it all happen
before the first `await`, so two callers arriving together cannot both start an
open. The second finds the entry and awaits the first — which is the whole
reason the map holds promises. A value cache would look identical and be wrong
in exactly this case, and PGlite is single user/connection, so the loser of that
race fails in a way that reads like corruption.

## Method Tree

```text
forProject(state, projectId)
├── assertSafeProjectId()             safe-project-id.ts
├── state.open.get(projectId)         the in-flight promise, when there is one
|| the project is already open or opening
│   └── that promise, unchanged
|| the project is not open
│   ├── openProject()                 open-project/open-project.ts
│   ├── evict on rejection            for-project.ts
│   └── state.open.set(projectId)
└── the promise the caller awaits
```

## Supporting Methods

| Method | Responsibility | File |
| ------ | -------------- | ---- |
| `assertSafeProjectId` | Rejects an id that could name anything but this project's directory | [safe-project-id.ts](safe-project-id.ts) |
| `openProject` | Acquires the directory, the instance, and the schema | [open-project/open-project.md](open-project/open-project.md) |
