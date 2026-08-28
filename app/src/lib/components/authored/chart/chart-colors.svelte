<script lang="ts">
  import { traceNode } from "$development-components/trace.svelte";

  import { Input } from "$vendored-components/input";
  import * as Popover from "$vendored-components/popover";
  import { cn } from "$vendored-components/utils";
  import { SERIES_COLORS } from "$authored-components/chart/palette";

  /**
   * Choosing what each series is drawn in.
   *
   * **The role tokens come first, and an arbitrary colour is available second.**
   * That order is the whole argument. A chart picked from the tokens follows a
   * theme swap, prints legibly, and agrees with the eleven other things on the
   * screen; a chart picked from a colour wheel does none of that. But a chart is
   * also the one surface where a person legitimately has a colour they must
   * match — a client's brand, a regulator's convention, the palette of the deck
   * this is going into — and refusing that outright means they leave and rebuild
   * the chart in a tool that will let them.
   *
   * So: the tokens are the presets, and "any colour" is a second step rather
   * than a refusal.
   *
   * **Both a wheel and a hex field**, because they are different jobs. The wheel
   * is for choosing; the field is for matching something exact, which is what
   * matching a brand colour by its exact code needs, and what a wheel cannot do.
   *
   * **A swatch is never the only signal.** Each row names its series, so the
   * control is usable without colour vision — which is the same rule `PanelChip`
   * keeps, and it matters more here rather than less.
   */
  let {
    series,
    colors = $bindable({}),
    onreset
  }: {
    series: readonly { key: string; label?: string }[];
    /** Overrides by series key. Absent keys fall back to the role tokens. */
    colors?: Record<string, string>;
    onreset?: () => void;
  } = $props();

  const trace = traceNode("ChartColors", () => ({ series, colors }));

  /** A hex the browser will accept. Anything else is rejected rather than guessed. */
  const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

  let draft = $state<Record<string, string>>({});

  const set = (key: string, value: string) => {
    colors = { ...colors, [key]: value };
  };
</script>

<div {...trace} class="flex flex-wrap items-center gap-2">
  {#each series as entry (entry.key)}
    {@const current = colors[entry.key]}
    <Popover.Root>
      <Popover.Trigger>
        {#snippet child({ props })}
          <button
            {...props}
            type="button"
            class="border-border-subtle bg-surface-panel hover:border-interactive-border rounded-control text-caption text-ink-secondary inline-flex cursor-pointer items-center gap-1.5 border px-1.5 py-1"
          >
            <span
              class="border-border-subtle size-3 shrink-0 rounded-full border"
              style="background: {current ?? SERIES_COLORS[series.indexOf(entry) % SERIES_COLORS.length]}"
            ></span>
            {entry.label ?? entry.key}
          </button>
        {/snippet}
      </Popover.Trigger>

      <Popover.Content class="w-60">
        <div class="flex flex-col gap-3">
          <div class="flex flex-col gap-1.5">
            <span class="text-caption text-ink-muted font-semibold tracking-wide uppercase">
              From the theme
            </span>
            <div class="flex flex-wrap gap-1.5">
              {#each SERIES_COLORS as token (token)}
                <button
                  type="button"
                  onclick={() => set(entry.key, token)}
                  aria-label={`Use the theme colour ${SERIES_COLORS.indexOf(token) + 1}`}
                  class={cn(
                    "rounded-control size-6 cursor-pointer border",
                    current === token ? "border-active-border" : "border-border-subtle"
                  )}
                  style="background: {token}"
                ></button>
              {/each}
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <span class="text-caption text-ink-muted font-semibold tracking-wide uppercase">
              Any colour
            </span>
            <div class="flex items-center gap-2">
              <input
                type="color"
                aria-label={`Pick any colour for ${entry.label ?? entry.key}`}
                value={current?.startsWith("#") ? current : undefined}
                oninput={(event) => set(entry.key, event.currentTarget.value)}
                class="border-border-subtle rounded-control size-8 shrink-0 cursor-pointer border bg-transparent p-0.5"
              />
              <Input
                value={draft[entry.key] ?? (current?.startsWith("#") ? current : "")}
                placeholder="Hex code"
                aria-label={`Hex colour for ${entry.label ?? entry.key}`}
                class="text-mono h-8 font-mono"
                oninput={(event) => {
                  const next = event.currentTarget.value;
                  draft = { ...draft, [entry.key]: next };
                  // Applied only once the field holds a whole colour. Painting on
                  // every keystroke would flash the chart through each partial
                  // code as it is typed.
                  if (HEX.test(next.trim())) set(entry.key, next.trim());
                }}
              />
            </div>
          </div>

          {#if current}
            <button
              type="button"
              onclick={() => {
                const { [entry.key]: _dropped, ...rest } = colors;
                colors = rest;
                draft = { ...draft, [entry.key]: "" };
              }}
              class="text-caption text-interactive-text w-fit cursor-pointer border-none bg-transparent p-0 hover:underline"
            >
              Back to the theme colour
            </button>
          {/if}
        </div>
      </Popover.Content>
    </Popover.Root>
  {/each}

  {#if onreset && Object.keys(colors).length > 0}
    <button
      type="button"
      onclick={onreset}
      class="text-caption text-interactive-text cursor-pointer border-none bg-transparent p-0 hover:underline"
    >
      Reset all
    </button>
  {/if}
</div>
