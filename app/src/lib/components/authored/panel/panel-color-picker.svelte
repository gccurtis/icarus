<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Pipette from "@lucide/svelte/icons/pipette";
  import SlidersHorizontal from "@lucide/svelte/icons/sliders-horizontal";
  import X from "@lucide/svelte/icons/x";

  import PanelColor from "$authored-components/panel/panel-color.svelte";
  import { traceNode } from "$development-components/trace.svelte";
  import * as Popover from "$vendored-components/popover";
  import { cn } from "$vendored-components/utils";

  let {
    label,
    value,
    options,
    mixed = false,
    disabled = false,
    compact = false,
    onchange,
    oncustom
  }: {
    label: string;
    value: string;
    options: readonly { value: string; label: string; token: string }[];
    mixed?: boolean;
    disabled?: boolean;
    compact?: boolean;
    onchange?: (next: string) => void;
    oncustom?: () => void;
  } = $props();

  let open = $state(false);
  const trace = traceNode("PanelColorPicker", () => ({ label, value, mixed, disabled, compact }));
  const eyedropper = typeof window !== "undefined" && "EyeDropper" in window;

  const token = $derived(
    value === "" ? "transparent" : (options.find((option) => option.value === value)?.token ?? value)
  );

  const choose = (next: string) => {
    onchange?.(next);
    open = false;
  };

  const pick = async () => {
    const Picker = (
      window as typeof window & {
        EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> };
      }
    ).EyeDropper;
    if (Picker === undefined) return;

    try {
      const picked = await new Picker().open();
      choose(picked.sRGBHex);
    } catch {
      // Cancelling the operating-system picker is not an editor failure.
    }
  };
</script>

<Popover.Root bind:open>
  <Popover.Trigger
    {...trace}
    disabled={disabled}
    aria-label={label}
    title={compact ? label : undefined}
    class={cn(
      "bg-surface-panel hover:bg-surface-panel-hover focus-visible:ring-active-border flex items-center focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed",
      compact
        ? "rounded-full size-6 shrink-0 justify-center p-0"
        : "border-border-subtle rounded-control min-h-6 min-w-0 flex-1 gap-1.5 border px-1.5 py-1"
    )}
  >
    <span
      class="border-border-subtle text-ink-muted flex size-4 shrink-0 items-center justify-center rounded-full border"
      style:background={mixed ? "var(--token-surface-selection)" : token}
    >
      {#if value === "" && !mixed}
        <X size={12} strokeWidth={2.25} aria-hidden="true" />
      {/if}
    </span>
    {#if !compact}
      <span class="text-caption text-ink-secondary truncate">{mixed ? "Mixed" : label}</span>
      <ChevronDown size={12} aria-hidden="true" class="text-ink-muted ms-auto shrink-0" />
    {/if}
  </Popover.Trigger>

  <Popover.Content class="w-56 p-0" sideOffset={4}>
    <div class="p-2">
      <PanelColor {label} {value} {options} {mixed} flush onchange={choose} />
    </div>
    <div class="border-border-subtle border-t py-1">
      <button
        type="button"
        disabled={!eyedropper}
        title={eyedropper ? "Pick a colour from anywhere on screen" : "This browser has no eyedropper"}
        class="text-body-sm text-ink-secondary hover:bg-surface-panel-hover flex min-h-6 w-full items-center gap-2 px-2.5 py-1 text-start disabled:cursor-not-allowed"
        onclick={pick}
      >
        <Pipette size={14} aria-hidden="true" />
        Pick from screen
      </button>
      <button
        type="button"
        disabled={oncustom === undefined}
        title={oncustom === undefined ? "Custom colours are not available here" : undefined}
        class="text-body-sm text-ink-secondary hover:bg-surface-panel-hover flex min-h-6 w-full items-center gap-2 px-2.5 py-1 text-start disabled:cursor-not-allowed"
        onclick={() => {
          open = false;
          oncustom?.();
        }}
      >
        <SlidersHorizontal size={14} aria-hidden="true" />
        More colours…
      </button>
    </div>
  </Popover.Content>
</Popover.Root>
