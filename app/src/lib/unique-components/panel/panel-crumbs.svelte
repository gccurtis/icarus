<script lang="ts">
  import * as Breadcrumb from "$lib/simple-components/breadcrumb";
  import { traceNode } from "$lib/trace/trace.svelte";

  /**
   * Where the inspected thing sits, and the way back up.
   *
   * An inspector lens is reached by clicking something inside something else — a
   * formula inside a block inside a document — and without a trail there is no
   * way back to the container except finding it again on the canvas.
   *
   * `simple-components/breadcrumb` underneath, so the landmark, the list
   * semantics and the separator are the registry's. What this adds is the
   * panel's density and the shape of a trail that has no URLs in it.
   *
   * **Ancestors are navigable; the last entry is not.** The trail ends at what
   * you are looking at, so its final entry is `Breadcrumb.Page` rather than a
   * control: a button that reselects what is already selected teaches nothing
   * and looks broken when it appears to do nothing.
   *
   * **Every crumb is a button, not an anchor.** These navigate the inspector,
   * not the document — there is no URL for one to have. `Breadcrumb.Link` takes
   * a `child` snippet for exactly this, so the registry's styling lands on the
   * element the behaviour actually needs.
   */
  let {
    trail,
    onnavigate
  }: {
    /** Root first, current last. An entry with no `key` cannot be navigated to. */
    trail: readonly { label: string; key?: string }[];
    onnavigate: (key: string) => void;
  } = $props();

  // The marker is forwarded through `Breadcrumb.Root` onto the element it renders.
  const trace = traceNode("PanelCrumbs", () => ({ trail }));
</script>

<Breadcrumb.Root {...trace} class="px-3 pt-2">
  <Breadcrumb.List class="text-caption text-ink-muted gap-0.5">
    {#each trail as crumb, index (crumb.label)}
      {#if index > 0}
        <Breadcrumb.Separator class="[&>svg]:size-2.5" />
      {/if}
      <Breadcrumb.Item>
        {#if crumb.key && index < trail.length - 1}
          <Breadcrumb.Link class="hover:text-ink-primary rounded-control px-0.5 hover:underline">
            {#snippet child({ props })}
              <!--
                The class is taken and the rest is not. The registry types these
                props for an anchor — right down to its event handlers — and
                spreading an anchor's surface onto a button is a type error
                rather than a nuisance. What is wanted from the registry here is
                the styling, and that is the whole of what is read.
              -->
              <button
                type="button"
                data-slot="breadcrumb-link"
                class={props.class}
                onclick={() => onnavigate(crumb.key!)}
              >
                {crumb.label}
              </button>
            {/snippet}
          </Breadcrumb.Link>
        {:else}
          <Breadcrumb.Page class="text-ink-primary px-0.5">{crumb.label}</Breadcrumb.Page>
        {/if}
      </Breadcrumb.Item>
    {/each}
  </Breadcrumb.List>
</Breadcrumb.Root>
