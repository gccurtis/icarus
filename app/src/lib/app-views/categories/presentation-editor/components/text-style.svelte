<script lang="ts">
  import AlignVerticalJustifyCenter from "@lucide/svelte/icons/align-vertical-justify-center";
  import AlignVerticalJustifyEnd from "@lucide/svelte/icons/align-vertical-justify-end";
  import AlignVerticalJustifyStart from "@lucide/svelte/icons/align-vertical-justify-start";

  import { PanelAlignment, PanelChoice, PanelControlGroup, PanelControlRow, PanelInlineStyle, PanelNumber, PanelSection, PanelSelect } from "$authored-components/panel";
  import type { MarkStyle } from "$app-views/categories/presentation-editor/procedures/presentation-types";
  import { blockIn, holderOf } from "$app-views/categories/presentation-editor/procedures/presentation-reading";
  import { withSet } from "$app-views/categories/presentation-editor/procedures/presentation-values";
  import { FAMILIES, swatchesFor, withNone } from "$app-views/categories/presentation-editor/procedures/palette";
  import { colorAt, colouredMark, stylesAt, toggledMark } from "$app-views/categories/presentation-editor/procedures/typing";
  import { workspaceState, type PresentationRuntime } from "$model/client/workspace-state";
  import type { PresentationSetTarget } from "$representation/data/types/presentations/op";

  let {
    blockId,
    from,
    to,
    whole = false,
    paragraph = true,
    wrapping = false
  }: {
    blockId: string;
    from?: number;
    to?: number;
    whole?: boolean;
    paragraph?: boolean;
    wrapping?: boolean;
  } = $props();

  const MARKS = [
    { value: "bold", label: "Bold" },
    { value: "italic", label: "Italic" },
    { value: "underline", label: "Underline" },
    { value: "strikethrough", label: "Strikethrough" }
  ];

  const VALIGN = [
    { value: "top", label: "Top", icon: AlignVerticalJustifyStart },
    { value: "middle", label: "Middle", icon: AlignVerticalJustifyCenter },
    { value: "bottom", label: "Bottom", icon: AlignVerticalJustifyEnd }
  ];

  const WRAPPING = [
    { value: "grow", label: "Grow box", title: "Grow the box to fit its text" },
    { value: "shrink", label: "Shrink text", title: "Shrink the text to fit inside the box" },
    { value: "clip", label: "Clip text", title: "Hide text that extends beyond the box" }
  ];

  const view = workspaceState();
  const presentationId = view.active.resourceId;
  let runtime = $state<PresentationRuntime | undefined>(undefined);

  $effect(() => {
    runtime = presentationId === undefined ? undefined : view.presentationRuntime(presentationId);
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
  const colours = $derived(body === undefined ? [] : withNone(swatchesFor(body.theme)));
  const marks = $derived(block === undefined ? [] : stylesAt(block, range.from, range.to));
  const canMark = $derived(block !== undefined && range.to > range.from);

  const format = $derived(block?.format);
  const rangeColor = $derived(block === undefined || !partial ? undefined : colorAt(block, range.from, range.to));
  const fontColor = $derived(rangeColor ?? format?.color ?? style?.color ?? "");

  const background = $derived.by((): {
    target: PresentationSetTarget;
    path: string;
    value: string;
  } | undefined => {
    if (holder === undefined) {
      return { target: "block", path: `${blockId}/format/background`, value: format?.background ?? "" };
    }
    if (holder.content.type === "text" || holder.content.type === "prompt" || holder.content.type === "shape") {
      return { target: "element", path: `${holder.id}/paint/fill`, value: holder.paint?.fill ?? "" };
    }
    if (holder.content.type === "table") {
      const cell = holder.content.block.rows.flatMap((row) => row.cells).find((held) => held.blocks.some((candidate) => candidate.id === blockId));
      return cell === undefined
        ? undefined
        : { target: "block", path: `${cell.id}/format/background`, value: cell.format?.background ?? "" };
    }
    return undefined;
  });

  const apply = (ops: Parameters<PresentationRuntime["apply"]>[0]) => {
    if (ops.length > 0) runtime?.apply(ops);
  };

  const set = (target: PresentationSetTarget, path: string, value: unknown) => {
    if (body === undefined) return;
    apply(withSet(body, target, path, value).ops);
  };

  const onBlock = (field: string, value: unknown) =>
    set("block", `${blockId}/format/${field}`, value);

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

  const setBackground = (value: string) => {
    if (background !== undefined) {
      set(background.target, background.path, value === "" ? null : value);
    }
  };
</script>

<PanelSection title="Text style">
  <PanelSelect label="Named style" value={styleKey} options={styleOptions} onchange={(value) => set("block", `${blockId}/style`, value)} />
  <div class="grid grid-cols-[minmax(0,1fr)_4rem] items-center gap-1.5">
    <PanelSelect label="Font" value={format?.fontFamily ?? style?.fontFamily ?? body?.theme.fontFamily ?? "IBM Plex Sans"} options={familyOptions} onchange={(value) => onBlock("fontFamily", value)} />
    <PanelNumber label="Size" value={format?.fontSize ?? style?.fontSize ?? 20} min={6} max={200} step={1} flush onchange={(value) => onBlock("fontSize", value)} />
  </div>
  <PanelInlineStyle
    marks={[...marks]}
    options={MARKS}
    foreground={fontColor}
    background={background?.value ?? ""}
    foregroundOptions={colours}
    backgroundOptions={colours}
    marksDisabled={!canMark}
    onmarks={toggle}
    onforeground={setFontColor}
    onbackground={setBackground}
  />
  {#if paragraph || (wrapping && holder !== undefined)}
    {#if paragraph}
      <PanelAlignment value={format?.horizontalAlignment ?? style?.horizontalAlignment ?? "start"} onchange={(value) => onBlock("horizontalAlignment", value)} />
      <PanelChoice label="Vertical alignment" value={format?.verticalAlignment ?? style?.verticalAlignment ?? "top"} options={VALIGN} flush fill onchange={(value) => onBlock("verticalAlignment", value === "top" ? null : value)} />
    {/if}
    {#if wrapping && holder !== undefined}
      <PanelControlGroup flush>
        <PanelControlRow label="Text wrap">
          <PanelChoice
            label="Text wrap"
            value={holder.overflow ?? "clip"}
            options={WRAPPING}
            flush
            fill
            onchange={(value) => set("element", `${holder.id}/overflow`, value)}
          />
        </PanelControlRow>
      </PanelControlGroup>
    {/if}
  {/if}
</PanelSection>
