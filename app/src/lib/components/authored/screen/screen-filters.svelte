<script lang="ts">
  import type { Snippet } from "svelte";
  import Search from "@lucide/svelte/icons/search";

  import * as InputGroup from "$lib/components/vendor/input-group";
  import * as Select from "$lib/components/vendor/select";
  import { cn } from "$lib/components/vendor/utils";
  import { traceNode } from "$components/development/trace.svelte";

  /**
   * The row above a table or a card grid: what narrows it, what orders it, and
   * how much of it you are looking at.
   *
   * The three belong together because they answer one question — *which of these
   * am I seeing, and in what order* — and splitting them puts half the answer
   * somewhere else. Sorting is the half most easily left out, and leaving it out
   * does real damage: a table showing "6 of 41" in an order nobody chose is a
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
   *
   * **The order names itself and wears no glyph.** A control reading *Updated*
   * has already said it is the order; an arrow beside the word is the same claim
   * a second time, and the one arrow on this row that carries meaning is the
   * direction's.
   *
   * **The direction shares a surface with the order.** Which way a sort runs is
   * half of one decision, and two separately bordered controls sitting next to
   * each other read as two — so when `order` is given, the two are drawn inside
   * one frame with a seam between them.
   */
  let {
    placeholder,
    matched,
    total,
    sorts,
    sort = $bindable(""),
    value = $bindable(""),
    onsort,
    order,
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
    /**
     * Which way the order runs, drawn inside the order's own frame. A control
     * rather than a flag, because what "ascending" means depends on what is
     * being ordered and only the caller knows how to say it.
     */
    order?: Snippet;
    /** Filter controls, between the field and the order. */
    children?: Snippet;
  } = $props();

  const trace = traceNode("ScreenFilters", () => ({
    placeholder,
    matched,
    total,
    sorts,
    sort,
    value
  }));

  const count = $derived(
    matched !== undefined && total !== undefined ? `${matched} of ${total}` : undefined
  );
  const chosen = $derived(sorts?.find((option) => option.value === sort));
</script>

<div {...trace} class="flex flex-wrap items-center gap-2">
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
    {#snippet picker()}
      <Select.Root
        type="single"
        value={sort}
        onValueChange={(next: string) => {
          sort = next;
          onsort?.(next);
        }}
      >
        <!-- Inside the shared frame the trigger gives up its own edge, so the
             two controls read as one thing rather than as two touching. -->
        <Select.Trigger
          size="sm"
          aria-label="Order"
          class={cn(
            "text-caption w-auto gap-1.5",
            // `dark:` as well, because the registry's trigger paints a dark fill
            // through a `dark:` rule that an unprefixed one cannot reach.
            order && "border-transparent bg-transparent dark:bg-transparent"
          )}
        >
          {chosen?.label ?? "Order"}
        </Select.Trigger>
        <Select.Content>
          {#each sorts as option (option.value)}
            <Select.Item value={option.value} label={option.label}>{option.label}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    {/snippet}

    {#if order}
      <div class="border-border-subtle bg-surface-panel rounded-control flex items-center border">
        {@render picker()}
        <span class="bg-border-subtle h-4 w-px" aria-hidden="true"></span>
        {@render order()}
      </div>
    {:else}
      {@render picker()}
    {/if}
  {/if}

  {#if count}
    <span class="text-caption text-ink-muted ms-auto tabular-nums">{count}</span>
  {/if}
</div>
