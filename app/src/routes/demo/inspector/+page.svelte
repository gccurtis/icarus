<script lang="ts">
  import Review from "$development-views/review/review.svelte";

  /** One lens at a time. See `/demo/context` for why the glob lives here. */
  const modules = import.meta.glob("$lib/app-views/panels/inspector/**/*.svelte");
</script>

<Review kind="inspector" {modules} />
