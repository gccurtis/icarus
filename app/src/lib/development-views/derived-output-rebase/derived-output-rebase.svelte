<script lang="ts">
  import OverviewPage from "$development-views/derived-output-rebase/components/overview-page.svelte";

  let { project }: { project: string } = $props();
</script>

<OverviewPage {project} />
