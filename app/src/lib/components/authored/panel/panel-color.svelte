<script lang="ts">
  import X from "@lucide/svelte/icons/x";

  import { cn } from "$vendored-components/utils";
  import { traceNode } from "$development-components/trace.svelte";

  let {
    label,
    value,
    options = [],
    mixed = false,
    disabled = false,
    flush = false,
    picker = false,
    clearable = false,
    onchange
  }: {
    label: string;
    value: string;
    options?: readonly { value: string; label: string; token: string }[];
    mixed?: boolean;
    disabled?: boolean;
    flush?: boolean;
    picker?: boolean;
    clearable?: boolean;
    onchange?: (next: string) => void;
  } = $props();

  const trace = traceNode("PanelColor", () => ({ label, value, options, mixed, disabled, flush, picker, clearable }));

  const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

  const tokenOf = (held: string): string => (held.startsWith("--") ? `var(${held})` : held);

  const shown = $derived(
    value === "" ? "transparent" : (options.find((option) => option.value === value)?.token ?? tokenOf(value))
  );

  let well = $state<HTMLSpanElement>();

  const expanded = (hex: string): string =>
    hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;

  const computedHex = (): string | undefined => {
    if (well === undefined) return undefined;
    const parts = getComputedStyle(well).backgroundColor.match(/\d+(\.\d+)?/g);
    if (parts === null || parts.length < 3) return undefined;
    return `#${parts
      .slice(0, 3)
      .map((part) => Math.round(Number(part)).toString(16).padStart(2, "0"))
      .join("")}`;
  };

  const prime = (input: HTMLInputElement) => {
    const hex = HEX.test(value) ? expanded(value.toLowerCase()) : computedHex();
    if (hex !== undefined) input.value = hex;
  };
</script>

{#if picker}
  <div {...trace} class={cn("flex items-center gap-1", flush ? "px-0" : "px-3")}>
    <label
      class={cn(
        "border-border-subtle rounded-control relative size-7 shrink-0 overflow-hidden border",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      )}
      title={label}
    >
      <span bind:this={well} class="absolute inset-0" style:background={shown}></span>
      {#if value === "" && !mixed}
        <span class="none-mark" aria-hidden="true"></span>
      {/if}
      <input
        type="color"
        {disabled}
        class="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        aria-label={label}
        onpointerdown={(event: PointerEvent & { currentTarget: EventTarget & HTMLInputElement }) => prime(event.currentTarget)}
        onfocus={(event: FocusEvent & { currentTarget: EventTarget & HTMLInputElement }) => prime(event.currentTarget)}
        onchange={(event: Event & { currentTarget: EventTarget & HTMLInputElement }) => onchange?.(event.currentTarget.value)}
      />
    </label>
    {#if mixed}
      <span class="text-caption text-ink-muted">Mixed</span>
    {/if}
    {#if clearable && value !== "" && !disabled}
      <button
        type="button"
        class="text-ink-muted hover:text-ink-primary rounded-control p-0.5"
        title="No {label.toLowerCase()}"
        aria-label="No {label.toLowerCase()}"
        onclick={() => onchange?.("")}
      >
        <X size={12} aria-hidden="true" />
      </button>
    {/if}
  </div>
{:else}
  <div {...trace} role="radiogroup" aria-label={label} class={cn("flex flex-wrap items-center gap-1", flush ? "px-0" : "px-3")}>
    {#each options as option (option.value)}
      <button
        type="button"
        role="radio"
        {disabled}
        aria-checked={!mixed && option.value === value}
        aria-label={option.label}
        title={option.label}
        onclick={() => onchange?.(option.value)}
        class={cn(
          "border-border-subtle size-5 rounded-full border",
          "focus-visible:outline-none",
          !mixed && option.value === value && "ring-active-border ring-offset-surface-panel ring-2 ring-offset-2",
          disabled && "cursor-not-allowed opacity-50"
        )}
        style:background={option.token}
      ></button>
    {/each}
    {#if mixed}
      <span class="text-caption text-ink-muted">Mixed</span>
    {/if}
  </div>
{/if}

<style>
  .none-mark {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to top right,
      transparent calc(50% - 1px),
      var(--token-color-danger-fill) calc(50% - 1px),
      var(--token-color-danger-fill) calc(50% + 1px),
      transparent calc(50% + 1px)
    );
    pointer-events: none;
  }
</style>
