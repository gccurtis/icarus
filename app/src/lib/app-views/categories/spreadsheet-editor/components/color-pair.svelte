<script lang="ts">
  import { PanelColor } from "$authored-components/panel";
  import { FILLS, INKS } from "$app-views/categories/spreadsheet-editor/procedures/colors";

  let {
    foreground,
    background,
    mixed = false,
    onforeground,
    onbackground
  }: {
    foreground: string;
    background: string;
    mixed?: boolean;
    onforeground: (next: string) => void;
    onbackground: (next: string) => void;
  } = $props();
</script>

<div class="pair">
  <span class="holder">
    <span class="text-caption text-ink-muted shrink-0">Text</span>
    <PanelColor picker label="Text colour" value={foreground} options={INKS} {mixed} flush onchange={onforeground} />
  </span>

  <span class="holder">
    <span class="text-caption text-ink-muted shrink-0">Fill</span>
    <PanelColor picker clearable label="Fill colour" value={background} options={FILLS} {mixed} flush onchange={onbackground} />
  </span>
</div>

<style>
  .pair {
    display: flex;
    min-width: 0;
    flex-wrap: wrap;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 1) calc(var(--token-spacing-unit) * 4);
  }

  .holder {
    display: flex;
    min-width: 0;
    flex: 1;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 2);
  }
</style>
