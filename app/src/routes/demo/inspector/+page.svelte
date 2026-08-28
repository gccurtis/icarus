<script lang="ts">
  import Review from "$views/development/review/review.svelte";

  /** One lens at a time. See `/demo/context` for why the glob lives here. */
  const modules = import.meta.glob("$lib/views/panels/inspector/**/*.svelte");
</script>

<Review kind="inspector" {modules} />
