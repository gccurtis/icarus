<script lang="ts">
  import type { Tab } from "$model/client";
  import Placeholder from "$views/workspace/components/placeholder.svelte";

  /** The `research` screen. Not built — see `placeholder.svelte`. */
  let { tab }: { tab: Tab } = $props();
</script>

<Placeholder title="Research">
  {tab.viewState.kind}
</Placeholder>
