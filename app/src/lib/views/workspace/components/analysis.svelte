<script lang="ts">
  import type { Tab } from "$model/client";
  import Placeholder from "$views/workspace/components/placeholder.svelte";

  /** The `analysis` screen. Not built — see `placeholder.svelte`. */
  let { tab }: { tab: Tab } = $props();
</script>

<Placeholder title="Analysis">
  {tab.viewState.kind}
</Placeholder>
