<script lang="ts">
  import AlignCenter from "@lucide/svelte/icons/align-center";
  import AlignJustify from "@lucide/svelte/icons/align-justify";
  import AlignLeft from "@lucide/svelte/icons/align-left";
  import AlignRight from "@lucide/svelte/icons/align-right";
  import AlignVerticalJustifyCenter from "@lucide/svelte/icons/align-vertical-justify-center";
  import AlignVerticalJustifyEnd from "@lucide/svelte/icons/align-vertical-justify-end";
  import AlignVerticalJustifyStart from "@lucide/svelte/icons/align-vertical-justify-start";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";

  import { Panel, PanelButton, PanelChoice, PanelColor, PanelEditableText, PanelEmpty, PanelInput, PanelNumber, PanelSection, PanelSelect } from "$authored-components/panel";
  import { SlideSurface } from "$authored-components/slide-surface";
  import { Button } from "$vendored-components/button";
  import { slideIndexOf, withSavedLayout, withSet, withoutLayout, type TextStyle } from "$app-views/categories/slide-deck-editor/procedures/deck";
  import { FAMILIES } from "$app-views/categories/slide-deck-editor/procedures/palette";
  import { sceneOf } from "$app-views/categories/slide-deck-editor/procedures/scene";
  import { asAspectRatio, ratioOf, ratioParts, slideUnits } from "$app-views/categories/slide-deck-editor/procedures/stage";
  import { workspaceState, type SlideDeckRuntime } from "$model/client/workspace-state";

  const ALIGN = [
    { value: "start", label: "Align left", icon: AlignLeft },
    { value: "center", label: "Center", icon: AlignCenter },
    { value: "end", label: "Align right", icon: AlignRight },
    { value: "justify", label: "Justify", icon: AlignJustify }
  ];

  const VALIGN = [
    { value: "top", label: "Top", icon: AlignVerticalJustifyStart },
    { value: "middle", label: "Middle", icon: AlignVerticalJustifyCenter },
    { value: "bottom", label: "Bottom", icon: AlignVerticalJustifyEnd }
  ];

  const view = workspaceState();
  const deckId = $derived(view.active.resourceId);
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
  const families = FAMILIES.map((family) => ({ value: family, label: family }));
  const styleOptions = $derived(Object.entries(body?.styles.styles ?? {}).map(([value, held]) => ({ value, label: held.name })));

  let picked = $state<string | undefined>(undefined);
  const styleKey = $derived(picked !== undefined && body?.styles.styles[picked] ? picked : (body?.styles.defaultKey ?? "body"));
  const style = $derived<TextStyle | undefined>(body?.styles.styles[styleKey]);

  const set = (path: string, value: unknown) => {
    if (body === undefined) return;
    runtime?.apply(withSet(body, path, value).ops);
  };

  const onStyle = (field: string, value: unknown) => set(`styles/styles/${styleKey}/${field}`, value);

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

  let shelf = $state<HTMLDivElement>();
  let shelfWidth = $state(0);
  $effect(() => {
    const element = shelf;
    if (element === undefined) return;
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
    let index = Object.keys(body.styles.styles).length + 1;
    let key = `style-${index}`;
    while (body.styles.styles[key]) {
      index += 1;
      key = `style-${index}`;
    }
    set(`styles/styles/${key}`, { name: `Style ${index}`, fontSize: 20 });
    picked = key;
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

    <PanelSection title="Named styles" count={styleOptions.length} open={false}>
      <div class="flex items-end gap-1.5">
        <div class="min-w-0 flex-1"><PanelSelect label="Style" value={styleKey} options={styleOptions} onchange={(value) => (picked = value)} /></div>
        <PanelButton label="New" icon={Plus} onclick={newStyle} />
      </div>
      {#if style}
        <div class="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
          <span class="text-caption text-ink-muted">Name</span>
          <PanelEditableText value={style.name} label="Style name" onchange={(value) => onStyle("name", value)} />
        </div>
        <div class="grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-1.5">
          <PanelSelect label="Font" value={style.fontFamily ?? body.theme.fontFamily ?? "IBM Plex Sans"} options={families} onchange={(value) => onStyle("fontFamily", value)} />
          <PanelNumber label="Size" value={style.fontSize ?? 20} min={6} max={200} step={1} flush onchange={(value) => onStyle("fontSize", value)} />
        </div>
        <div class="grid grid-cols-[auto_1fr] items-center gap-x-3">
          <span class="text-caption text-ink-muted">Font colour</span>
          <PanelColor picker clearable label="Font colour" value={style.color ?? ""} flush onchange={(value) => onStyle("color", value === "" ? null : value)} />
        </div>
        <PanelChoice label="Alignment" value={style.horizontalAlignment ?? "start"} options={ALIGN} flush fill onchange={(value) => onStyle("horizontalAlignment", value)} />
        <PanelChoice label="Vertical alignment" value={style.verticalAlignment ?? "top"} options={VALIGN} flush fill onchange={(value) => onStyle("verticalAlignment", value === "top" ? null : value)} />
        <span class="text-caption text-ink-muted pt-1">Spacing</span>
        <div class="grid grid-cols-2 gap-x-2 gap-y-1.5">
          <div class="flex flex-col gap-0.5">
            <span class="text-caption text-ink-muted">Line height</span>
            <PanelNumber label="Line height" value={style.lineHeight ?? 1.3} min={0.8} max={3} step={0.05} flush onchange={(value) => onStyle("lineHeight", value)} />
          </div>
          <div class="flex flex-col gap-0.5">
            <span class="text-caption text-ink-muted">Before</span>
            <PanelNumber label="Space before" value={style.spaceBefore ?? 0} unit="px" min={0} max={200} step={1} flush onchange={(value) => onStyle("spaceBefore", value)} />
          </div>
          <div class="flex flex-col gap-0.5">
            <span class="text-caption text-ink-muted">After</span>
            <PanelNumber label="Space after" value={style.spaceAfter ?? 0} unit="px" min={0} max={200} step={1} flush onchange={(value) => onStyle("spaceAfter", value)} />
          </div>
        </div>
      {/if}
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
