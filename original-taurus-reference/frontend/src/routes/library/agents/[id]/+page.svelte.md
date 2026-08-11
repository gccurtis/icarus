# `/library/agents/[id]` — one personality

Renders the same [`AgentsConsole`](../../../../lib/features/library/AgentsConsole.svelte.md) as
the base route, with the personality id from the URL.

```svelte
<AgentsConsole personaId={data.personaId} />
```

A personality gets a URL because it is a durable, shareable asset — "look at this personality"
must be a link. Tasks deliberately do not: they are transient work, selected in place. An unknown
id falls back to the Activity view inside the console rather than a 404, which is the right
behaviour for a deleted personality someone still has a link to.
