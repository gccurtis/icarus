// Project screens use browser-side session/project stores hydrated from Omega,
// so render them on the client to keep redirects and API effects in one runtime.
// Revisit when session/project loading moves into SvelteKit server load functions.
export const ssr = false;
