# Personas surface un-mocked — real personas from Omega

Goal 3.4 from the integration plan — replace the mock persona identities with the project's
real personas from Omega's `GET /personas` (+ `GET /personas/default`). Verified live against a
fresh build of Omega `main` on `:8444`.

## New `$systems/personas` module

- `types.ts` — mirrors Omega's `{ persona, version }` envelope (`PersonaMeta`, `PersonaVersion`,
  `PersonaDefinition`, `PersonaEnvelope`) plus a flattened `Persona` for the UI and the
  `PersonasState` store payload.
- `store.ts` — a `personas` writable + `loadPersonas()`. Resolves the default persona id from
  `/personas/default` (best-effort), loads `/personas`, and flattens each envelope, flagging the
  default. Strict project isolation: resets to `idle` on project switch (mirrors the ai-agent
  store's `workspace.subscribe`).
- `index.ts` — barrel.

## PersonasPanel now lists real personas

`PersonasPanel.svelte` was an honest placeholder ("Arrives with the agents stage"). It now loads
the store on first open and renders a card per persona (name + description) with a **Default**
badge on the persona returned by `/personas/default`, plus loading/error/empty states.

## Retired the mock persona identities

`identity-directory/mocks.ts` dropped its four `kind: 'persona'` entries (Research verifier, Orbit
Analysis Agent, Editorial agent, Taurus); `MOCK_IDENTITIES` now holds only person fallbacks. With
no mock personas left, `resolvers.ts` `getIdentityProfile` no longer classifies any synthesized
fallback as a persona — real personas resolve from the personas store or carry `kind: 'persona'`
from the enriched `GET /users/:id`. Updated the resolver test accordingly.

## Verification

- Shapes confirmed live on `:8444`: `GET /personas` → `{ personas: [{ persona:{id,name,description,
  currentVersion,...}, version:{definition:{focus,behavioralGuidance,contextReferences,
  defaultVerification,outputPreferences}} }] }`; `GET /personas/default` → the same envelope
  (system "General" persona). A fresh project lists exactly the seeded "General" default.
- `svelte-check` clean (0 errors); `resolvers.test.ts` 13/13 pass.

## Still mocked / out of scope

Persona *editing* (create/version/assign) is not wired — this Goal is the read-only directory +
picker source. The dock's persona picker consumes this same store as part of Goal 3.3.
