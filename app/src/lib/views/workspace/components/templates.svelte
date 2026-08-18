<script lang="ts">
  import type { Tab } from "$model/client";
  import Placeholder from "$views/workspace/components/placeholder.svelte";

  /** The `templates` screen. Not built — see `placeholder.svelte`. */
  let { tab }: { tab: Tab } = $props();
</script>

<Placeholder title="Templates">
  {tab.viewState.kind}
</Placeholder>
