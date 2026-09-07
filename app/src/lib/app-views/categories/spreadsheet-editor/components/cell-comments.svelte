<script lang="ts">
  import { create } from "$capabilities/store/index.remote";
  import { PanelButton, PanelQuote, PanelSection } from "$authored-components/panel";
  import { Textarea } from "$vendored-components/textarea";
  import { gridOf, labelOf } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
  import { cellAt } from "$app-views/categories/spreadsheet-editor/procedures/cells";
  import {
    ago,
    nameOf,
    remarkBlock,
    remarksOf,
    textOf,
    threadsOf,
    threadsOnCell
  } from "$app-views/categories/spreadsheet-editor/procedures/comments";
  import { paintOf } from "$app-views/categories/spreadsheet-editor/procedures/formatting";
  import { selectedRef } from "$app-views/categories/spreadsheet-editor/procedures/selecting";
  import {
    projectIdOf,
    refreshAll,
    rowsOf,
    tableQuery,
    viewerId
  } from "$app-views/categories/spreadsheet-editor/procedures/store";
  import { displayOf } from "$app-views/categories/spreadsheet-editor/procedures/values";
  import { workspaceState, type SpreadsheetRuntime } from "$model/client/workspace-state";

  const view = workspaceState();

  const sheetId = $derived(view.active.resourceId);

  let runtime = $state<SpreadsheetRuntime | undefined>(undefined);

  $effect(() => {
    runtime = sheetId === undefined ? undefined : view.spreadsheetRuntime(sheetId);
  });

  const sheet = $derived(runtime?.sheet);
  const grid = $derived(gridOf(sheet?.body));
  const ref = $derived(selectedRef(view.selection));
  const held = $derived(sheet === undefined || ref === undefined ? undefined : cellAt(sheet, ref));
  const label = $derived(ref === undefined ? "?" : labelOf(grid, ref));
  const shows = $derived.by(() => {
    if (sheet === undefined || ref === undefined) return "";
    const text = displayOf(held?.value, paintOf(sheet.body, grid, ref, held).format.valueFormat);
    return text === "" ? (held?.expression ?? "") : text;
  });

  const threadRows = tableQuery("commentThreads");
  const remarkRows = tableQuery("comments");
  const userRows = tableQuery("users");
  const users = $derived(rowsOf(userRows, "users"));
  const threads = $derived(
    sheetId === undefined || ref === undefined ? [] : threadsOnCell(threadsOf(rowsOf(threadRows, "commentThreads"), sheetId), ref)
  );
  const remarks = $derived(rowsOf(remarkRows, "comments"));
  const project = $derived(projectIdOf(sheetId));
  const viewer = $derived(viewerId());

  let composing = $state("");

  const comment = async () => {
    const text = composing.trim();
    if (text === "" || sheetId === undefined || ref === undefined) return;
    const author = { kind: "user" as const, userId: viewer };
    const now = Date.now();
    const made = await create({
      table: "commentThreads",
      fields: {
        projectId: project,
        target: { kind: "spreadsheet", id: sheetId },
        within: { kind: "cell", rowId: ref.rowId, columnId: ref.columnId },
        quote: shows,
        createdBy: author,
        updatedAt: now
      }
    });
    await create({
      table: "comments",
      fields: { projectId: project, threadId: made.id, blocks: [remarkBlock(text)], mentions: [], author }
    });
    composing = "";
    await refreshAll(threadRows, remarkRows);
  };
</script>

{#if sheet && ref}
  <PanelSection title="Comments" count={threads.length} open={threads.length > 0}>
    <div class="composer">
      <Textarea placeholder="Comment on {label}…" bind:value={composing} class="text-body-sm field-sizing-content min-h-16 resize-none" />
      <div class="flex">
        <PanelButton label="Add comment" tone="primary" disabled={composing.trim().length === 0} onclick={() => void comment()} />
      </div>
    </div>
    {#each threads as thread (thread._id)}
      {@const [first] = remarksOf(remarks, thread._id)}
      <PanelQuote
        source={nameOf(users, first?.author ?? thread.createdBy)}
        when={ago(thread.updatedAt)}
        onopen={() => view.inspect("general.comment", { kind: "comment", id: thread._id })}
      >
        {first === undefined ? (thread.quote ?? "") : textOf(first)}
      </PanelQuote>
    {/each}
  </PanelSection>
{/if}

<style>
  .composer {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 2);
    padding-bottom: calc(var(--token-spacing-unit) * 1);
  }
</style>
