<script lang="ts">
  import StackBuilder from "$development-views/stack-builder/stack-builder.svelte";

  const indexes = import.meta.glob("$lib/components/authored/*/index.ts", {
    eager: true
  }) as Record<string, Record<string, unknown>>;

  const files = import.meta.glob("$lib/components/authored/*/*.svelte", {
    eager: true,
    import: "default"
  }) as Record<string, unknown>;
</script>

<StackBuilder {indexes} {files} />
