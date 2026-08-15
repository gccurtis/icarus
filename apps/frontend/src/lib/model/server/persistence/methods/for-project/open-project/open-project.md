# Method: `openProject`

Everything that has to be true before a project's database can be queried:
the directory exists, an instance holds it, and every capability's tables are
there. Called only by `forProject`, and only when the project is not already
open.

## Classification

- **Effect:** mutator — it acquires resources the object then owns
- **Entry:** [`open-project.ts`](open-project.ts)
- **Exposed as:** nothing. It reaches consumers only through `forProject`
- **Synchronous:** no — it awaits the directory, the instance, and each schema

## Signature

```ts
export const openProject = (
  context: OpenProjectContext,
  projectId: string
): Promise<ProjectDatabase> => ...;
```

`context` — the projects root, the logger, and the initializer list — is bound
once by the constructor. Nothing is read from module scope, so a second
`Persistence` opens against its own root.

## Output

`Promise<ProjectDatabase>` — the id, a typed Kysely client, and the `close` that
releases this instance. The close travels with the database because the thing
that acquired the instance is the only thing that knows it has one.

## Failures

| Failure | Cause |
| ------- | ----- |
| an ENOENT or permission error | The projects root cannot be created or written |
| whatever a driver or initializer threw | The instance could not start, or a capability's schema could not be created or verified |

Every one of them arrives with nothing still held.

## Effects

- Creates the project's directory and its parents.
- Acquires a PGlite instance, which holds that directory until it is closed.
- Creates and verifies every listed capability's tables.
- Records `persistence.project.opened`.

## Concurrency

Only ever running once per project at a time: `forProject` writes the in-flight
promise into the map before awaiting, so a second caller never reaches this
function. That matters because PGlite is single user/connection — two instances
over one directory is not contention, it is corruption.

## Atomic construction

From the moment `PGlite.create` resolves, the instance holds the directory, so
every failure after it releases the instance before the error escapes. Leaving it
open would lock the directory against the retry that eviction exists to allow,
turning a transient failure into a permanent one.

## Method Tree

```text
openProject(context, projectId)
├── prepareDirectory()                prepare-directory.ts
├── PGlite.create(directory)          the instance now holds the directory
├── initializeTables()                initialize-tables.ts
|| any step below the instance fails
│   └── pglite.close(), then rethrow  open-project.ts
└── ProjectDatabase
    └── close() → closeProject()      close-project.ts
```

## Supporting Methods

| Method | Responsibility | File |
| ------ | -------------- | ---- |
| `prepareDirectory` | Creates the project directory and its parents, which PGlite does not | [prepare-directory.ts](prepare-directory.ts) |
| `initializeTables` | Runs every capability initializer in the listed order | [initialize-tables.ts](initialize-tables.ts) |
| `closeProject` | Ends the connection and releases the instance, once | [close-project.ts](close-project.ts) |

`closeProject` is a file here rather than a directory of its own: it is three
statements, and the only thing worth explaining about it is why the guard on
`pglite.closed` exists, which is said where it is written. It lives under this
method because this is the method that acquired what it releases.
