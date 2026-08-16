import { describe, expect, it, vi } from "vitest";
import type { Scope } from "$access/types/access";
import { retrieve } from "$knowledge/api/shared/retrieve/retrieve";
import { ensureVersion } from "$knowledge/api/shared/version";
import { normalize } from "$knowledge/api/cluster/similarity";
import type { ResourceRef } from "$shared/types/set-expression";
import {
  aCorpus,
  aimedEmbedder,
  asCtx,
  asking,
  leaning,
  refusalFrom
} from "$knowledge/test/fixture";

type Ctx = Awaited<ReturnType<typeof asking>>["ctx"];

/** A project whose lattice is built and an embedder that asks it one direction. */
const aLattice = async (
  ctx: Ctx,
  scope: Scope,
  groups: number,
  aim: (width: number) => number[]
) => {
  const corpus = await aCorpus(ctx, scope, { groups });
  const embedder = aimedEmbedder(aim(corpus.width));
  await ensureVersion(asCtx(ctx), scope, embedder.embedding);
  return { ...corpus, embedder };
};

/** Straight at one group, and at nothing the corpus holds. */
const at = (group: number) => (width: number) => leaning(width, group, 0);
const nowhere = (width: number) => leaning(width, width - 1, 0);

/** Halfway between the first two groups, so descent opens both branches. */
const between = (width: number) =>
  normalize(leaning(width, 0, 0).map((value, index) => value + leaning(width, 1, 0)[index]));

/** Lattice rows only: what the scope resolution reads is not what descent cost. */
const latticeLoads = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.filter(([id]) => String(id).startsWith("latticeNodes:")).length;

const refOf = (source: { kind: string; id: string }): ResourceRef =>
  ({ kind: source.kind, id: source.id }) as ResourceRef;

describe("retrieve", () => {
  it("answers with the source's own words, merged back into one region", async () => {
    const { ctx, scope } = await asking();
    const { texts, embedder } = await aLattice(ctx, scope, 3, at(1));

    const { regions } = await retrieve(
      asCtx(ctx),
      scope,
      { query: "what do we know" },
      embedder.embedding
    );

    expect(embedder.asked).toEqual(["what do we know"]);
    expect(regions).toHaveLength(1);
    // Verbatim, byte for byte: whatever is quoted downstream must be what the
    // source actually says.
    expect(regions[0].text).toBe(texts[1].slice(regions[0].start, regions[0].end));
    expect(regions[0].density).toBe(4);
  });

  it("returns nothing for a query with no good answer, and scans nothing looking", async () => {
    const { ctx, scope } = await asking();
    const { embedder } = await aLattice(ctx, scope, 3, nowhere);

    const loads = vi.spyOn(ctx.db, "get");
    const result = await retrieve(asCtx(ctx), scope, { query: "unrelated" }, embedder.embedding);

    // The least-bad passages in the project read as answers and are not. There
    // is no fallback scan, and nothing was loaded to look for one.
    expect(result).toEqual({ regions: [], scope: null });
    expect(latticeLoads(loads)).toBe(0);
    loads.mockRestore();
  });

  it("filters by scope after descent, not before it", async () => {
    const { ctx, scope } = await asking();
    const { sources, embedder } = await aLattice(ctx, scope, 2, between);

    const open = vi.spyOn(ctx.db, "get");
    const whole = await retrieve(asCtx(ctx), scope, { query: "both" }, embedder.embedding);
    const unscoped = latticeLoads(open);
    open.mockClear();
    const narrowed = await retrieve(
      asCtx(ctx),
      scope,
      { query: "both", scope: { op: "resources", refs: [refOf(sources[1])] } },
      embedder.embedding
    );
    const scoped = latticeLoads(open);
    open.mockRestore();

    // The scope changes the answer and not the descent: the same lattice rows
    // were opened either way, and the out-of-scope source's windows were reached
    // before they were dropped.
    expect(whole.regions).toHaveLength(2);
    expect(scoped).toBe(unscoped);
    expect(narrowed.regions.map((region) => region.source.id)).toEqual([sources[1].id]);
    expect(narrowed.scope?.sourceIds).toEqual([sources[1].id]);
  });

  it("searches the whole lattice when no scope is named", async () => {
    const { ctx, scope } = await asking();
    const { embedder } = await aLattice(ctx, scope, 2, between);

    const result = await retrieve(asCtx(ctx), scope, { query: "both" }, embedder.embedding);

    expect(result.scope).toBeNull();
    expect(result.regions).toHaveLength(2);
  });

  it("answers with nothing at all for a project that has never been indexed", async () => {
    const { ctx, scope } = await asking();
    const embedder = aimedEmbedder(leaning(2, 0, 0));

    const result = await retrieve(asCtx(ctx), scope, { query: "anything" }, embedder.embedding);

    // A project nobody has written in yet has no lattice. That is ordinary, and
    // a refusal would make an empty project an incident.
    expect(result).toEqual({ regions: [], scope: null });
    expect(embedder.asked).toEqual([]);
  });

  it("refuses a query embedded by a model the lattice was not built with", async () => {
    const { ctx, scope } = await asking();
    await aLattice(ctx, scope, 2, at(0));
    const moved = aimedEmbedder(leaning(3, 0, 0), "another-embed-2");

    const refusal = await refusalFrom(
      retrieve(asCtx(ctx), scope, { query: "what do we know" }, moved.embedding)
    );

    // Distances between vectors from two models mean nothing, so a repointed
    // binding is refused rather than answered from.
    expect(refusal).toMatchObject({ capability: "knowledge", code: "embedding-changed" });
  });

  it("answers from the caller's project and no other", async () => {
    const { ctx, scope, elsewhere } = await asking();
    const { embedder } = await aLattice(ctx, scope, 2, at(0));
    const theirs = await aCorpus(ctx, elsewhere, { groups: 2 });

    const { regions } = await retrieve(asCtx(ctx), scope, { query: "ours" }, embedder.embedding);

    expect(regions).toHaveLength(1);
    expect(theirs.sources.map((source) => source.id)).not.toContain(regions[0].source.id);
  });
});
