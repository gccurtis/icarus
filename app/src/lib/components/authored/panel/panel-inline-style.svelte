<script lang="ts">
  import PanelButton from "$authored-components/panel/panel-button.svelte";
  import PanelColorPicker from "$authored-components/panel/panel-color-picker.svelte";
  import PanelMarks from "$authored-components/panel/panel-marks.svelte";
  import { Input } from "$vendored-components/input";

  type Swatch = { readonly value: string; readonly label: string; readonly token: string };

  let {
    marks,
    mixedMarks = [],
    options,
    foreground,
    background,
    foregroundOptions,
    backgroundOptions,
    coloursMixed = false,
    marksDisabled = false,
    prefix = "",
    onmarks,
    onforeground,
    onbackground
  }: {
    marks: string[];
    mixedMarks?: readonly string[];
    options: readonly { value: string; label: string }[];
    foreground: string;
    background: string;
    foregroundOptions: readonly Swatch[];
    backgroundOptions: readonly Swatch[];
    coloursMixed?: boolean;
    marksDisabled?: boolean;
    prefix?: string;
    onmarks?: (next: string[]) => void;
    onforeground?: (next: string) => void;
    onbackground?: (next: string) => void;
  } = $props();

  const defaultHex = () => `#${"0".repeat(6)}`;
  let custom = $state<"foreground" | "background" | undefined>(undefined);
  let hex = $state(defaultHex());
  let invalid = $state(false);

  const openCustom = (kind: "foreground" | "background") => {
    custom = kind;
    const held = kind === "foreground" ? foreground : background;
    hex = /^#[0-9a-f]{6}$/i.test(held) ? held : defaultHex();
    invalid = false;
  };

  const applyCustom = () => {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) {
      invalid = true;
      return;
    }
    if (custom === "foreground") onforeground?.(hex);
    if (custom === "background") onbackground?.(hex);
    custom = undefined;
    invalid = false;
  };
</script>

<PanelMarks
  label={prefix ? `Formatting ${prefix}` : "Formatting"}
  value={marks}
  mixed={mixedMarks}
  {options}
  disabled={marksDisabled}
  flush
  onchange={onmarks}
/>

<div class="flex min-w-0 items-center gap-3">
  <div class="flex min-w-0 flex-1 items-center gap-1.5">
    <span class="text-caption text-ink-muted shrink-0 font-medium">FG</span>
    <PanelColorPicker
      label={prefix ? `Foreground ${prefix}` : "Foreground"}
      value={foreground}
      mixed={coloursMixed}
      options={foregroundOptions}
      onchange={onforeground}
      oncustom={() => openCustom("foreground")}
    />
  </div>
  <div class="flex min-w-0 flex-1 items-center gap-1.5">
    <span class="text-caption text-ink-muted shrink-0 font-medium">BG</span>
    <PanelColorPicker
      label={prefix ? `Background ${prefix}` : "Background"}
      value={background}
      mixed={coloursMixed}
      options={backgroundOptions}
      onchange={onbackground}
      oncustom={() => openCustom("background")}
    />
  </div>
</div>

{#if custom !== undefined}
  <div class="border-border-subtle bg-surface-panel-hover rounded-control flex min-w-0 flex-col gap-1.5 border p-2">
    <label for={`custom-${custom}`} class="text-caption text-ink-secondary">
      Custom {custom} colour
    </label>
    <div class="flex min-w-0 items-center gap-1.5">
      <input
        type="color"
        aria-label={`Choose custom ${custom} colour`}
        value={hex}
        class="border-border-subtle rounded-control h-7 w-8 shrink-0 cursor-pointer border bg-transparent p-0.5"
        oninput={(event) => {
          hex = event.currentTarget.value;
          invalid = false;
        }}
      />
      <Input
        id={`custom-${custom}`}
        value={hex}
        aria-invalid={invalid ? "true" : undefined}
        placeholder="#RRGGBB"
        class="text-body-sm h-7 min-w-0 flex-1 font-mono uppercase"
        oninput={(event) => {
          hex = event.currentTarget.value;
          invalid = false;
        }}
        onkeydown={(event) => event.key === "Enter" && applyCustom()}
      />
      <PanelButton label="Apply" tone="primary" onclick={applyCustom} />
    </div>
    {#if invalid}
      <span class="text-caption text-danger-text" role="alert">Use a six-digit hex colour.</span>
    {/if}
  </div>
{/if}
