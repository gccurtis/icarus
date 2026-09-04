<script lang="ts">
  import { onMount, untrack } from "svelte";
  import Konva from "konva";

  import { read } from "$capabilities/store/index.remote";
  import {
    styleOf,
    textOf,
    withElementFrame,
    type SlideDeckBody,
    type SlideElement
  } from "$app-views/categories/slide-deck-editor/procedures/deck";
  import {
    clampZoom,
    fitZoom,
    slideUnits,
    gutterOf,
    stageMetrics,
    toFrame,
    toPixels
  } from "$app-views/categories/slide-deck-editor/procedures/stage";
  import { palette, type Palette } from "$app-views/categories/slide-deck-editor/procedures/tokens";
  import { workspaceState, type SlideDeckRuntime } from "$model/client/workspace-state";

  const WHEEL_NOTCH = 120;
  const PERCENT_PER_NOTCH = 2;

  const view = workspaceState();

  const deckId = $derived(view.active.resourceId);

  const deckTitle = $derived.by(() => {
    if (deckId === undefined) return undefined;

    const answer = read({ path: `slideDecks.${deckId}.title` });
    if (!answer.ready) return undefined;

    const found = answer.current;
    return found?.kind === "field" && typeof found.value === "string" ? found.value : undefined;
  });

  let runtime = $state<SlideDeckRuntime | undefined>(undefined);

  let selected = $state<string | undefined>(undefined);

  /**
   * The runtime holds one body and it is already optimistic, so there is no
   * local copy to keep in step with the panel's.
   */
  const body = $derived(runtime?.body);

  /**
   * Which slide is a tab's question, not this component's — the panel asks it
   * too, and two answers would be two selections. A focus naming a slide that
   * has been deleted falls back to the first, the way `view.zoom` falls back.
   */
  const index = $derived.by(() => {
    const slides = body?.slides;
    if (slides === undefined || slides.length === 0) return 0;

    const at = slides.findIndex((slide) => slide.id === view.active.focus);
    return at === -1 ? 0 : at;
  });

  let host = $state<HTMLDivElement>();
  let surface = $state<HTMLDivElement>();
  let available = $state(0);
  let rem = $state(16);

  let stage: Konva.Stage | undefined;
  let layer: Konva.Layer | undefined;
  let picker: Konva.Transformer | undefined;

  const geometry = $derived(runtime?.stage);
  const fit = $derived(
    geometry === undefined || available === 0 ? undefined : fitZoom(available, geometry)
  );
  const metrics = $derived(
    geometry === undefined ? undefined : stageMetrics(body, view.zoom ?? fit ?? null, geometry)
  );
  const gutter = $derived(
    geometry === undefined || metrics === undefined
      ? 0
      : gutterOf(available, metrics.drawn.width, geometry)
  );

  const drawn = $derived({
    width: metrics === undefined ? 0 : Math.round(metrics.drawn.width * rem),
    height: metrics === undefined ? 0 : Math.round(metrics.drawn.height * rem)
  });

  const scale = $derived(metrics === undefined ? 1 : drawn.width / metrics.units.width);

  const slideStyle = $derived(`width: ${drawn.width}px; height: ${drawn.height}px`);

  const pinch = (event: WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();

    if (geometry === undefined || metrics === undefined) return;

    const by = (event.deltaY / WHEEL_NOTCH) * PERCENT_PER_NOTCH;
    view.setZoom(clampZoom(metrics.zoom - by, geometry));
  };

  const nodeFor = (
    deck: SlideDeckBody,
    units: { width: number; height: number },
    element: SlideElement,
    paint: Palette
  ): Konva.Shape => {
    const box = toPixels(element.frame, units);
    const block = textOf(element);

    if (block === undefined) {
      const format = element.format;
      return new Konva.Rect({
        id: element.id,
        ...box,
        draggable: true,
        cornerRadius: 2,
        fill: paint(format?.background, "--token-surface-panel"),
        stroke: format?.border && paint(format.border.color, "--token-border-subtle"),
        strokeWidth: format?.border?.width ?? 0
      });
    }

    const style = styleOf(deck, block);
    const weight = [style?.bold ? "bold" : "", style?.italic ? "italic" : ""]
      .filter(Boolean)
      .join(" ");

    return new Konva.Text({
      id: element.id,
      ...box,
      draggable: true,
      text: block.display,
      fontFamily: style?.fontFamily ?? deck.theme.fontFamily ?? "IBM Plex Sans",
      fontSize: style?.fontSize ?? 20,
      fontStyle: weight === "" ? "normal" : weight,
      fill: paint(style?.color ?? deck.theme.colors.text, "--token-ink-primary"),
      lineHeight: 1.3,
      verticalAlign: "middle"
    });
  };

  const draw = () => {
    if (layer === undefined || picker === undefined) return;

    const deck = body;
    if (deck === undefined) return;

    const slide = deck.slides[index];
    if (slide === undefined) return;

    const held = runtime?.stage;
    if (held === undefined) return;

    const units = slideUnits(deck.aspectRatio, held);
    const paint = palette();

    for (const node of [...layer.getChildren((child) => child !== picker)]) node.destroy();
    picker.nodes([]);

    for (const element of slide.elements) {
      const node = nodeFor(deck, units, element, paint);

      node.on("click tap", () => {
        selected = element.id;
        picker?.nodes([node]);
      });

      node.on("dragend", () => {
        const moved = withElementFrame(
          deck,
          slide.id,
          element.id,
          toFrame(
            { x: node.x(), y: node.y(), width: node.width(), height: node.height() },
            units
          )
        );
        if (moved.ops.length === 0) return;

        runtime?.apply(moved.ops);
      });

      layer.add(node);
    }

    const kept = selected === undefined ? undefined : layer.findOne(`#${selected}`);
    picker.nodes(kept ? [kept] : []);
  };

  onMount(() => {
    if (host === undefined) {
      throw new Error("The slide editor did not mount its canvas host.");
    }

    const mounted = new Konva.Stage({ container: host, width: 1, height: 1 });
    const drawn = new Konva.Layer();
    const transformer = new Konva.Transformer({
      resizeEnabled: false,
      rotateEnabled: false,
      borderStroke: palette()(undefined, "--token-color-active-border"),
      borderStrokeWidth: 2
    });

    drawn.add(transformer);
    mounted.add(drawn);

    mounted.on("click tap", (event) => {
      if (event.target === mounted) {
        selected = undefined;
        transformer.nodes([]);
      }
    });

    stage = mounted;
    layer = drawn;
    picker = transformer;

    return () => {
      mounted.destroy();
      stage = undefined;
      layer = undefined;
      picker = undefined;
    };
  });

  $effect(() => {
    const element = surface;
    if (element === undefined) return;

    const measure = () => {
      const root = parseFloat(getComputedStyle(document.documentElement).fontSize);
      rem = root > 0 ? root : 16;
      available = element.clientWidth / rem;
    };

    const watcher = new ResizeObserver(measure);
    watcher.observe(element);
    measure();

    return () => watcher.disconnect();
  });

  $effect(() => {
    runtime = deckId === undefined ? undefined : view.slideDeckRuntime(deckId);
  });

  /** A selection outlives the element it named only until the next body. */
  $effect(() => {
    const slide = body?.slides[index];
    if (slide === undefined) return;

    if (!slide.elements.some((element) => element.id === selected)) selected = undefined;
  });

  $effect(() => {
    void index;
    void body;
    untrack(() => draw());
  });

  $effect(() => {
    const mounted = stage;
    if (mounted === undefined || drawn.width === 0) return;

    mounted.size({ width: drawn.width, height: drawn.height });
    mounted.scale({ x: scale, y: scale });
  });
