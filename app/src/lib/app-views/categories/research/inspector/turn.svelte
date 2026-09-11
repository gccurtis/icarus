<script lang="ts">
  import FileText from "@lucide/svelte/icons/file-text";
  import Lightbulb from "@lucide/svelte/icons/lightbulb";
  import Presentation from "@lucide/svelte/icons/presentation";
  import Table from "@lucide/svelte/icons/table";

  import {
    Panel,
    PanelEmpty,
    PanelRow,
    PanelSection,
    PanelSkeleton
  } from "$authored-components/panel";
  import {
    chosenThread,
    currentTurn,
    threadDetail,
    threadList,
    turnById
  } from "$app-views/categories/research/procedures/chat";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const list = threadList();
  const threads = $derived(list.ready ? list.current.threads : []);
  const threadId = $derived(chosenThread(view, threads));
  const detail = $derived(threadDetail(threadId));
  const answer = $derived(detail !== undefined && detail.ready ? detail.current : undefined);
  const turns = $derived(answer?.turns ?? []);
  const chosen = $derived(
    view.selection?.kind === "turn" ? turnById(turns, view.selection.id) : undefined
  );
  const turn = $derived(chosen ?? currentTurn(turns));

  const ICON = {
    document: FileText,
    presentation: Presentation,
    spreadsheet: Table
  } as const;

  const iconOf = (kind: string) => ICON[kind as keyof typeof ICON] ?? FileText;
</script>

<Panel title="This turn">
  {#if detail !== undefined && !detail.ready}
    <PanelSkeleton shape="rows" count={4} />
  {:else if turn === undefined}
    <PanelEmpty title="Nothing asked yet." />
  {:else}
    <PanelSection title="Findings" count={turn.findings.length} flush>
      {#each turn.findings as finding (finding.id)}
        <PanelRow title={finding.text} icon={Lightbulb} tone="intelligence" />
      {:else}
        <PanelEmpty
          title={turn.state === "answered"
            ? "The answer made no separable claim."
            : "Nothing to stand behind yet."}
          flush
        />
      {/each}
    </PanelSection>

    <PanelSection title="Sources" count={turn.sources.length} flush>
      {#each turn.sources as source (source.id)}
        <PanelRow
          title={source.title}
          sub={source.uses[0] ?? source.excerpt}
          meta={source.ref.kind}
          icon={iconOf(source.ref.kind)}
        />
      {:else}
        <PanelEmpty title="Nothing was cited." flush />
      {/each}
    </PanelSection>
  {/if}
</Panel>
