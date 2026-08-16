/**
 * Text in, vectors out. The one thing this capability cannot do itself.
 *
 * It is injected rather than imported because embedding is a network call and
 * nothing here may make one: a Convex mutation runs in a transaction with no
 * outbound requests, so the caller does the embedding and hands the vectors'
 * source down. There is no intelligence capability yet, so the only
 * implementation today is the deterministic fake in `test/fixture.ts` — which is
 * the right test double regardless, because every property this pass proves is
 * about the algorithm and known geometry tests it better than real geometry.
 */
export type Embedder = (texts: string[]) => Promise<number[][]>;

/**
 * The embedder together with what it is.
 *
 * **The binding and the resolved model are both carried, and that is the
 * point.** `binding` is the intelligence key — `"embedding"` — and `model` is
 * what that key pointed at. The key can be repointed at any time and the lattice
 * does not follow; comparing the two is exactly how a required rebuild is
 * detected. Carrying only the binding hides the drift, and only the model loses
 * the connection to the configuration that should be updated.
 */
export type Embedding = {
  readonly binding: string;
  readonly model: string;
  readonly dimensions: number;
  readonly embed: Embedder;
};
