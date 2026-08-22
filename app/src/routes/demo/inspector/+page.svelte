<script lang="ts">
  import Review from "$views/review/review.svelte";

  /** One lens at a time. See `/demo/context` for why the glob lives here. */
  const modules = import.meta.glob("$lib/inspector/**/*.svelte");
</script>

<Review kind="inspector" {modules} />
