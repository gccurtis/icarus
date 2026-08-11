# `AgentsRail.svelte` — the Agents map

Activity first, then the personalities. Monitoring is the reason you come to this space, so the
live view is the pinned first entry rather than one item among the assets; the personalities
below it follow the same names-only row grammar as `LibraryRail` (kind icon, name, org marker —
plus a star on the default personality, mirroring Omega's `/personas/default`).

The `+` sits on the **Personalities** heading, not the space heading. Personalities are the thing
you create here; starting an agent needs no create button, because that is what the AI bar is.

## Selection is navigation

```svelte
onclick={() => goto(`/library/agents/${p.id}`)}
```

Unlike `LibraryRail`, rows navigate instead of reporting a selection upward: a personality is a
sub-route (durable, linkable), and `activeId` comes back down from the route. `activeId === null`
means the Activity view is open, which is why Activity highlights on the base route.

Search and owner filtering stay the console's job — `query`/`owner` are `$bindable`, the filtered
list arrives as a prop, same division as the other rail.
