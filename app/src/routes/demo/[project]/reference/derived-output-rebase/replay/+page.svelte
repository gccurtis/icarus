<script lang="ts">
  import { page } from "$app/state";
  import ReplayPage from "$development-views/derived-output-rebase/components/replay-page.svelte";
</script>

<ReplayPage project={page.params.project ?? ""} />
