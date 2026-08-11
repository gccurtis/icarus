# src/lib/systems/identity-directory/mocks.ts — breakdown

Companion to [mocks.ts](mocks.ts). The offline fallback identity table for the
identity-directory resolver. Real users resolve from Omega's enriched
`GET /users/:id` and real personas from the personas store — this table only backs
the synchronous fallback when a name can't be resolved from the API.

## Import and table purpose

### The `IdentityProfile` import and the comment explaining the fallback

```ts
import type { IdentityProfile } from './types';

// Offline fallback identities for the identity-directory resolver. Real users
// resolve from Omega's enriched `GET /users/:id`, and real personas from the
// personas store (`$systems/personas`); this table only backs the sync fallback
// when a name can't be resolved from the API. Persona identities were retired
// here in Goal 3.4 — they now come from `GET /personas`.
```

The only import is the `IdentityProfile` type. The comment carries the intent: this
table is a last-resort synchronous fallback — real people come from Omega's enriched
`GET /users/:id` and real personas from the personas store — and the former `persona`
entries were retired in Goal 3.4 in favor of `GET /personas`.

## The MOCK_IDENTITIES table

### Three `person` fallback profiles, all flagged `mock: true`

```ts
export const MOCK_IDENTITIES: IdentityProfile[] = [
  {
    id: 'mock_maya',
    kind: 'person',
    name: 'Maya Chen',
    email: 'maya@mock.taurus.local',
    role: 'Research lead',
    description: 'Coordinates the Star Map Research project and its source review.',
    createdAt: '2025-11-08T14:30:00Z',
    mock: true
  },
  {
    id: 'mock_owen',
    kind: 'person',
    name: 'Owen Park',
    email: 'owen@mock.taurus.local',
    role: 'Project viewer',
    description: 'Reviews catalog sources and linked research material.',
    createdAt: '2026-02-14T09:15:00Z',
    mock: true
  },
  {
    id: 'mock_dev',
    kind: 'person',
    name: 'Dev',
    email: 'dev@taurus.local',
    role: 'Editor',
    description: 'Current Taurus Alpha development user.',
    createdAt: '2026-07-20T09:00:00Z',
    mock: true
  }
];
```

Three `person` profiles — Maya Chen (research lead), Owen Park (project viewer), and
Dev (the current development user) — each carrying `mock: true` so the UI can badge a
synthesized identity. The four former `kind: 'persona'` entries were removed in Goal
3.4, so the resolver's synchronous fallback now only ever produces a person card (see
[resolvers.ts.md](resolvers.ts.md)).
