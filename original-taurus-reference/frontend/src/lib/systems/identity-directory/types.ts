/**
 * Small UI-shaped identity summary used anywhere an actor avatar or profile
 * preview appears. The fixtures are intentionally centralized so people and AI
 * personas do not acquire slightly different cards in each feature.
 */
export type IdentityProfile = {
  id: string;
  kind: 'person' | 'persona';
  name: string;
  email?: string;
  avatarUrl?: string;
  role: string;
  description: string;
  createdAt?: string;
  mock: boolean;
};
