<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Pipette from "@lucide/svelte/icons/pipette";
  import SlidersHorizontal from "@lucide/svelte/icons/sliders-horizontal";

  import PanelColor from "$authored-components/panel/panel-color.svelte";
  import { traceNode } from "$development-components/trace.svelte";
  import * as Popover from "$vendored-components/popover";

  let {
    label,
    value,
    options,
    mixed = false,
    disabled = false,
    onchange,
    oncustom
  }: {
    label: string;
    value: string;
    options: readonly { value: string; label: string; token: string }[];
    mixed?: boolean;
    disabled?: boolean;
    onchange?: (next: string) => void;
    oncustom?: () => void;
  } = $props();

  let open = $state(false);
  const trace = traceNode("PanelColorPicker", () => ({ label, value, mixed, disabled }));
  const eyedropper = typeof window !== "undefined" && "EyeDropper" in window;

  const token = $derived(
    options.find((option) => option.value === value)?.token ?? value ?? "transparent"
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
    class="border-border-subtle bg-surface-panel hover:bg-surface-panel-hover rounded-control flex min-h-6 min-w-0 flex-1 items-center gap-1.5 border px-1.5 py-1 disabled:cursor-not-allowed"
  >
    <span
      class="border-border-subtle size-4 shrink-0 rounded-full border"
      style:background={mixed ? "var(--token-surface-selection)" : token}
    ></span>
    <span class="text-caption text-ink-secondary truncate">{mixed ? "Mixed" : label}</span>
    <ChevronDown size={12} aria-hidden="true" class="text-ink-muted ms-auto shrink-0" />
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
