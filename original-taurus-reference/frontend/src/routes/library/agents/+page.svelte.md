# `/library/agents` — the Agents route

Two lines: render [`AgentsConsole`](../../../lib/features/library/AgentsConsole.svelte.md) with no
personality selected, which is the **Activity view** — every agent working for you, across
projects.

```svelte
<AgentsConsole personaId={null} />
```

## Why a route and not the workspace tab it used to be

Agents was a permanent workspace tab next to Overview, rendering a "coming next" placeholder. It
was promoted here (2026-07-29) because the things this space holds cut across projects: a
personality is reusable everywhere, and the task monitor spans every project you belong to — a
tab inside one project's shell could never honestly show either. The tab is gone from
`$data/workspace`'s permanent set; persisted workspaces drop it automatically on normalize.

Personalities open as sub-routes at [`/library/agents/[id]`](./[id]/+page.svelte.md). The data is
mocked and badged — see [`agents-mock.ts`](../../../lib/features/library/agents-mock.ts.md) for
exactly what is real-shaped and what is invented.
