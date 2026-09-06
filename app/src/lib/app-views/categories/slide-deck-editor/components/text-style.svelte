<script lang="ts">
  import AlignCenter from "@lucide/svelte/icons/align-center";
  import AlignJustify from "@lucide/svelte/icons/align-justify";
  import AlignLeft from "@lucide/svelte/icons/align-left";
  import AlignRight from "@lucide/svelte/icons/align-right";
  import AlignVerticalJustifyCenter from "@lucide/svelte/icons/align-vertical-justify-center";
  import AlignVerticalJustifyEnd from "@lucide/svelte/icons/align-vertical-justify-end";
  import AlignVerticalJustifyStart from "@lucide/svelte/icons/align-vertical-justify-start";

  import { PanelChoice, PanelColor, PanelMarks, PanelNumber, PanelSection, PanelSelect } from "$authored-components/panel";
  import { blockIn, holderOf, withSet, type MarkStyle } from "$app-views/categories/slide-deck-editor/procedures/deck";
  import { FAMILIES } from "$app-views/categories/slide-deck-editor/procedures/palette";
  import { colorAt, colouredMark, stylesAt, toggledMark } from "$app-views/categories/slide-deck-editor/procedures/typing";
  import { workspaceState, type SlideDeckRuntime } from "$model/client/workspace-state";

  let {
    blockId,
    from,
    to,
    whole = false,
    paragraph = true,
    spacing = true
  }: {
    blockId: string;
    from?: number;
    to?: number;
    whole?: boolean;
    paragraph?: boolean;
    spacing?: boolean;
  } = $props();

  const MARKS = [
    { value: "bold", label: "B" },
    { value: "italic", label: "I" },
    { value: "underline", label: "U" },
    { value: "strikethrough", label: "S" }
  ];

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
  const block = $derived(body === undefined ? undefined : blockIn(body, blockId));
  const holder = $derived(body === undefined ? undefined : holderOf(body, blockId));
  const range = $derived.by(() => {
    if (block === undefined) return { from: 0, to: 0 };
    if (whole || from === undefined) return { from: 0, to: block.display.length };
    return { from: Math.min(from, to ?? from), to: Math.max(from, to ?? from) };
  });
  const partial = $derived(!whole && from !== undefined && range.to > range.from);
  const styleKey = $derived(block?.style ?? body?.styles.defaultKey ?? "body");
  const style = $derived(body?.styles.styles[styleKey]);
  const styleOptions = $derived(
    Object.entries(body?.styles.styles ?? {}).map(([value, held]) => ({ value, label: held.name }))
  );
  const familyOptions = FAMILIES.map((family) => ({ value: family, label: family }));
  const marks = $derived(block === undefined ? [] : stylesAt(block, range.from, range.to));
  const canMark = $derived(block !== undefined && range.to > range.from);

  const format = $derived(block?.format);
  const rangeColor = $derived(block === undefined || !partial ? undefined : colorAt(block, range.from, range.to));
  const fontColor = $derived(rangeColor ?? format?.color ?? style?.color ?? "");

  const background = $derived.by(() => {
    if (holder === undefined) return { path: `${blockId}/format/background`, value: format?.background ?? "" };
    if (holder.content.type === "text" || holder.content.type === "shape") return { path: `${holder.id}/paint/fill`, value: holder.paint?.fill ?? "" };
    if (holder.content.type === "table") {
      const cell = holder.content.block.rows.flatMap((row) => row.cells).find((held) => held.blocks.some((candidate) => candidate.id === blockId));
      return cell === undefined ? undefined : { path: `${cell.id}/format/background`, value: cell.format?.background ?? "" };
    }
    return undefined;
  });

  const apply = (ops: Parameters<SlideDeckRuntime["apply"]>[0]) => {
    if (ops.length > 0) runtime?.apply(ops);
  };

  const set = (path: string, value: unknown) => {
    if (body === undefined) return;
    apply(withSet(body, path, value).ops);
  };

  const onBlock = (field: string, value: unknown) => set(`${blockId}/format/${field}`, value);

  const toggle = (next: string[]) => {
    if (block === undefined || !canMark) return;
    const was = new Set<string>(marks);
    const now = new Set<string>(next);
    const options: MarkStyle[] = ["bold", "italic", "underline", "strikethrough"];
    const changed = options.find((held) => was.has(held) !== now.has(held));
    if (changed === undefined) return;
    apply(toggledMark(block, range.from, range.to, changed));
  };

  const setFontColor = (value: string) => {
    if (block === undefined) return;
    if (partial) {
      apply(colouredMark(block, range.from, range.to, value === "" ? undefined : value));
      return;
    }
    onBlock("color", value === "" ? null : value);
  };
