# API: `set`

Writes a value at a key for one project, replacing whatever was there.

An upsert rather than separate create and update, because a setting has no
"does not exist yet" state a caller wants to handle: whoever writes
`editor.theme` wants it to be that value afterwards, and making them ask first
would only add a race between the check and the write.

## Classification

- **Effect:** mutator
- **Transaction:** none — one statement is already atomic
- **Entry:** [`set.ts`](set.ts)
- **Browser-reachable:** yes, via [`set.remote.ts`](set.remote.ts)

## Signature

```ts
export const set = async (scope: Scope, input: SettingInput): Promise<Setting>;
```

`scope` is derived server-side. `SettingInput` carries no `projectId` or
`userId` — a client cannot name its own authority, which is what lets
`updated_by` be written from the scope and still be true.

## Admission

`set.remote.ts` is declared `'unchecked'`, so this function is the only thing
between a hostile payload and the database.

| Rejected | By |
| --- | --- |
| a key that is not a dotted lowercase path, or over 128 characters | [`canonicalKey`](../shared/canonical-key.ts) |
| `undefined` — absence is not a deletion | [`canonicalValue`](canonical-value.ts) |
| a cycle, a `BigInt`, a function, a `symbol` | same |
| a value serializing to over 64 KB | same |
| `__proto__`, `constructor`, or `prototype` at any depth | same |

The size bound exists because without one a single request decides how much of a
project's database a caller occupies. The forbidden keys are refused even though
`JSON.parse` creates them as ordinary own properties: the value is stored, read
back, and eventually merged by code that has no idea it came from a browser.

## Output

`Setting` — the row as written, including the `updatedBy` and `updatedAt` the
server chose. Returning them rather than echoing the input is what lets a caller
show who last changed something without a second read.

## Failures

| Error code | Cause |
| --- | --- |
| `invalid-key` | the key is not a string, is too long, or is not a dotted lowercase path |
| `invalid-value` | the value is absent, unrepresentable, too large, or carries a forbidden key |

Both are decisions this capability states with a code, and `record` logs them at
`warn`. Anything else reaching the caller is a fault and is logged at `error`.

## Effects

- Inserts or replaces one row in `settings`.
- Sets `updated_by` to `scope.userId` and `updated_at` to now.

## Procedure Tree

```text
set(scope, input)
├── record("set", { key })          ../shared/record.ts
├── canonicalKey(input.key)         ../shared/canonical-key.ts
├── canonicalValue(input.value)     canonical-value.ts
│   └── rejectForbiddenKeys()       canonical-value.ts
├── projectDatabase(scope.projectId)   $model/server/index.server
├── insert into settings … on conflict (key) do update
└── currentSetting(row)             ../../persistence/stored-types.ts
```

## Supporting Procedures

| Procedure | Responsibility | File |
| --- | --- | --- |
| `canonicalValue` | admits a value, and severs every reference to the caller's object | [canonical-value.ts](canonical-value.ts) |

It lives here rather than in `shared/` because only `set` writes. `get` and
`list` read values back out of the database, where they have already been
admitted once.

## Shared Procedures Used

| Procedure | Why this function needs it |
| --- | --- |
| `canonicalKey` | all three functions must agree what a key is, or a caller could write what it cannot read |
| `record` | a browser-reachable mutation that leaves no trace is the one most worth having a record of |
