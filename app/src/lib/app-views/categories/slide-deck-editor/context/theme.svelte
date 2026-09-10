<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";

  import { Panel, PanelButton, PanelColor, PanelEmpty, PanelInput, PanelNumber, PanelRow, PanelSection, PanelSelect } from "$authored-components/panel";
  import { SlideSurface } from "$authored-components/slide-surface";
  import { Button } from "$vendored-components/button";
  import { slideIndexOf, withSavedLayout, withSet, withoutLayout } from "$app-views/categories/slide-deck-editor/procedures/deck";
  import { newStyleEdit, styleOptions, styleSummary } from "$app-views/categories/slide-deck-editor/procedures/styles";
  import { sceneOf } from "$app-views/categories/slide-deck-editor/procedures/scene";
  import { asAspectRatio, ratioOf, ratioParts, slideUnits } from "$app-views/categories/slide-deck-editor/procedures/stage";
  import { workspaceState, type SlideDeckRuntime } from "$model/client/workspace-state";

  const view = workspaceState();
  const deckId = view.active.resourceId;
  let runtime = $state<SlideDeckRuntime | undefined>(undefined);

  $effect(() => {
    runtime = deckId === undefined ? undefined : view.slideDeckRuntime(deckId);
  });

  const body = $derived(runtime?.body);
  const slide = $derived(body?.slides[body === undefined ? 0 : slideIndexOf(body, view.active.focus ?? undefined)]);
  const ratio = $derived(body === undefined ? { width: 16, height: 9 } : ratioParts(body.aspectRatio));
  const units = $derived(
    runtime === undefined || body === undefined ? { width: 1280, height: 720 } : slideUnits(body.aspectRatio, runtime.stage)
  );
  const styles = $derived(styleOptions(body));
  const inspectedStyle = $derived(view.inspected === "slide-deck-editor.named-style" ? view.selection?.id : undefined);

  const set = (path: string, value: unknown) => {
    if (body === undefined) return;
    runtime?.apply(withSet(body, path, value).ops);
  };

  const setRatio = (width: number, height: number) => set("aspectRatio", asAspectRatio(width, height));

  let layoutName = $state("");

  const saveLayout = () => {
    if (body === undefined || slide === undefined) return;
    runtime?.apply(withSavedLayout(body, slide.id, layoutName).ops);
    layoutName = "";
  };

  const dropLayout = (layoutId: string) => {
    if (body === undefined) return;
    runtime?.apply(withoutLayout(body, layoutId).ops);
  };

  let shelf = $state<HTMLDivElement | null>(null);
  let shelfWidth = $state(0);
  $effect(() => {
    const element = shelf;
    if (element === null) return;
    const measure = () => {
      shelfWidth = element.clientWidth;
    };
    const watcher = new ResizeObserver(measure);
    watcher.observe(element);
    measure();
    return () => watcher.disconnect();
  });
  const cardWidth = $derived(Math.max(0, (shelfWidth - 8) / 2 - 2));
  const cardHeight = $derived(body === undefined ? 0 : cardWidth / ratioOf(body.aspectRatio));

  const newStyle = () => {
    if (body === undefined) return;
    const made = newStyleEdit(body);
    if (made.edit.ops.length > 0) runtime?.apply(made.edit.ops);
    view.inspect("slide-deck-editor.named-style", { kind: "named-style", id: made.key });
  };
</script>

<Panel title="Style">
  {#if body}
    <PanelSection title="Slide">
      <div class="flex flex-col gap-0.5">
        <span class="text-caption text-ink-muted">Aspect</span>
        <div class="flex items-center gap-1.5">
          <div class="w-14 shrink-0"><PanelNumber label="Aspect width" value={ratio.width} min={1} max={64} step={1} flush onchange={(value) => setRatio(value, ratio.height)} /></div>
          <span class="text-body-sm text-ink-muted">:</span>
          <div class="w-14 shrink-0"><PanelNumber label="Aspect height" value={ratio.height} min={1} max={64} step={1} flush onchange={(value) => setRatio(ratio.width, value)} /></div>
        </div>
      </div>
      <div class="grid grid-cols-[auto_1fr] items-center gap-x-3">
        <span class="text-caption text-ink-muted">Background</span>
        <PanelColor
          picker
          label="Background colour"
          value={body.theme.background?.kind === "color" ? body.theme.background.color : ""}
          flush
          onchange={(value) => set("theme/background", { kind: "color", color: value })}
        />
      </div>
    </PanelSection>

    <PanelSection title="Layouts" count={body.layouts.length} open={false}>
      <PanelInput label="Layout name" placeholder="Name this layout" bind:value={layoutName} flush onenter={saveLayout} />
      <div class="flex">
        <PanelButton label="Save slide {slide ? slideIndexOf(body, slide.id) + 1 : ''} as layout" tone="primary" disabled={slide === undefined} title="Everything on the slide becomes a locked layout that New ▾ can start from" onclick={saveLayout} />
      </div>
      <div bind:this={shelf} class="grid grid-cols-2 gap-2 pt-1">
        {#each body.layouts as layout (layout.id)}
          <div class="card group">
            <span class="picture" style="height: {cardHeight + 2}px">
              {#if cardWidth > 0}
                <span class="surface"><SlideSurface scene={sceneOf(body, { id: layout.id, elements: layout.locked, notes: [], ...(layout.background === undefined ? {} : { background: layout.background }) }, units)} width={cardWidth} height={cardHeight} interactive={false} /></span>
              {/if}
            </span>
            <span class="flex h-6 items-center gap-1">
              <span class="text-caption text-ink-primary min-w-0 flex-1 truncate" title={layout.name}>{layout.name}</span>
              <Button variant="ghost" size="icon-xs" class="opacity-0 group-hover:opacity-100 focus-visible:opacity-100" title="Remove this layout" aria-label="Remove {layout.name}" onclick={() => dropLayout(layout.id)}><Trash2 aria-hidden="true" /></Button>
            </span>
          </div>
        {/each}
      </div>
    </PanelSection>

    <PanelSection title="Named styles" count={styles.length} flush>
      <div class="px-3 pb-1"><PanelButton label="New style" icon={Plus} onclick={newStyle} /></div>
      {#each styles as option (option.value)}
        {@const held = body.styles.styles[option.value]}
        <PanelRow
          title={option.label}
          sub={styleSummary(held)}
          meta={body.styles.defaultKey === option.value ? "Default" : undefined}
          selected={inspectedStyle === option.value}
          onselect={() => view.inspect("slide-deck-editor.named-style", { kind: "named-style", id: option.value })}
        />
      {/each}
    </PanelSection>
  {:else}
    <PanelEmpty title="Open a deck to style it" />
  {/if}
</Panel>

<style>
  .card {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 0.5);
  }

  .picture {
    position: relative;
    display: block;
    width: 100%;
    overflow: hidden;
    border-radius: 2px;
  }

  .surface {
    position: absolute;
    inset: 0;
    display: block;
    pointer-events: none;
  }
</style>
