<script lang="ts">
  import { PanelButton, PanelQuote, PanelSection } from "$authored-components/panel";
  import { Textarea } from "$vendored-components/textarea";
  import { gridOf, labelOf } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
  import { cellAt } from "$app-views/categories/spreadsheet-editor/procedures/cells";
  import {
    addsAComment,
    ago,
    nameOf,
    remarksOf,
    textOf,
    threadsOf,
    threadsOnCell
  } from "$app-views/categories/spreadsheet-editor/procedures/comments";
  import { paintOf } from "$app-views/categories/spreadsheet-editor/procedures/formatting";
  import { selectedRef } from "$app-views/categories/spreadsheet-editor/procedures/selection-reading";
  import {
    projectIdOf,
    rowsOf,
    tableQuery,
    viewerId
  } from "$app-views/categories/spreadsheet-editor/procedures/store";
  import { displayOf } from "$app-views/categories/spreadsheet-editor/procedures/values";
  import { holdsTheRuntime } from "$app-views/categories/spreadsheet-editor/procedures/effects/holds-the-runtime.svelte";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();

  const sheetId = $derived(view.active.resourceId);

  const attached = holdsTheRuntime();
  const runtime = $derived(attached.current);

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

  const comment = () => {
    const text = composing.trim();
    if (text === "" || sheetId === undefined || ref === undefined) return;
    void addsAComment({
      projectId: project,
      sheetId,
      ref,
      quote: shows,
      viewerId: viewer,
      text,
      queries: [threadRows, remarkRows],
      sent: () => {
        composing = "";
      }
    });
  };
</script>

{#if sheet && ref}
  <PanelSection title="Comments" count={threads.length} open={threads.length > 0}>
    <div class="composer">
      <Textarea placeholder="Comment on {label}…" bind:value={composing} class="text-body-sm field-sizing-content min-h-16 resize-none" />
      <div class="flex">
        <PanelButton label="Add comment" tone="primary" disabled={composing.trim().length === 0} onclick={comment} />
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
