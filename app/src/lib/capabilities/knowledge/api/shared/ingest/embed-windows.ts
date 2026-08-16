import { KnowledgeError } from "$knowledge/errors";
import type { Embedding } from "$knowledge/types/embedding";
import type { WindowPiece } from "$knowledge/types/lattice-node";

/**
 * Windows per embedding request.
 *
 * A provider concern rather than a lattice one, which is why it is not in
 * `configuration/knowledge.yaml`: it moves to the `embedding` binding when the
 * intelligence capability arrives and providers start disagreeing about it.
 */
export const EMBED_BATCH = 32;

/**
 * A vector for every window, embedding only the ones not already held.
 *
 * **This is what makes editing affordable.** Window ids are content-addressed
 * over `(source, text)`, so a window whose text is unchanged keeps its vector
 * and editing one paragraph re-embeds one paragraph. Without it, saving a
 * document re-embeds every window in it, and embedding is the expensive part.
 *
 * `known` is what the source's current level-0 nodes already carry. An id
 * appearing twice — the same boilerplate in two spans of one source — is asked
 * for once, because the answer cannot differ.
 */
export const embedWindows = async (
  pieces: readonly WindowPiece[],
  known: ReadonlyMap<string, readonly number[]>,
  embedding: Embedding
): Promise<Map<string, readonly number[]>> => {
  const vectors = new Map<string, readonly number[]>();
  const wanted = new Map<string, string>();

  for (const piece of pieces) {
    const held = known.get(piece.id);
    if (held) vectors.set(piece.id, held);
    else wanted.set(piece.id, piece.text);
  }

  const ids = [...wanted.keys()];
  for (let from = 0; from < ids.length; from += EMBED_BATCH) {
    const batch = ids.slice(from, from + EMBED_BATCH);
    const embedded = await embedding.embed(batch.map((id) => wanted.get(id) as string));

    if (embedded.length !== batch.length) {
      throw new KnowledgeError(
        "embedder-failed",
        `${embedding.model} returned ${embedded.length} vectors for ${batch.length} windows`
      );
    }
    batch.forEach((id, at) => {
      if (embedded[at].length !== embedding.dimensions) {
        throw new KnowledgeError(
          "embedder-failed",
          `${embedding.model} returned a ${embedded[at].length}-dimensional vector where the lattice holds ${embedding.dimensions}`
        );
      }
      vectors.set(id, embedded[at]);
    });
  }

  return vectors;
};
