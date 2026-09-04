<script lang="ts">
  let { theme, revision }: { theme: string; revision: number } = $props();

  const src = $derived(`/demo/stack-builder/mock?theme=${theme}&r=${revision}`);
</script>

<iframe {src} title="The generated mock" sandbox="" class="h-full w-full border-0"></iframe>
