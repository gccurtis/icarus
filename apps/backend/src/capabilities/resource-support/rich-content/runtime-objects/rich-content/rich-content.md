# Runtime Object: `RichContentRuntime`

## Responsibility

The capability's public surface. It owns the eleven operations a consumer may
perform on a content object, and it owns the two dependencies those operations
need — the store and the ID factory — so that neither is reachable from outside.

It deliberately does not own the procedures themselves. Selection translation,
mark arithmetic, revision gating, and the commit belong to
[`runtime-api/`](../../runtime-api/runtime-api.md); persistence belongs to
[`persistence/`](../../persistence/persistence.md). It also does not own
authorization or the resource record that refers to a `RichContentId` — those
belong to the consumer.

## Interface

Declared in [`definition.ts`](definition.ts). Every method is a one-line
delegation to its `runtime-api` entry; the file holds no algorithm, no store
query, and no revision decision.

```ts
export interface RichContentRuntime {
  create(initialText?: string): Promise<ContentMutationResult>;
  replaceText(input: ReplaceTextInput): Promise<ContentMutationResult>;
  applyStyle(input: ApplyStyleInput): Promise<ContentMutationResult>;
  removeStyle(input: RemoveStyleInput): Promise<ContentMutationResult>;
  setLink(input: SetLinkInput): Promise<ContentMutationResult>;
  removeLink(input: RemoveLinkInput): Promise<ContentMutationResult>;
  setList(input: SetListInput): Promise<ContentMutationResult>;
  removeList(input: RemoveListInput): Promise<ContentMutationResult>;
  split(input: SplitContentInput): Promise<SplitContentResult>;
  combineAsList(input: CombineAsListInput): Promise<ContentMutationResult>;
  display(id: RichContentId): Promise<DisplayContent>;
}
```

`PersistedRichContentRuntime` is the implementing class. It is exported for the
constructor and for tests that inject a substitute ID factory, but `index.ts`
does not re-export it — a consumer depends on the interface.

## Fields

| Field | Type | Description |
| ----- | ---- | ----------- |
| `store` | `RichContentStore` | The only path to persisted content. Passed to whichever entry needs to read or commit. |
| `ids` | `RichContentIdFactory` | Passed to every entry that allocates identity. `replaceText`, `removeList`, and `display` do not receive it, because none of them mints an ID. |

Both are `private readonly`. The object holds no content state: PGlite is the
authority, and nothing is cached between calls.

## Constructor

`createRichContentRuntime(database)` in [`constructor.ts`](constructor.ts).

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `database` | `Kysely<BackendDatabase>` | The shared client from Platform Persistence. Rich Content owns the table it creates on this client, not the client. |

### Construction Steps

```text
1. Construct PGliteRichContentStore over the supplied database.
2. Await store.initialize(), creating rich_content if it does not exist.
3. Create the UUID-backed ID factory.
4. Return a PersistedRichContentRuntime holding both.
```

## Invariants

- The store and ID factory are fixed for the object's lifetime and are never
  handed out.
- No method returns raw atoms or marks, whichever path it took.
- No method writes without a revision predicate, so a caller that lost a race
  gets `stale-version` rather than a silent overwrite.
- The object caches nothing; two calls read the current stored revision twice.
