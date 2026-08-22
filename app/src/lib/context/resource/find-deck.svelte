<script lang="ts">
  import { Panel, PanelNote, PanelRow, PanelSearch } from "$lib/unique-components/panel";
  import { findInDeck, slidesIn, type DeckHit } from "$mock-capabilities/resource";
  import { viewState } from "$model/client/view-state";

  /**
   * Search across the whole deck.
   *
   * `docs/screen-panel-views/context/resource/find-deck.md` is the specification.
   * Deck-wide rather than slide-wide: a slide is small enough to read, and the
   * deck is not. Hits reach into speaker notes, which are not on the canvas at all
   * and would otherwise be unfindable.
   *
   * The field is `PanelSearch` rather than something the frame pins, so the
   * results sit inside the thing that filters them and the scope of the query is
   * answered by the markup.
   */
  let { deckId = "r-board" }: { deckId?: string } = $props();

  const view = viewState();

  let query = $state("");

  const hits = $derived(findInDeck(deckId, query).current);
  const slides = $derived(slidesIn(deckId).current);

  /** An empty field is not a filter, so it shows every hit rather than none. */
  const needle = $derived(query.trim().toLowerCase());
  const shown = $derived(
    needle === ""
      ? hits
      : hits.filter((hit) =>
          `${hit.before}${hit.match}${hit.after}`.toLowerCase().includes(needle)
        )
  );

  const where = (hit: DeckHit) =>
    hit.blockId === undefined
      ? `s.${hit.slide} · ${hit.source}`
      : `s.${hit.slide} · ${hit.source} · block ${hit.blockId}`;

  /**
   * A hit opens what it is inside, which differs by where it came from: a body
   * hit has a block, a notes hit has only its slide.
   */
  const open = (hit: DeckHit) => {
    if (hit.blockId !== undefined) {
      view.inspect("resource.text-block-deck", { kind: "block", id: hit.blockId });
      return;
    }
    const target = slides.find((candidate) => candidate.index === hit.slide);
    if (target === undefined) return;
    view.inspect(
      hit.source === "Speaker notes" ? "resource.speaker-notes" : "resource.slide",
      { kind: "slide", id: target.id }
    );
  };
</script>

<Panel title="Find">
  <PanelSearch
    placeholder="Search this deck"
    matched={shown.length}
    total={hits.length}
    empty="Nothing in the deck matches."
    bind:value={query}
    flush
  >
    {#each shown as hit (hit.id)}
      <PanelRow title={hit.match} sub={where(hit)} onselect={() => open(hit)}>
        {#snippet children()}
          <span class="text-body-sm text-ink-primary truncate">
            {hit.before}<mark
              class="bg-attention-surface text-attention-text rounded-control px-0.5"
              >{hit.match}</mark
            >{hit.after}
          </span>
        {/snippet}
      </PanelRow>
    {/each}
  </PanelSearch>

  <PanelNote tone="gap">
    Whether search reaches into layout-owned locked content is undecided. A hit you
    cannot edit from the slide would have to say so, and none of these do.
  </PanelNote>
</Panel>
