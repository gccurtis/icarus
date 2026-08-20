<script lang="ts">
  import type { Snippet } from "svelte";
  import ArrowDownWideNarrow from "@lucide/svelte/icons/arrow-down-wide-narrow";
  import Search from "@lucide/svelte/icons/search";

  import * as InputGroup from "$lib/simple-components/input-group";
  import * as Select from "$lib/simple-components/select";

  /**
   * The row above a table or a card grid: what narrows it, what orders it, and
   * how much of it you are looking at.
   *
   * The three belong together because they answer one question — *which of these
   * am I seeing, and in what order* — and splitting them puts half the answer
   * somewhere else. Sorting was the half that was missing, and its absence was
   * doing real damage: a table showing "6 of 41" in an order nobody chose is a
   * table whose first row looks like a ranking.
   *
   * `simple-components/input-group` for the field and `select` for the order, so
   * the focus ring belongs to the whole control and the listbox is bits-ui's.
   *
   * **The count is always matched-of-total** — "6 of 41", "24 of 24" — so a
   * filtered view can never be mistaken for the whole. A bare number there would
   * be the most quietly misleading thing on the screen.
   *
   * **Order is a choice, never an accident.** When `sorts` is given the current
   * one is named, because "sorted by whatever the query returned" is the state
   * that makes people trust the wrong row.
   */
  let {
    placeholder,
    matched,
    total,
    sorts,
    sort = $bindable(""),
    value = $bindable(""),
    onsort,
    children
  }: {
    /** Says what will be searched. */
    placeholder: string;
    /** How many are showing. With `total`, rendered as "6 of 41". */
    matched?: number;
    total?: number;
    /** The orders offered. Absent when there is genuinely only one. */
    sorts?: readonly { value: string; label: string }[];
    sort?: string;
    value?: string;
    onsort?: (next: string) => void;
    /** Filter controls, between the field and the order. */
    children?: Snippet;
  } = $props();

  const count = $derived(
    matched !== undefined && total !== undefined ? `${matched} of ${total}` : undefined
  );
  const chosen = $derived(sorts?.find((option) => option.value === sort));
</script>

<div class="flex flex-wrap items-center gap-2">
  <InputGroup.Root class="h-7 min-w-45 max-w-75 flex-1">
    <InputGroup.Addon class="text-ink-muted [&>svg]:size-3.5">
      <Search aria-hidden="true" />
    </InputGroup.Addon>
    <InputGroup.Input
      type="search"
      bind:value
      {placeholder}
      aria-label={placeholder}
      class="text-body-sm [&::-webkit-search-cancel-button]:hidden"
    />
  </InputGroup.Root>

  {#if children}
    {@render children()}
  {/if}

  {#if sorts && sorts.length > 0}
    <Select.Root
      type="single"
      value={sort}
      onValueChange={(next: string) => {
        sort = next;
        onsort?.(next);
      }}
    >
      <Select.Trigger size="sm" aria-label="Order" class="text-caption w-auto gap-1.5">
        <ArrowDownWideNarrow class="text-ink-muted size-3.5" aria-hidden="true" />
        {chosen?.label ?? "Order"}
      </Select.Trigger>
      <Select.Content>
        {#each sorts as option (option.value)}
          <Select.Item value={option.value} label={option.label}>{option.label}</Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>
  {/if}

  {#if count}
    <span class="text-caption text-ink-muted ms-auto tabular-nums">{count}</span>
  {/if}
</div>
