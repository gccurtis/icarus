<script lang="ts">
  import { clearOverrides } from "$mock-capabilities/read.svelte";
  import type { DoorCall } from "$mock-capabilities/read.svelte";
  import ValueEditor from "$views/review/components/value-editor.svelte";

  /**
   * What the panel on the stage turned out to be a function of.
   *
   * Not a list of everything the mock world holds — a list of the doors THIS
   * panel actually called, in the order it called them, because that is the
   * question a reviewer has: change this, and what moves?
   *
   * It is collapsed by default. A door's answer is often forty rows of JSON, and
   * a page that opens with all of them showing is a page whose panel is off the
   * bottom of the screen.
   */
  let {
    doors,
    onchange
  }: {
    doors: DoorCall[];
    onchange: () => void;
  } = $props();

  let open = $state<string | undefined>(undefined);

  const overridden = $derived(doors.filter((door) => door.overridden).length);

  /** A door's answer, one line, so a closed row still says something. */
  const summarise = (value: unknown): string => {
    if (Array.isArray(value)) return `${value.length} row${value.length === 1 ? "" : "s"}`;
    if (value === null || value === undefined) return "—";
    if (typeof value === "object") return Object.keys(value).join(" · ");
    return String(value);
  };
</script>

<section class="flex flex-col gap-1">
  <header class="flex items-baseline gap-3">
    <h2 class="text-caption text-ink-muted font-semibold tracking-wide uppercase">
      A function of
    </h2>
    <span class="text-caption text-ink-muted tabular-nums">
      {doors.length} door{doors.length === 1 ? "" : "s"}
    </span>
    {#if overridden > 0}
      <button
        type="button"
        class="text-caption text-attention-text hover:underline"
        onclick={() => {
          clearOverrides();
          onchange();
        }}
      >
        {overridden} overridden — reset all
      </button>
    {/if}
  </header>

  {#if doors.length === 0}
    <p class="text-caption text-ink-muted m-0">
      This one reads no door. Everything it shows is either a prop or its own state.
    </p>
  {:else}
    <div class="border-border-subtle divide-border-subtle rounded-panel divide-y border">
      {#each doors as door (door.id)}
        <div class="flex flex-col">
          <button
            type="button"
            class="hover:bg-surface-panel-hover flex items-baseline gap-3 px-2 py-1 text-start"
            onclick={() => (open = open === door.id ? undefined : door.id)}
          >
            <span class="text-body-sm text-ink-primary font-mono">{door.id}</span>
            <span class="text-caption text-ink-muted flex-1 truncate">{summarise(door.value)}</span>
            {#if door.overridden}
              <span class="text-caption text-attention-text">overridden</span>
            {/if}
            <span class="text-caption text-ink-muted">{open === door.id ? "−" : "+"}</span>
          </button>

          {#if open === door.id}
            <div class="px-2 pb-2">
              <ValueEditor id={door.id} value={door.value} overridden={door.overridden} {onchange} />
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</section>
