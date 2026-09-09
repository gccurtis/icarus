<script lang="ts">
  import { page } from "$app/state";
  import RunbookPage from "$development-views/derived-output-rebase/components/runbook-page.svelte";
</script>

<RunbookPage project={page.params.project ?? ""} />
