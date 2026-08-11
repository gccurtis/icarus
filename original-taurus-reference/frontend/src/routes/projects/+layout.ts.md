# src/routes/projects/+layout.ts — breakdown

Companion to [+layout.ts](+layout.ts). Disables server-side rendering for the
project screens.

## Layout options

### Client-only rendering

```ts
// Project screens use browser-side session/project stores hydrated from Omega,
// so render them on the client to keep redirects and API effects in one runtime.
// Revisit when session/project loading moves into SvelteKit server load functions.
export const ssr = false;
```

The projects list, workspace route, and their dialogs read browser-side `session`
and `projects` stores that are hydrated through Omega's real APIs. Setting `ssr =
false` at the layout level keeps authentication redirects and project API effects
inside that browser runtime, avoiding a server render with a separate unhydrated
store. Revisit the setting when those reads move into cookie-aware SvelteKit server
load functions.
