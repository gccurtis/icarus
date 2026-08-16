import { describe, expect, it } from "vitest";
import { EMBED_BATCH, embedWindows } from "$knowledge/api/shared/ingest/embed-windows";
import { windowId } from "$knowledge/api/shared/ingest/window-id";
import type { WindowPiece } from "$knowledge/types/lattice-node";
import type { LatticeSource } from "$knowledge/types/lattice-source";
import { fakeEmbedder, refusalFrom } from "$knowledge/test/fixture";

const source: LatticeSource = { kind: "document", id: "documents:1" as never };

const piece = (text: string, start = 0): WindowPiece => ({
  id: windowId(source, text),
  source,
  start,
  end: start + text.length,
  text
});

describe("embedWindows", () => {
  it("embeds every window when nothing is known", async () => {
    const { embedding, texts } = fakeEmbedder();
    const pieces = [piece("alpha"), piece("beta", 5)];

    const vectors = await embedWindows(pieces, new Map(), embedding);

    expect(texts()).toEqual(["alpha", "beta"]);
    expect(vectors.get(pieces[0].id)).toHaveLength(embedding.dimensions);
  });

  it("keeps a known window's vector and never asks for it again", async () => {
    const { embedding, texts } = fakeEmbedder();
    const unchanged = piece("alpha");
    const held = new Array<number>(embedding.dimensions).fill(0);
    held[0] = 1;

    const vectors = await embedWindows(
      [unchanged, piece("beta", 5)],
      new Map([[unchanged.id, held]]),
      embedding
    );

    // The count of texts asked for is the assertion, not the vectors: a test
    // reading only the vectors passes against an implementation that re-embeds
    // everything and happens to get the same answer back.
    expect(texts()).toEqual(["beta"]);
    expect(vectors.get(unchanged.id)).toBe(held);
  });

  it("asks for nothing at all when nothing changed", async () => {
    const { embedding, batches } = fakeEmbedder();
    const pieces = [piece("alpha"), piece("beta", 5)];
    const known = new Map(pieces.map((p) => [p.id, [1, 0]]));

    await embedWindows(pieces, known, embedding);

    expect(batches).toEqual([]);
  });

  it("asks once for text repeated inside one source", async () => {
    const { embedding, texts } = fakeEmbedder();

    await embedWindows([piece("boilerplate"), piece("boilerplate", 99)], new Map(), embedding);

    expect(texts()).toEqual(["boilerplate"]);
  });

  it("splits the work into batches rather than one enormous call", async () => {
    const { embedding, batches } = fakeEmbedder();
    const pieces = Array.from({ length: EMBED_BATCH + 3 }, (_, n) => piece(`window ${n}`, n));

    await embedWindows(pieces, new Map(), embedding);

    expect(batches.map((batch) => batch.length)).toEqual([EMBED_BATCH, 3]);
  });

  it("refuses when the embedder answers with the wrong number of vectors", async () => {
    const { embedding } = fakeEmbedder();
    const short = { ...embedding, embed: async () => [] };

    const refusal = await refusalFrom(embedWindows([piece("alpha")], new Map(), short));

    expect(refusal?.code).toBe("embedder-failed");
  });

  it("refuses a vector of a width the index cannot hold", async () => {
    const { embedding } = fakeEmbedder();
    const narrow = { ...embedding, embed: async () => [[1, 0]] };

    const refusal = await refusalFrom(embedWindows([piece("alpha")], new Map(), narrow));

    // Stored, it would be a row the vector index rejects at insert and a
    // distance that means nothing if it did not.
    expect(refusal?.code).toBe("embedder-failed");
  });
});
