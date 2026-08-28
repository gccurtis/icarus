<script lang="ts">
  import Bot from "@lucide/svelte/icons/bot";
  import Sparkles from "@lucide/svelte/icons/sparkles";

  import { Panel, PanelNote, PanelRow, PanelSection } from "$authored-components/panel";
  import { context, usedBy, type Dependent } from "$capabilities/scope";

  /**
   * What depends on this Context.
   *
   * `docs/screen-panel-views/context/scope/used-by.md` is the specification.
   * Everything in it is a reason not to change the scope carelessly, and it is
   * why Delete is disabled rather than absent.
   *
   * **Two sections rather than one list**, because the two consequences differ:
   * a persona reads this Context every time it looks something up, and a prompt
   * block reads it the next time it runs.
   *
   * **No row is a target.** The door answers with the names of consumers and not
   * with their ids, so a row here says what depends on this Context without
   * pretending to be a way into it.
   */
  let { contextId = "cx-drafts" }: { contextId?: string } = $props();

  const scope = $derived(context(contextId).current);
  const dependents = $derived(usedBy(contextId).current);

  const personas = $derived(
    dependents.filter((dependent: Dependent) => dependent.group === "Personas")
  );
  const blocks = $derived(
    dependents.filter((dependent: Dependent) => dependent.group === "Prompt blocks")
  );
</script>

<Panel title="Used by">
  <PanelSection title="Personas" count={personas.length} flush>
    {#each personas as persona (persona.id)}
      <PanelRow title={persona.name} sub={persona.detail} icon={Bot} tone="intelligence" />
    {/each}

    <PanelNote>
      An agent whose "what it can look up" is this Context reaches the
      {scope.contains} resources it resolves to, and nothing else.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Prompt blocks" count={blocks.length} flush>
    {#each blocks as block (block.id)}
      <PanelRow title={block.name} sub={block.detail} icon={Sparkles} tone="intelligence" />
    {/each}

    <PanelNote>
      Each of these produces something different the next time it runs if the
      rule changes.
    </PanelNote>
  </PanelSection>

  <PanelNote tone="gap">
    Only consumers that can be queried truthfully are listed. There is no
    universal reverse index of everything using a Context, so this list is
    incomplete by construction — which is why Delete stays gated:
    {scope.deleteBlocked}
  </PanelNote>
</Panel>
