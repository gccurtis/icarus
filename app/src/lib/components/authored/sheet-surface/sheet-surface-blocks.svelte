<script lang="ts">
  import type { Block } from "$authored-components/sheet-surface/sheet-surface-geometry";
  import type {
    SurfaceCell,
    SurfaceMerge,
    SurfaceSelection
  } from "$authored-components/sheet-surface/sheet-surface-types";

  let {
    blocks,
    selection,
    scale,
    mono,
    base
  }: {
    blocks: readonly Block[];
    selection?: SurfaceSelection;
    scale: number;
    /** The mono family, already resolved, for a cell that asks for it. */
    mono: string;
    /** The label size in pixels at the current zoom. */
    base: number;
  } = $props();

  const TONE_INK: Record<string, string> = {
    pending: "var(--token-ink-muted)",
    error: "var(--token-color-danger-text)",
    spill: "var(--token-color-interactive-text)"
  };

  const JUSTIFY: Record<string, string> = { left: "flex-start", center: "center", right: "flex-end" };
  const PLACE: Record<string, string> = { top: "flex-start", middle: "center", bottom: "flex-end" };

  const paintOf = (value: string | undefined, fallback: string): string =>
    value === undefined || value === "" ? fallback : value.startsWith("--") ? `var(${value})` : value;

  const edgeCss = (cell: SurfaceCell): string => {
    const border = cell.border;
    if (border === undefined) return "";
    return (["top", "right", "bottom", "left"] as const)
      .flatMap((side) => {
        const line = border[side];
        if (line === undefined) return [];
        const width = Math.max(1, Math.round(line.width * scale));
        return [`border-${side}: ${width}px ${line.style} ${paintOf(line.color, "var(--token-border-strong)")};`];
      })
      .join(" ");
  };

  const blockCss = (cell: SurfaceCell): string =>
    [
      `background: ${paintOf(cell.background, "var(--token-surface-elevated)")};`,
      `color: ${cell.color === undefined ? (TONE_INK[cell.tone] ?? "var(--token-ink-primary)") : paintOf(cell.color, "var(--token-ink-primary)")};`,
      `font-family: ${cell.mono ? mono : (cell.font ?? "inherit")};`,
      `font-size: ${(cell.size ?? base / scale) * scale}px;`,
      `font-weight: ${cell.weight};`,
      cell.italic || cell.tone === "pending" ? "font-style: italic;" : "",
      `justify-content: ${JUSTIFY[cell.align] ?? "flex-start"};`,
      `align-items: ${PLACE[cell.valign] ?? "center"};`,
      edgeCss(cell)
    ]
      .filter((part) => part !== "")
      .join(" ");

  const inside = (merge: SurfaceMerge): boolean => {
    const cell = selection?.cell;
    if (cell === undefined) return false;
    return (
      cell[1] >= merge.row &&
      cell[1] < merge.row + merge.rows &&
      cell[0] >= merge.column &&
      cell[0] < merge.column + merge.columns
    );
  };
</script>

<div class="blocks">
  {#each blocks as block (block.key)}
    <div
      class="block"
      class:current={inside(block.merge)}
      class:underline={block.merge.cell.underline}
      class:strike={block.merge.cell.strike}
      style={`left: ${block.x}px; top: ${block.y}px; width: ${block.width}px; height: ${block.height}px; ${blockCss(block.merge.cell)}`}
    >
      <span class="text">{block.merge.cell.text}</span>
    </div>
  {/each}
</div>

<style>
  .blocks {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .block {
    position: absolute;
    display: flex;
    overflow: hidden;
    padding: 0 calc(var(--token-spacing-unit) * 2);
    line-height: 1.25;
  }

  .block.current {
    outline: 2px solid var(--token-color-active-border);
    outline-offset: -2px;
  }

  .block .text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .block.underline .text {
    text-decoration: underline;
  }

  .block.strike .text {
    text-decoration: line-through;
  }

  .block.underline.strike .text {
    text-decoration: underline line-through;
  }
</style>
