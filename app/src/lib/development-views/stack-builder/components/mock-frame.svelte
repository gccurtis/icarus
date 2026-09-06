<script lang="ts">
  let { appearance, revision }: { appearance: string; revision: number } = $props();

  const src = $derived(`/demo/stack-builder/mock?appearance=${appearance}&r=${revision}`);
</script>

<iframe {src} title="The generated mock" sandbox="" class="h-full w-full border-0"></iframe>
