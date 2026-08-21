<script lang="ts">
  import type { Component, Snippet } from "svelte";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";

  import * as Collapsible from "$lib/simple-components/collapsible";
  import { cn } from "$lib/simple-components/utils";

  /**
   * One node of a `PanelTree`: a line, and whatever is under it.
   *
   * **A branch with nothing under it draws no twisty.** An empty disclosure is a
   * control that lies — it offers to open something and opens nothing, and a
   * reader who presses two of them stops trusting the rest. So `children` is
   * what decides whether there is a twisty at all, and a leaf keeps its width so
   * the labels still line up. Pass `children` only where something is genuinely
   * under this one; a snippet that renders an empty list is the same lie with
   * more steps.
   *
   * **Indentation comes from the nesting.** A branch renders its children inside
   * its own body, so a level is one step of padding applied here rather than a
   * number the caller counts and carries down. `PanelRow`'s `depth` is that
   * number, and having to pass it is why it had to be capped.
   *
   * **A disclosure tree, not `role="tree"`.** An ARIA tree owes the reader
   * roving tabindex, arrow-key movement, type-ahead and Home/End, and the
   * registry has no tree to inherit any of it from. Claiming the role and
   * keeping none of the promise is the silent loss this vocabulary exists to
   * prevent, so what is claimed is what `simple-components/collapsible` actually
   * delivers: a tab-reachable trigger that states whether it is open.
   *
   * **Opening a branch and opening its subject are two acts.** Given `onselect`,
   * the twisty and the label are separate controls — `ScreenDecision` splits
   * selecting a card from deciding it on the same grounds. Without it the whole
   * head toggles, because a larger target for the only thing the line does is
   * free.
   */
  let {
    label,
    meta,
    icon: Icon,
    open = $bindable(false),
    selected = false,
    onselect,
    children
  }: {
    label: string;
    /** The right-hand end: a count of what is inside, a state, a time. */
    meta?: string;
    icon?: Component<{ size?: number | string; "aria-hidden"?: boolean | "true" | "false" }>;
    /**
     * Whether it starts open, and bindable for the caller that has an Expand all.
     *
     * Shut by default: a tree that opens itself is forty rows again, which is
     * the state disclosure exists to leave.
     */
    open?: boolean;
    /** Whether this is the node the panel is currently about. */
    selected?: boolean;
    /** Opens the node's subject. Separate from opening the branch. */
    onselect?: () => void;
    /** What is under it. Absent for a leaf — see above. */
    children?: Snippet;
  } = $props();

  /**
   * The twisty's box is 16px and the gap after it is 4px, so a level is 20px and
   * a child's label lands under its parent's. The two numbers are here and the
   * `ps-5` below is the same step; changing one without the other unhooks the
   * indentation from the thing it is meant to line up with.
   */
  const HEAD = $derived(
    cn(
      "rounded-control text-body-sm flex min-h-6 w-full items-center gap-1 px-1 py-1",
      selected ? "bg-active-surface text-active-text" : "text-ink-primary"
    )
  );

</script>

{#snippet face()}
  <span class="flex min-w-0 flex-1 items-center gap-1.5 text-start">
    {#if Icon}
      <span class={cn("flex shrink-0", selected ? "text-active-text" : "text-ink-muted")}>
        <Icon size={14} aria-hidden="true" />
      </span>
    {/if}
    <span title={label} class="min-w-0 flex-1 truncate">{label}</span>
    {#if meta}
      <span class="text-caption text-ink-muted shrink-0 tabular-nums">{meta}</span>
    {/if}
  </span>
{/snippet}

{#snippet twisty()}
  <ChevronDown
    size={13}
    aria-hidden="true"
    class={cn("transition-transform duration-small", !open && "-rotate-90")}
  />
{/snippet}

{#if children}
  <Collapsible.Root bind:open class="flex flex-col">
    {#if onselect}
      <div class={HEAD}>
        <!--
          The trigger is named for its subject rather than for the act: `bits-ui`
          puts the expanded state on it already, and "Terms, collapsed, button"
          says more than "Expand, button" ever could.
        -->
        <Collapsible.Trigger
          aria-label={label}
          class="text-ink-muted hover:text-ink-primary flex size-4 shrink-0 items-center justify-center"
        >
          {@render twisty()}
        </Collapsible.Trigger>
        <button
          type="button"
          onclick={onselect}
          aria-current={selected ? "true" : undefined}
          class="min-w-0 flex-1 hover:underline"
        >
          {@render face()}
        </button>
      </div>
    {:else}
      <Collapsible.Trigger class={cn(HEAD, "hover:bg-surface-panel-hover text-start")}>
        <span class="text-ink-muted flex size-4 shrink-0 items-center justify-center">
          {@render twisty()}
        </span>
        {@render face()}
      </Collapsible.Trigger>
    {/if}

    <Collapsible.Content class="flex flex-col ps-5">
      {@render children()}
    </Collapsible.Content>
  </Collapsible.Root>
{:else}
  <div class={HEAD}>
    <!-- The twisty's width without the twisty, so a leaf's label lines up. -->
    <span class="size-4 shrink-0" aria-hidden="true"></span>
    {#if onselect}
      <button
        type="button"
        onclick={onselect}
        aria-current={selected ? "true" : undefined}
        class="min-w-0 flex-1 hover:underline"
      >
        {@render face()}
      </button>
    {:else}
      {@render face()}
    {/if}
  </div>
{/if}
