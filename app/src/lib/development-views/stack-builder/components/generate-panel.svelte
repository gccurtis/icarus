<script lang="ts">
  import { componentSources } from "$development-views/stack-builder/procedures/manifest";
  import { DEFAULT_MODEL, MODELS } from "$development-views/stack-builder/procedures/models";
  import { stackOf } from "$development-views/stack-builder/shared/stack.svelte";
  import { Button } from "$vendored-components/button";
  import { Textarea } from "$vendored-components/textarea";

  let {
    slug,
    theme,
    ongenerated
  }: { slug: string; theme: string; ongenerated: () => void } = $props();

  const stack = stackOf();

  let model = $state(DEFAULT_MODEL);
  let feedback = $state("");
  let running = $state(false);
  let failure = $state("");

  const refused = async (response: Response, fallback: string): Promise<string> => {
    const said = (await response.json().catch(() => ({}))) as { message?: string };
    return said.message ?? `${fallback} (${response.status})`;
  };

  const generate = async () => {
    running = true;
    failure = "";
    try {
      const response = await fetch("/demo/stack-builder/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          theme,
          model,
          feedback,
          title: stack.title,
          nodes: stack.nodes,
          sources: componentSources(stack.nodes)
        })
      });

      if (!response.ok) {
        failure = await refused(response, "generation failed");
        return;
      }

      feedback = "";
      ongenerated();
    } catch {
      failure = "the dev server is unreachable";
    } finally {
      running = false;
    }
  };

  const clear = async () => {
    failure = "";
    await fetch(`/demo/stack-builder/mock?theme=${theme}`, { method: "DELETE" });
    ongenerated();
  };

  const save = async () => {
    failure = "";
    const response = await fetch("/demo/stack-builder/mock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: slug })
    });
    if (!response.ok) failure = await refused(response, "save refused");
  };
</script>

<div class="border-border-subtle flex flex-col gap-2 border-b p-2">
  <select
    bind:value={model}
    aria-label="Model"
    class="border-border-subtle bg-surface-elevated text-body-sm rounded-control border p-1"
  >
    {#each MODELS as choice (choice.id)}
      <option value={choice.id}>{choice.label}</option>
    {/each}
  </select>

  <Textarea
    bind:value={feedback}
    rows={3}
    placeholder="What should change? Leave empty for a first pass."
    aria-label="Feedback for the next round"
  />

  <div class="flex items-center gap-2">
    <Button size="sm" disabled={running || stack.nodes.length === 0} onclick={generate}>
      {running ? "Generating…" : feedback.trim() ? "Revise" : "Generate"}
    </Button>
    <Button variant="outline" size="sm" onclick={save}>Save mock</Button>
    <Button variant="ghost" size="sm" onclick={clear}>Clear</Button>
  </div>

  {#if failure}
    <p class="text-caption text-danger-text">{failure}</p>
  {/if}
</div>
