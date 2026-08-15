/**
 * `/app` is client-rendered.
 *
 * The shell reads the client model, which one layout builds and holds for the
 * life of a client instance. Rendering that on the server would either build a
 * second graph in the process or serve markup from a model nothing initialized,
 * and this flag is what makes neither possible: with SSR off the layout script
 * never runs on the server, so nothing needs a browser guard of its own.
 *
 * This costs content in the first paint and nothing else. Server load functions,
 * remote functions, and `+server.ts` endpoints all still work with SSR off — the
 * client router fetches them. `/` and `/demo` are unaffected and still render on
 * the server.
 *
 * See src/lib/model/client/client.md.
 */
export const ssr = false;
