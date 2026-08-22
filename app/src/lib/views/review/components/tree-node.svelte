<script lang="ts">
  import { behaviourProps, readableProps, type TraceNode } from "$lib/trace/trace.svelte";
  import Self from "$views/review/components/tree-node.svelte";

  /**
   * One component in the composition, and what it was handed.
   *
   * **Read-only, and that is the point.** Everything here is derived from the
   * state above the stage; a second place to change it would be a second answer
   * about what the panel is a function of. Change the door, watch this move.
   *
   * The props are read through the node's thunk at render time, so a value that
   * changes upstream changes here without the tree being rebuilt.
   */
  let {
    node,
    depth = 0,
    onhover
  }: {
    node: TraceNode;
    depth?: number;
    /** Point at the thing this drew, on the stage. */
    onhover: (id: string | undefined) => void;
  } = $props();

  let open = $state(false);

  const values = $derived(readableProps(node));
  const behaviours = $derived(behaviourProps(node));

  /** A value on one line. A tree is scanned, so nothing here may wrap. */
  const short = (value: unknown): string => {
    if (typeof value === "string") return `"${value}"`;
    if (Array.isArray(value)) return `[${value.length}]`;
    if (value === null) return "null";
    if (value === undefined) return "—";
    if (typeof value === "object") return `{${Object.keys(value).join(", ")}}`;
    return String(value);
  };
</script>

<li>
  <div
    class="hover:bg-surface-hover flex items-baseline gap-1.5"
    style:padding-inline-start="{depth * 12}px"
    onmouseenter={() => onhover(node.id)}
    onmouseleave={() => onhover(undefined)}
    role="presentation"
  >
    <button
      type="button"
      class="text-caption text-ink-muted w-3 shrink-0"
      onclick={() => (open = !open)}
      aria-expanded={open}
      aria-label="{open ? 'Hide' : 'Show'} what {node.name} was given"
    >
      {values.length + behaviours.length > 0 ? (open ? "−" : "+") : ""}
    </button>
    <span class="text-body-sm text-ink-primary font-mono">{node.name}</span>
    {#if node.children.length > 0}
      <span class="text-caption text-ink-muted tabular-nums">{node.children.length}</span>
    {/if}
  </div>

  {#if open}
    <dl
      class="text-caption grid grid-cols-[minmax(0,7rem)_1fr] gap-x-2"
      style:padding-inline-start="{depth * 12 + 24}px"
    >
      {#each values as [key, value] (key)}
        <dt class="text-ink-muted truncate" title={key}>{key}</dt>
        <dd class="text-ink-secondary m-0 truncate font-mono" title={short(value)}>
          {short(value)}
        </dd>
      {/each}
      {#each behaviours as key (key)}
        <dt class="text-ink-muted truncate" title={key}>{key}</dt>
        <!-- A snippet or a callback. What it does belongs to the caller. -->
        <dd class="text-inactive-text m-0 truncate">given</dd>
      {/each}
    </dl>
  {/if}

  {#if node.children.length > 0}
    <ul class="m-0 list-none p-0">
      {#each node.children as child (child.id)}
        <Self node={child} depth={depth + 1} {onhover} />
      {/each}
    </ul>
  {/if}
</li>
