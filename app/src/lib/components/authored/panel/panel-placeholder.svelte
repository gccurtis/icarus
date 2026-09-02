<script lang="ts">
  import { traceNode } from "$development-components/trace.svelte";

  /**
   * A panel that has been asked for and does not exist yet.
   *
   * **It names the key.** A flank that renders blank is indistinguishable from a
   * flank that failed to load, and both are indistinguishable from a routing bug.
   * Saying which key arrived turns all three into one legible state — and makes
   * the rail testable by hand, because clicking every icon and reading the keys
   * back is the only proof that every one of them routes.
   *
   * **It shows the address as well as the key.** A lens is about something, and
   * "the key arrived" is a weaker claim than "the key arrived and it knows which
   * person it is about". The fields differ by stack because what addresses a
   * panel differs: a context view is scoped by the tab, a lens by the selection.
   *
   * **Strings rather than a `Selection`.** A component knows only its props, so
   * the shape of the model is the caller's business — which is what lets this
   * render in a test with no view state at all.
   */
  let {
    panel,
    category,
    content,
    kind,
    id,
    at
  }: {
    /** The key that routed here: `project.variables`, `collaboration.person`. */
    panel: string;
    /** Context only: the tab that scopes it. */
    category?: string;
    content?: string;
    /** Inspector only: what the lens is about. */
    kind?: string;
    id?: string;
    at?: string;
  } = $props();

  const trace = traceNode("PanelPlaceholder", () => ({ panel, category, content, kind, id, at }));

  /** Absent and empty read the same to a person: neither is an answer. */
  const shown = (value: string | undefined) => (value === undefined || value === "" ? "—" : value);

  const address = $derived(
    category !== undefined || content !== undefined
      ? [
          ["category", shown(category)],
          ["content", shown(content)]
        ]
      : [
          ["kind", shown(kind)],
          ["id", shown(id)],
          ["at", shown(at)]
        ]
  );
</script>

<div {...trace} class="flex flex-col gap-2 p-3">
  <p class="text-caption text-ink-muted m-0">Not built yet</p>
  <p class="text-body-sm text-ink-primary m-0 font-mono break-all">{panel}</p>

  <dl class="m-0 grid grid-cols-[minmax(0,5rem)_1fr] gap-x-2 gap-y-0.5">
    {#each address as [label, value] (label)}
      <dt class="text-caption text-ink-muted m-0">{label}</dt>
      <dd class="text-caption text-ink-secondary m-0 font-mono break-all">{value}</dd>
    {/each}
  </dl>
</div>
