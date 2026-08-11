import type { IdentityProfile } from './types';

// Offline fallback identities for the identity-directory resolver. Real users
// resolve from Omega's enriched `GET /users/:id`, and real personas from the
// personas store (`$systems/personas`); this table only backs the sync fallback
// when a name can't be resolved from the API. Persona identities were retired
// here in Goal 3.4 — they now come from `GET /personas`.
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
