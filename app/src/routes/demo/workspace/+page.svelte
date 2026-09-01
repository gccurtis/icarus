<script lang="ts">
  import Review from "$development-views/review/review.svelte";

  /** One centre at a time. See `/demo/context` for why the glob lives here. */
  const modules = import.meta.glob("$lib/app-views/workspaces/**/*.svelte");
</script>

<Review kind="workspace" {modules} />
