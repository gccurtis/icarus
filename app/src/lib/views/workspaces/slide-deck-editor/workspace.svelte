<script lang="ts">
  import Lock from "@lucide/svelte/icons/lock";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import SquareDashed from "@lucide/svelte/icons/square-dashed";

  import {
    ScreenBanner,
    ScreenCard,
    ScreenGroup,
    ScreenNote,
    ScreenSurface,
    ScreenThumb
  } from "$components/authored/screen";
  import { Button } from "$lib/components/vendor/button";
  import { ToggleGroup, ToggleGroupItem } from "$lib/components/vendor/toggle-group";
  import {
    deckRecord,
    deckTextBlock,
    deckTheme,
    element,
    layersOn,
    layout,
    layoutObjectsOn,
    layoutsIn,
    lockedContentIn,
    placeholdersIn,
    slide
  } from "$capabilities/resource";
  import { viewState, type InspectionKey } from "$model/client/view-state";

  const view = viewState();

  /**
   * Slide deck editor — every state this screen has.
   *
   * `docs/screen-panel-views/screens/slide-deck-editor/workspace.md` is the
   * specification. **One region, `editor`, and one track.** Editing a slide,
   * editing a layout and choosing a new slide are all states of this one editor:
   * the framework does not change between them, only what it is showing, so the
   * layout table is a single `1fr` column and a single band.
   *
   * **Fabric is not installed.** Selection, transform handles, snapping and hit
   * testing would be its; what is drawn here is the part that is ours — frames
   * held as fractions of the slide, layout-owned content told apart from
   * placeholders by how it is outlined, a nested block with an inline formula in
   * it, and the two-question chooser. Nothing here can be dragged.
   *
   * **The state comes in as ids, not as a mode switch on the canvas.** New,
   * duplicate, delete and hide live at the top of the Slides panel and layout
   * editing is entered from the Layouts panel — a toolbar across the canvas is
   * exactly what this screen refuses — so `layoutId` puts the editor in layout
   * mode and `choosing` raises the chooser, both set by the panel that already
   * holds the thing they act on.
   *
   * **Layout-owned objects are drawn behind the slide's own.** Cross-layer
   * ordering is undefined in the model, so that is a convention rather than a
   * rule, and the note under the canvas says so.
   */
  let {
    deckId = "r-board",
    slideId = "sl-4",
    layoutId = undefined,
    choosing = $bindable(false)
  }: {
    deckId?: string;
    slideId?: string;
    /** Set by the Layouts panel. Its presence *is* the layout subscreen. */
    layoutId?: string;
    /** Raised from the top of the Slides panel; an overlay, never a state of its own. */
    choosing?: boolean;
  } = $props();

  const deck = $derived(deckRecord(deckId).current);
  const current = $derived(slide(slideId).current);
  const theme = $derived(deckTheme(deckId).current);
  const layers = $derived(layersOn(slideId).current);
  const behind = $derived(layoutObjectsOn(slideId).current);
  const options = $derived(layoutsIn(deckId).current);

  /** The layout being edited, when one is. Never the slide's own by accident. */
  const editing = $derived(layoutId === undefined ? undefined : layout(layoutId).current);
  const slots = $derived(layoutId === undefined ? [] : placeholdersIn(layoutId).current);
  const owned = $derived(layoutId === undefined ? [] : lockedContentIn(layoutId).current);

  /**
   * Back to front. `layersOn` answers in stacking order, front first, which is
   * how a Layers panel reads it and the reverse of how a canvas paints it.
   */
  const painted = $derived(
    layers
      .map((layer) => ({ layer, box: element(layer.id).current }))
      .slice()
      .reverse()
  );

  /** The nested block, addressed by the element that holds it — there is no element-to-block door. */
  const nested = $derived(deckTextBlock(slideId).current);

  const ratio = $derived(deck.aspectRatio.replace(":", " / "));

  /** What this deck is configured as, opposite the caveat rather than inside it. */
  const configured = $derived(
    `${deck.aspectRatio} · handout ${deck.handout.paper}, ${deck.handout.perPage} per page`
  );

  type Frame = {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
  };

  /** Fractions of the slide, never pixels, so a deck survives a change of aspect ratio. */
  const box = (frame: Frame) =>
    `left: ${frame.x * 100}%; top: ${frame.y * 100}%; width: ${frame.w * 100}%; height: ${frame.h * 100}%`;

  let selected = $state<string | undefined>(undefined);

  const inspect = (key: InspectionKey, kind: string, id: string) => {
    selected = id;
    view.inspect(key, { kind, id });
  };

  /** The two questions inserting a slide actually involves, asked in one pass. */
  let where = $state("after");
  let from = $state("copy");

  const WHERE = $derived([
    { value: "after", label: "After this slide" },
    { value: "before", label: "Before this slide" },
    { value: "section", label: `End of ${current.sectionName}` },
    { value: "deck", label: "End of the deck" }
  ]);

  /** Zoom, by the same pinch mechanism as the document. */
  let zoom = $state(1);

  const pinch = (event: WheelEvent) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    zoom = Math.min(2, Math.max(0.5, zoom - event.deltaY / 400));
  };
