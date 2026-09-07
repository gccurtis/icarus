<script lang="ts">
  import X from "@lucide/svelte/icons/x";

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

  const cssOf = (value: string, fallback: string): string =>
    value === "" ? fallback : value.startsWith("--") ? `var(${value})` : value;

  const ink = $derived(cssOf(foreground, "var(--token-ink-primary)"));
  const fill = $derived(cssOf(background, "transparent"));

  let inkSwatch = $state<HTMLSpanElement | null>(null);
  let fillSwatch = $state<HTMLSpanElement | null>(null);
  let inkHex = $state("#000000");
  let fillHex = $state("#ffffff");

  const hexOf = (element: HTMLSpanElement | null, fallback: string): string => {
    if (element === null) return fallback;
    const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(getComputedStyle(element).backgroundColor);
    if (match === null || (match[4] !== undefined && Number(match[4]) === 0)) return fallback;
    return `#${[1, 2, 3].map((at) => Number(match[at]).toString(16).padStart(2, "0")).join("")}`;
  };

  $effect(() => {
    void ink;
    inkHex = hexOf(inkSwatch, "#000000");
  });

  $effect(() => {
    void fill;
    fillHex = hexOf(fillSwatch, "#ffffff");
  });
</script>

<div class="pair">
  <span class="holder">
    <span class="text-caption text-ink-muted shrink-0 font-medium">FG</span>
    <span bind:this={inkSwatch} class="swatch" style:background={mixed ? "var(--token-surface-selection)" : ink}>
      <input
        type="color"
        value={inkHex}
        aria-label="Text color"
        title="Text color"
        oninput={(event: Event & { currentTarget: EventTarget & HTMLInputElement }) => onforeground(event.currentTarget.value)}
      />
    </span>
  </span>

  <span class="holder">
    <span class="text-caption text-ink-muted shrink-0 font-medium">BG</span>
    <span
      bind:this={fillSwatch}
      class="swatch"
      class:empty={background === "" && !mixed}
      style:background={mixed ? "var(--token-surface-selection)" : fill}
    >
      <input
        type="color"
        value={fillHex}
        aria-label="Fill color"
        title="Fill color"
        oninput={(event: Event & { currentTarget: EventTarget & HTMLInputElement }) => onbackground(event.currentTarget.value)}
      />
    </span>
    <button
      type="button"
      class="clear"
      aria-label="No fill"
      title="No fill"
      disabled={background === ""}
      onclick={() => onbackground("")}
    >
      <X size={12} aria-hidden="true" />
    </button>
  </span>
</div>

<style>
  .pair {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 3);
  }

  .holder {
    display: flex;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 1.5);
  }

  .swatch {
    position: relative;
    display: inline-block;
    width: 1.15rem;
    height: 1.15rem;
    border: var(--token-hairline) solid var(--token-border-strong);
    border-radius: 9999px;
  }

  .swatch.empty {
    background-image: linear-gradient(
      to bottom right,
      transparent calc(50% - 1px),
      var(--token-color-danger-border) calc(50% - 1px),
      var(--token-color-danger-border) calc(50% + 1px),
      transparent calc(50% + 1px)
    );
  }

  .swatch input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    padding: 0;
    border: 0;
    opacity: 0;
    cursor: pointer;
  }

  .clear {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--token-ink-muted);
    cursor: pointer;
  }

  .clear:hover:not(:disabled) {
    color: var(--token-ink-primary);
  }

  .clear:disabled {
    cursor: default;
    opacity: 0.3;
  }
</style>
