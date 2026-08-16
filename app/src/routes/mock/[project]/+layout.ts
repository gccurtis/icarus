/**
 * `/mock` is client-rendered, for the same reason `/app` is.
 *
 * A mock builds its own client instance rather than borrowing the application's,
 * so it needs the same flag: with SSR off this subtree's layout script never runs
 * on the server, and nothing here needs a browser guard of its own.
 *
 * See src/lib/model/client/client.md.
 */
export const ssr = false;