</script>

<div class="deck">
  <header class="area-title bg-surface-panel border-border-subtle border-b">
    <h1 class="text-body-sm text-ink-primary m-0 truncate font-medium">
      {deckTitle ?? "Loading deck..."}
    </h1>
  </header>

  <div bind:this={surface} class="area-canvas bg-surface-pasteboard" onwheel={pinch}>
    <div class="pasteboard" style="--gutter: {gutter}rem">
      <div
        class="slide bg-surface-elevated border-border-subtle border"
        style={slideStyle}
      >
        <div bind:this={host} class="host" aria-label="Slide canvas"></div>
      </div>
    </div>
  </div>

  <div class="area-strip bg-surface-panel border-border-subtle flex items-center gap-2 border-t">
    {#if body}
      {#each body.slides as slide, position (slide.id)}
        <button
          type="button"
          class="pip"
          class:is-current={position === index}
          aria-label="Slide {position + 1}"
          aria-current={position === index ? "true" : undefined}
          onclick={() => {
            selected = undefined;
            if (deckId !== undefined) {
              view.open({ category: "slide-deck-editor", resourceId: deckId, focus: slide.id });
            }
          }}
        >
          <span class="text-caption tabular-nums">{position + 1}</span>
        </button>
      {/each}
      <span class="text-caption text-ink-muted ms-auto tabular-nums">
        Slide {index + 1} of {body.slides.length} · {body.aspectRatio} · {runtime?.sync ?? "loading"}
      </span>
    {:else}
      <span class="text-caption text-ink-muted ms-auto">
        {runtime?.sync === "error" ? "This deck could not be read." : "Reading this deck..."}
      </span>
    {/if}
  </div>
</div>

<style>
  .deck {
    display: grid;
    height: 100%;
    min-height: 0;
    grid-template-rows: auto 1fr auto;
    grid-template-columns: 1fr;
    grid-template-areas:
      "title"
      "canvas"
      "strip";
  }

  .area-title {
    grid-area: title;
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 4);
  }

  .area-canvas {
    grid-area: canvas;
    min-height: 0;
    overflow: auto;
  }

  .area-strip {
    grid-area: strip;
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 4);
  }

  .pasteboard {
    display: flex;
    width: max-content;
    min-width: 100%;
    min-height: 100%;
    box-sizing: border-box;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: calc(var(--token-spacing-unit) * 8) var(--gutter);
  }

  .slide {
    position: relative;
    flex-shrink: 0;
    box-shadow: var(--token-shadow-raised);
  }

  .host {
    position: absolute;
    inset: 0;
  }

  .pip {
    display: flex;
    width: calc(var(--token-spacing-unit) * 6);
    height: calc(var(--token-spacing-unit) * 6);
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-control);
    color: var(--token-ink-muted);
  }

  .pip:hover {
    border-color: var(--token-color-interactive-border);
  }

  .pip.is-current {
    border-color: var(--token-color-active-border);
    color: var(--token-color-active-text);
  }
</style>
