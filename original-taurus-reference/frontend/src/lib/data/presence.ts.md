# `data/presence.ts`

```ts
export * from '$systems/presence';
```

The data-boundary facade for project presence — one line, one system, per the import convention
(`$data/<system>` is the whole system; `$systems/<system>/<submodule>` is a precise import; there are
no other facades).

Worth stating plainly because of what sits behind it: this facade currently fronts **mocked** data.
`systems/presence` composes the current user (real, from the session) with a deterministic mock over
the project roster, because Omega's presence is keyed by document and cannot answer "who is on this
project" — [backend request](../../../docs/backend-requests/project-level-presence.md). Importers do
not need to care: the shape they read is the shape the real endpoint will fill, and the `mock` flag on
each entry is what the Members lens badges.
