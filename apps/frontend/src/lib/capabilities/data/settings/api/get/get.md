# API: `get`

Reads one setting from a project, or reports that there is none.

## Classification

- **Effect:** accessor
- **Transaction:** none
- **Entry:** [`get.ts`](get.ts)
- **Browser-reachable:** yes, via [`get.remote.ts`](get.remote.ts)

## Signature

```ts
export const get = async (scope: Scope, key: string): Promise<Setting | undefined>;
```

A bare `key` rather than an input object, because there is one thing to say and
wrapping it would suggest there might be more later.

## Admission

`get.remote.ts` is declared `'unchecked'`. The key is admitted by
[`canonicalKey`](../shared/canonical-key.ts); there is nothing else to admit.

## Output

`Setting | undefined`.

**An absent key is an ordinary answer**, not a failure. An unusable key is not
ordinary and still fails as `invalid-key`: asking for something that cannot exist
is a different event from asking for something that merely does not, and a caller
branching on `undefined` should not have to tell them apart itself.

There is no `require` variant. It would differ only in raising on absence, which
is a decision the caller is better placed to make — and the branch costs one
line.

## Failures

| Error code | Cause |
| --- | --- |
| `invalid-key` | the key is not a string, is too long, or is not a dotted lowercase path |

`setting-not-found` exists in [`errors.ts`](../../errors.ts) and is deliberately
**not** raised here. It is reserved for a caller that cannot continue without a
value; nothing needs it yet.

## Effects

None.

## Procedure Tree

```text
get(scope, key)
├── record("get", { key })          ../shared/record.ts
├── canonicalKey(key)               ../shared/canonical-key.ts
├── projectDatabase(scope.projectId)   $model/server/index.server
├── select from settings where key = …
└── currentSetting(row)             ../../persistence/stored-types.ts
```

## Supporting Procedures

None. The whole procedure fits in one file, which is the test for whether it
needs any.

## Shared Procedures Used

| Procedure | Why this function needs it |
| --- | --- |
| `canonicalKey` | it must admit exactly what `set` admitted, or a stored setting becomes unreadable |
| `record` | absence and rejection look alike from outside; the log is what tells them apart |