</script>

<ScreenSurface wide class="gap-0 overflow-y-hidden p-0">
  <div class="board">
    <div class="area-editor">
      <!--
        Said where you can see it rather than in a dialog you dismissed: the
        number that matters is how many slides an edit here will change.
      -->
      {#if editing}
        <div class="px-4 pt-3">
          <ScreenBanner
            title="Editing {editing.name} changes every slide using it"
            meta="{editing.usedBy} slides"
          >
            Locked content belongs to the layout and no slide can touch it. A placeholder is a
            frame each slide fills with its own copy.
          </ScreenBanner>
        </div>
      {/if}

      <div class="canvas bg-surface-canvas" onwheel={pinch}>
        <div class="pasteboard" style="--zoom: {zoom}">
          <div
            class="slide bg-surface-panel border-border-subtle border"
            style="aspect-ratio: {ratio}"
          >
            {#if editing}
              <!--
                Two kinds of thing, drawn differently because they behave
                differently: solid for content the layout owns, dashed for a
                frame a slide fills in.
              -->
              {#each owned as object (object.id)}
                <button
                  type="button"
                  class="object locked border-border-strong bg-surface-elevated"
                  class:is-selected={selected === object.id}
                  style={box(object.frame)}
                  onclick={() => inspect("resource.locked-element", "element", object.id)}
                >
                  <span class="text-ink-muted flex items-center gap-1">
                    <Lock size={12} aria-hidden="true" />
                    <span class="text-caption truncate">{object.content}</span>
                  </span>
                </button>
              {/each}

              {#each slots as slot (slot.index)}
                <button
                  type="button"
                  class="object slot border-border-strong"
                  class:is-selected={selected === `${editing.id}:${slot.index}`}
                  style={box(slot.frame)}
                  onclick={() =>
                    inspect("resource.placeholder", "placeholder", `${editing.id}:${slot.index}`)}
                >
                  <span class="text-ink-muted flex items-center gap-1">
                    <SquareDashed size={12} aria-hidden="true" />
                    <span class="text-caption truncate">
                      {slot.role}
                      {#if slot.sameRoleAsAbove}
                        <!--
                          A placeholder has no stable key, so a duplicate role can
                          only be described by its neighbour. Two boxes reading
                          "body" with nothing to tell them apart is the bug this
                          line stands in for.
                        -->
                        · the second of two
                      {/if}
                    </span>
                  </span>
                </button>
              {/each}
            {:else}
              <!--
                What the resolved layout owns, so the slide is complete rather
                than mysteriously missing its footer. Drawn behind by convention:
                cross-layer order is undefined in the model.
              -->
              {#each behind as object (object.id)}
                <button
                  type="button"
                  class="object locked border-border-subtle"
                  class:is-selected={selected === object.id}
                  style={box(object.frame)}
                  onclick={() => inspect("resource.locked-element", "element", object.id)}
                >
                  <span class="text-caption text-ink-muted truncate">{object.content}</span>
                </button>
              {/each}

              {#each painted as { layer, box: shape } (layer.id)}
                <button
                  type="button"
                  class="object"
                  class:has-border={shape.border !== "None"}
                  class:bg-surface-panel={shape.fill !== "None"}
                  class:border-border-subtle={shape.border !== "None"}
                  class:is-selected={selected === shape.id}
                  style="{box(shape.frame)}; rotate: {shape.rotation}deg"
                  onclick={() => inspect("resource.element", "element", shape.id)}
                >
                  {#if layer.kind === "chart"}
                    <!--
                      A chart's bars take the deck's ordered colour set. A theme
                      colour has a name and no role, so nothing on a slide can
                      ask for "the accent" — it takes them in order or not at all.
                    -->
                    <span class="chart" aria-hidden="true">
                      {#each theme.colors as colour, index (colour.id)}
                        <span
                          class="bar"
                          style="background: var({colour.token}); height: {[62, 88, 45, 74][
                            index % 4
                          ]}%"
                        ></span>
                      {/each}
                    </span>
                    <span class="text-caption text-ink-muted truncate">{shape.content}</span>
                  {:else if shape.fromPlaceholder === "title"}
                    <span class="text-h3 leading-h3 text-ink-primary font-semibold">
                      {shape.content}
                    </span>
                  {:else}
                    <span class="text-body-sm text-ink-secondary">
                      {shape.content}
                      <!--
                        An inline formula inside slide text, as in a document. The
                        element is the spatial container and this is the block
                        inside it: two different things, with two different lenses.
                      -->
                      {#each nested.formulas as atom (atom.id)}
                        <span
                          class="text-ink-primary underline decoration-dotted underline-offset-2"
                          title="{atom.expression} · {atom.readsWhen}"
                        >
                          {atom.shows}
                        </span>
                      {/each}
                    </span>
                  {/if}
                </button>
              {/each}
            {/if}
          </div>

          <span class="text-caption text-ink-muted tabular-nums">
            {#if editing}
              {editing.name} · {editing.placeholders} placeholders · {editing.locked} locked
            {:else}
              Slide {current.index} of {deck.slides} · {current.sectionName} · {current.layoutName}
            {/if}
          </span>
        </div>
      </div>

      <!--
        The chooser is an overlay over this editor, not a state of its own — you
        are still in the slide editor, and the slide is still behind it. It asks
        the two questions inserting a slide actually involves, in one pass.
      -->
      {#if choosing}
        <div class="chooser bg-surface-canvas/95">
          <div class="chooser-body">
            <ScreenGroup label="Where it goes">
              <ToggleGroup type="single" bind:value={where} variant="outline" size="sm">
                {#each WHERE as option (option.value)}
                  <ToggleGroupItem value={option.value}>{option.label}</ToggleGroupItem>
                {/each}
              </ToggleGroup>
            </ScreenGroup>

            <ScreenGroup label="What it starts from" count={String(options.length + 2)}>
              <div class="starts">
                <ScreenCard
                  title="A copy of this slide"
                  sub={current.title}
                  selected={from === "copy"}
                  onselect={() => (from = "copy")}
                >
                  {#snippet thumb()}
                    <ScreenThumb ratio={ratio} lines={3} />
                  {/snippet}
                </ScreenCard>

                <ScreenCard
                  title="Blank"
                  sub="Nothing on it"
                  selected={from === "blank"}
                  onselect={() => (from = "blank")}
                >
                  {#snippet thumb()}
                    <ScreenThumb ratio={ratio} lines={0} />
                  {/snippet}
                </ScreenCard>

                <!-- Each card names its placeholder roles: that is what choosing one buys. -->
                {#each options as option (option.id)}
                  {@const roles = placeholdersIn(option.id).current}
                  <ScreenCard
                    title={option.name}
                    sub={roles.length === 0
                      ? "No placeholders"
                      : roles.map((role) => role.role).join(" · ")}
                    selected={from === option.id}
                    onselect={() => (from = option.id)}
                  >
                    {#snippet thumb()}
                      <ScreenThumb
                        ratio={ratio}
                        lines={Math.max(roles.length, 1)}
                        variables={roles.length}
                      />
                    {/snippet}
                    <span class="text-caption text-ink-muted">
                      {option.locked} locked · used by {option.usedBy}
                    </span>
                  </ScreenCard>
                {/each}
              </div>
            </ScreenGroup>

            <ScreenNote>
              Each placeholder becomes an ordinary element the new slide owns. Locked layout
              content stays with the layout and is never copied in. Copying mints new ids for the
              slide and every identified descendant, or two slides would share element identity.
            </ScreenNote>

            <div class="flex justify-end gap-2">
              <Button variant="outline" size="sm" onclick={() => (choosing = false)}>Cancel</Button>
              <Button size="sm" onclick={() => (choosing = false)}>Insert slide</Button>
            </div>
          </div>
        </div>
      {/if}

      <div class="under bg-surface-panel border-border-subtle flex flex-col gap-1 border-t px-4 py-2">
        <ScreenNote tone="gap" meta="Pinch to zoom · {Math.round(zoom * 100)}%">
          Fabric is not installed, so this whole region is a proposal. The adapter spike has to
          prove three things first: IME and text alignment inside a nested editor, nested hit
          testing, and stable reconciliation against remote changes. Nothing here can be dragged,
          and there are no transform handles.
        </ScreenNote>
        <ScreenNote meta={configured}>
          What is drawn is what Icarus adds: frames held as fractions of the slide, an element and
          the block inside it kept as two different things, layouts whose locked content is
          outlined solid and whose placeholders are outlined dashed, and inline formulas in slide
          text. What is in front of what across the two layers is a convention — the model does
          not say.
        </ScreenNote>
      </div>
    </div>
  </div>
</ScreenSurface>

<style>
  /**
   * The layout table from the specification: one `1fr` track, one `editor` band.
   * There is nothing for a narrow fallback to reorder — a single column is
   * already what one would produce — so the slide keeps its aspect ratio and the
   * pasteboard gives up its room instead.
   */
  .board {
    display: grid;
    flex: 1;
    min-height: calc(var(--token-spacing-unit) * 120);
    grid-template-columns: 1fr;
    grid-template-areas: "editor";
  }

  /* `relative` so the chooser can cover the editor rather than only the slide. */
  .area-editor {
    position: relative;
    grid-area: editor;
    display: flex;
    min-height: 0;
    min-width: 0;
    flex-direction: column;
  }

  .canvas {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  .pasteboard {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 2);
    padding: calc(var(--token-spacing-unit) * 8);
    transform: scale(var(--zoom));
    transform-origin: top center;
  }

  /* One slide, at the deck's aspect ratio, on a pasteboard. Never a page of them. */
  .slide {
    position: relative;
    width: calc(var(--token-spacing-unit) * 200);
    max-width: 100%;
    overflow: hidden;
    box-shadow: var(--token-shadow-raised);
  }

  .object {
    position: absolute;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: calc(var(--token-spacing-unit) * 1);
    padding: calc(var(--token-spacing-unit) * 2);
    text-align: start;
    overflow: hidden;
  }

  .object.has-border {
    border-width: 1px;
    border-style: solid;
  }

  /* Solid: the layout owns it and a slide cannot touch it. */
  .locked {
    border-width: 1px;
    border-style: solid;
  }

  /* Dashed: a frame a slide fills in with its own copy. */
  .slot {
    border-width: 1px;
    border-style: dashed;
  }

  .object:hover {
    outline: 1px solid var(--token-color-interactive-border);
  }

  .object.is-selected {
    outline: 2px solid var(--token-color-active-border);
  }

  .chart {
    display: flex;
    flex: 1;
    align-items: flex-end;
    gap: calc(var(--token-spacing-unit) * 2);
    min-height: 0;
  }

  .bar {
    flex: 1;
    border-radius: var(--token-radius-control) var(--token-radius-control) 0 0;
  }

  .chooser {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: calc(var(--token-spacing-unit) * 4);
    overflow: auto;
  }

  .chooser-body {
    display: flex;
    width: 100%;
    max-width: calc(var(--token-spacing-unit) * 180);
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 3);
  }

  .starts {
    display: grid;
    gap: calc(var(--token-spacing-unit) * 2);
    grid-template-columns: repeat(auto-fill, minmax(calc(var(--token-spacing-unit) * 34), 1fr));
  }

  .under {
    flex-shrink: 0;
  }
</style>
