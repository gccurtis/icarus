<script lang="ts">
  /**
   * The catalogue's table of contents, with a filter over it.
   *
   * Twelve sections holding well over a hundred shapes is a page you scroll
   * looking for one word. The filter matches the section name and the words
   * under it, so typing "swatch" or "colour" lands you on the section that holds
   * it rather than on the first heading that happens to contain the letters.
   */
  const SECTIONS = [
    { id: "choosing", label: "Choosing", about: "which family, panel or screen, flank or plane" },
    { id: "panel-parts", label: "Panel parts", about: "panel section row field fields chip note button" },
    { id: "editing", label: "Editing", about: "input number range date select choice editable text marks colour" },
    { id: "panel-values", label: "Panel values", about: "swatch swatches meter stat stats progress code pairs" },
    { id: "panel-facts", label: "Panel facts", about: "actor faces link crumbs quote sentence keys skeleton" },
    { id: "panel-shapes", label: "Panel shapes", about: "timeline steps tree branch diff table cards empty banner placeholder" },
    { id: "screen-parts", label: "Screen parts", about: "surface header action group bar filters table row cell cards card" },
    { id: "screen-plane", label: "Screen plane", about: "canvas page slide grid split composer shelf thumb stats strip list item" },
    { id: "dragging", label: "Dragging", about: "drag handle resize reorder move" },
    { id: "compositions", label: "Compositions", about: "whole panels assembled from the parts" },
    { id: "data-shapes", label: "Data shapes", about: "what each form would have to ask the backend for" }
  ];

  let query = $state("");

  const matches = $derived(
    SECTIONS.filter((section) => {
      const needle = query.trim().toLowerCase();
      if (!needle) return true;
      return `${section.label} ${section.about}`.toLowerCase().includes(needle);
    })
  );
</script>

<aside class="border-border-subtle hidden w-60 shrink-0 border-e lg:block">
  <div class="sticky top-11 flex max-h-[calc(100vh-2.75rem)] flex-col gap-2 p-4">
    <span class="eyebrow">The catalogue</span>

    <input
      type="search"
      bind:value={query}
      placeholder="Find a shape…"
      aria-label="Filter the catalogue"
      class="border-border-strong rounded-control bg-surface-elevated text-body-sm text-ink-primary placeholder:text-ink-muted h-8 w-full px-2"
    />

    <nav class="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto" aria-label="Catalogue sections">
      {#each matches as section (section.id)}
        <a
          href="#{section.id}"
          class="hover:bg-surface-panel-hover duration-micro ease-standard rounded-control flex flex-col px-2 py-1.5"
        >
          <span class="text-body-sm text-ink-primary font-medium">{section.label}</span>
          <span class="text-micro text-ink-muted truncate">{section.about}</span>
        </a>
      {/each}

      {#if matches.length === 0}
        <p class="text-caption text-ink-muted m-0 px-2 py-3">
          Nothing here matches “{query}”.
        </p>
      {/if}
    </nav>
  </div>
</aside>
