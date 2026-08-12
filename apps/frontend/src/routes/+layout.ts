/**
 * Root layout options — these cascade to every route.
 *
 * A single-page app: the Fastify backend on :4000 owns the API, there is no
 * Node server in front of the frontend to render on, and nothing here is
 * public enough to need SEO. `adapter-static` pairs this with an
 * `index.html` fallback, which is what lets a deep link survive a refresh
 * without a server rewrite rule — the constraint that used to keep routing
 * on hashes.
 */
export const ssr = false;
export const prerender = false;
