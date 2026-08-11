# `+page.ts` — pass the personality id through

```ts
export const load: PageLoad = ({ params }) => ({ personaId: params.id });
```

The id is the whole payload. Resolution — and the unknown-id fallback to the Activity view —
lives in `AgentsConsole` beside the data, so this load stays a pure param hand-off and never
grows a fetch.
