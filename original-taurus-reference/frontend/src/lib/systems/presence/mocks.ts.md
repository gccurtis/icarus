# `presence/mocks.ts`

The invented half of project presence. `mocks.test.ts` covers it.

## What is mocked is the presence, not the people

```ts
export function mockPresentMembers(projectId: string, members: Member[], currentUserId: string): PresentUser[]
```

Entries are drawn from the project's **real** member roster, so the Members lens never shows an
invented colleague — only the claim "they are here right now" is fiction. That keeps the mock's failure
mode small: when the real endpoint lands, the names do not change, only which of them are present.

## Deterministic, never random

```ts
function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
…
.filter((m) => (hash(m.id) ^ seed) % 3 === 0)
```

FNV-1a over the project id and each member id. `Math.random()` would have been shorter and wrong twice
over: a presence list that reshuffled on every re-render looks like people walking in and out of the
room, and nothing about the surface could be asserted in a test. Keying on both ids means the same
project always shows the same people and two projects differ.

Roughly a third of the roster, which reads as plausible rather than "everyone is always here".

## It never includes you

```ts
.filter((m) => m.id !== currentUserId)
```

The current user is added by the store as a **real** entry with `mock: false`. If this function also
emitted them, the one true fact in the list would be tagged as invented — and "you should see
yourself" is the requirement the whole design turns on. A test asserts this for every member in the
roster, not just one.
