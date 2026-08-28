<script lang="ts">
  import Review from "$views/development/review/review.svelte";

  /** One centre at a time. See `/demo/context` for why the glob lives here. */
  const modules = import.meta.glob("$lib/views/workspaces/**/*.svelte");
</script>

<Review kind="workspace" {modules} />
