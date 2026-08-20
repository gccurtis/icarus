<script lang="ts">
  import type { Tab } from "$model/client";
  import { ScreenPlaceholder } from "$lib/unique-components/screen";

  /**
   * The document editor's workspace: one region, and that region is ProseMirror.
   *
   * A rich-text editor is not a composition of panels, so drawing it as one would
   * describe the framework's job rather than ours. What this directory owns for
   * this screen is everything around it — the context panel and the inspector,
   * which between them carry every property and every command, because there is
   * no toolbar.
   */
  let { tab }: { tab: Tab } = $props();

  // svelte-ignore state_referenced_locally
  void tab;
</script>

<ScreenPlaceholder framework="ProseMirror, paginated">
  Icarus adds what ProseMirror has no concept of: pages of a chosen paper with all
  four gutters drawn, header and footer furniture with one canonical editor each,
  inline formulas that read their value when they run, and prompt blocks that run
  on open. It takes back the toolbar, and formatting through named styles rather
  than marks on a range.
</ScreenPlaceholder>