</script>

<PanelSection title="Style">
  <PanelSelect label="Named style" value={styleKey} options={styleOptions} onchange={(value) => set(`${blockId}/style`, value)} />
  <div class="grid grid-cols-[minmax(0,1fr)_4rem] items-center gap-1.5">
    <PanelSelect label="Font" value={format?.fontFamily ?? style?.fontFamily ?? body?.theme.fontFamily ?? "IBM Plex Sans"} options={familyOptions} onchange={(value) => onBlock("fontFamily", value)} />
    <PanelNumber label="Size" value={format?.fontSize ?? style?.fontSize ?? 20} min={6} max={200} step={1} flush onchange={(value) => onBlock("fontSize", value)} />
  </div>
  <div class="flex items-center gap-1.5">
    <span class="text-caption text-ink-muted">FG</span>
    <PanelColor picker clearable label="Font colour" value={fontColor} flush onchange={setFontColor} />
    {#if background}
      <span class="text-caption text-ink-muted ms-2">BG</span>
      <PanelColor picker clearable label="Background colour" value={background.value} flush onchange={(value) => set(background.path, value === "" ? null : value)} />
    {/if}
  </div>
  <PanelMarks label="Marks" value={marks} options={MARKS} disabled={!canMark} flush onchange={toggle} />
</PanelSection>

{#if paragraph}
  <PanelSection title="Paragraph">
    <PanelChoice label="Alignment" value={format?.horizontalAlignment ?? style?.horizontalAlignment ?? "start"} options={ALIGN} flush fill onchange={(value) => onBlock("horizontalAlignment", value)} />
    <PanelChoice label="Vertical alignment" value={format?.verticalAlignment ?? style?.verticalAlignment ?? "top"} options={VALIGN} flush fill onchange={(value) => onBlock("verticalAlignment", value === "top" ? null : value)} />
  </PanelSection>
{/if}

{#if spacing}
  <PanelSection title="Spacing">
    <div class="grid grid-cols-2 gap-x-2 gap-y-1.5">
      <div class="flex flex-col gap-0.5">
        <span class="text-caption text-ink-muted">Line height</span>
        <PanelNumber label="Line height" value={format?.lineHeight ?? style?.lineHeight ?? 1.3} min={0.8} max={3} step={0.05} flush onchange={(value) => onBlock("lineHeight", value)} />
      </div>
      <div class="flex flex-col gap-0.5">
        <span class="text-caption text-ink-muted">Before</span>
        <PanelNumber label="Space before" value={format?.spaceBefore ?? style?.spaceBefore ?? 0} unit="px" min={0} max={200} step={1} flush onchange={(value) => onBlock("spaceBefore", value)} />
      </div>
      <div class="flex flex-col gap-0.5">
        <span class="text-caption text-ink-muted">After</span>
        <PanelNumber label="Space after" value={format?.spaceAfter ?? style?.spaceAfter ?? 0} unit="px" min={0} max={200} step={1} flush onchange={(value) => onBlock("spaceAfter", value)} />
      </div>
    </div>
  </PanelSection>
{/if}
