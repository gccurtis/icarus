<script lang="ts">
  import "$development-views/external-files-reference/components/stable-tab-mock.css";

  import StableTabMockShell from "$development-views/external-files-reference/components/stable-tab-mock-shell.svelte";
  import { provideStableTabMockState } from "$development-views/external-files-reference/procedures/stable-tab-mock/context.svelte";
  import { StableTabMockState } from "$development-views/external-files-reference/components/stable-tab-mock.state.svelte";

  const state = new StableTabMockState();
  provideStableTabMockState(state);
</script>

<StableTabMockShell />
