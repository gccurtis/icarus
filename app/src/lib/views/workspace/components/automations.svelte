<script lang="ts">
  import type { Tab } from "$model/client";
  import Placeholder from "$views/workspace/components/placeholder.svelte";

  /** The `automations` screen. Not built — see `placeholder.svelte`. */
  let { tab }: { tab: Tab } = $props();
</script>

<Placeholder title="Automations">
  {tab.viewState.kind}
</Placeholder>
