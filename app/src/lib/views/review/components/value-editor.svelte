<script lang="ts">
  import { clearOverride, overrideDoor } from "$mock-capabilities/read.svelte";

  /**
   * One door's answer, as something a reader can change.
   *
   * Three shapes, because a door answers three kinds of thing and one editor for
   * all of them would be a JSON box for a string. A scalar gets a field, a flat
   * record gets a row per key, and everything else gets JSON — which is honest
   * rather than lazy: a list of forty rows has no editor that is better than the
   * text of it, and pretending otherwise builds a form nobody can use.
   *
   * **A change is an override, not an edit.** The sample data is never written
   * to, so *Reset* puts the door back and two panels reading the same door still
   * agree with each other.
   */
  let {
    id,
    value,
    overridden,
    onchange
  }: {
    id: string;
    value: unknown;
    overridden: boolean;
    /** The page re-reads the door log; this says when. */
    onchange: () => void;
  } = $props();

  const isScalar = (v: unknown) =>
    typeof v === "string" || typeof v === "number" || typeof v === "boolean";

  const isFlatRecord = (v: unknown) =>
    typeof v === "object" &&
    v !== null &&
    !Array.isArray(v) &&
    Object.values(v).every((field) => isScalar(field) || field === undefined || field === null);

  const shape = $derived(isScalar(value) ? "scalar" : isFlatRecord(value) ? "record" : "json");

  /** The JSON box is edited as text, so a half-typed value does not throw. */
  let draft = $state("");
  let problem = $state<string | undefined>(undefined);

  $effect(() => {
    // Re-seed when the door changes underneath, but never while it is being typed.
    if (document.activeElement?.getAttribute("data-json") !== id) {
      draft = JSON.stringify(value, null, 2);
    }
  });

  const set = (next: unknown) => {
    overrideDoor(id, next);
    onchange();
  };

  const commitJson = () => {
    try {
      set(JSON.parse(draft));
      problem = undefined;
    } catch (error) {
      problem = error instanceof Error ? error.message : "That is not JSON.";
    }
  };

  const reset = () => {
    clearOverride(id);
    problem = undefined;
    onchange();
  };

  const record = $derived(shape === "record" ? (value as Record<string, unknown>) : {});
</script>

<div class="flex flex-col gap-1.5">
  {#if shape === "scalar"}
    {#if typeof value === "boolean"}
      <label class="text-caption text-ink-secondary flex items-center gap-2">
        <input type="checkbox" checked={value} onchange={(e) => set(e.currentTarget.checked)} />
        {value ? "true" : "false"}
      </label>
    {:else}
      <input
        class="border-border-subtle bg-surface-canvas text-body-sm rounded-control border px-2 py-1 font-mono"
        value={String(value)}
        oninput={(e) =>
          set(typeof value === "number" ? Number(e.currentTarget.value) : e.currentTarget.value)}
      />
    {/if}
  {:else if shape === "record"}
    <div class="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-x-2 gap-y-1">
      {#each Object.entries(record) as [key, field] (key)}
        <span class="text-caption text-ink-muted truncate" title={key}>{key}</span>
        <input
          class="border-border-subtle bg-surface-canvas text-caption rounded-control border px-1.5 py-0.5 font-mono"
          value={field === undefined || field === null ? "" : String(field)}
          oninput={(e) => {
            const raw = e.currentTarget.value;
            set({ ...record, [key]: typeof field === "number" ? Number(raw) : raw });
          }}
        />
      {/each}
    </div>
  {:else}
    <textarea
      data-json={id}
      rows="6"
      class="border-border-subtle bg-surface-canvas text-mono rounded-control border p-2 font-mono"
      bind:value={draft}
      onblur={commitJson}
    ></textarea>
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="text-caption text-interactive-text hover:underline"
        onclick={commitJson}
      >
        Apply
      </button>
      {#if problem}<span class="text-caption text-danger-text">{problem}</span>{/if}
    </div>
  {/if}

  {#if overridden}
    <button type="button" class="text-caption text-attention-text w-fit hover:underline" onclick={reset}>
      Overridden — put the sample back
    </button>
  {/if}
</div>
