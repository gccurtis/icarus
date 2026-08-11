<script lang="ts">
  import { ChevronDown } from '@lucide/svelte';
  import { Avatar, Badge, Button, Textarea, toast } from '$lib/components';
  import { isApiError } from '$data/api';
  import {
    loadComments,
    createComment,
    replyToComment,
    patchComment,
    type DocumentComment
  } from '$data/documents';
  import { documentEditRelative } from '$data/time';
  import { editorSession } from '../editor/session';

  const documentId = $derived($editorSession?.docId ?? '');

  let filter = $state<'open' | 'all'>('open');
  let comments = $state<DocumentComment[]>([]);
  let loading = $state(true);
  let error = $state('');
  let expanded = $state<string | null>(null);
  let draft = $state('');
  let replyDraft = $state('');
  let busy = $state(false);

  // The block a new comment anchors to — the first block of the current selection.
  const anchorTarget = $derived.by(() => {
    const sel = $editorSession?.selection;
    if (!sel) return null;
    if (sel.mode === 'block' || sel.mode === 'new-block' || sel.mode === 'new-text')
      return { blockId: sel.block.blockId ?? undefined, rowId: sel.block.rowId ?? undefined };
    if (sel.mode === 'run' && sel.blockIds[0]) return { blockId: sel.blockIds[0] };
    if ((sel.mode === 'blocks' || sel.mode === 'row') && sel.items[0])
      return { blockId: sel.items[0].blockId ?? undefined, rowId: sel.items[0].rowId ?? undefined };
    return null;
  });
  const canComment = $derived(!!anchorTarget?.blockId);

  const visible = $derived(
    filter === 'open' ? comments.filter((comment) => !comment.resolved) : comments
  );

  $effect(() => {
    const id = documentId;
    if (!id) {
      comments = [];
      loading = false;
      return;
    }
    void load(id);
  });

  async function load(id: string) {
    loading = true;
    error = '';
    try {
      comments = await loadComments(id);
    } catch (e) {
      error = isApiError(e) ? e.message : 'Failed to load comments';
    } finally {
      loading = false;
    }
  }

  async function addComment() {
    const body = draft.trim();
    if (!body || !documentId || !anchorTarget?.blockId || busy) return;
    busy = true;
    try {
      await createComment(documentId, body, anchorTarget);
      draft = '';
      await load(documentId);
    } catch (e) {
      toast(isApiError(e) ? e.message : 'Could not add the comment', { tone: 'danger' });
    } finally {
      busy = false;
    }
  }

  async function sendReply(commentId: string) {
    const body = replyDraft.trim();
    if (!body || busy) return;
    busy = true;
    try {
      await replyToComment(commentId, body);
      replyDraft = '';
      await load(documentId);
    } catch (e) {
      toast(isApiError(e) ? e.message : 'Could not reply', { tone: 'danger' });
    } finally {
      busy = false;
    }
  }

  async function toggleResolved(comment: DocumentComment) {
    if (busy) return;
    busy = true;
    try {
      await patchComment(comment.id, { resolved: !comment.resolved });
      await load(documentId);
    } catch (e) {
      toast(isApiError(e) ? e.message : 'Could not update the comment', { tone: 'danger' });
    } finally {
      busy = false;
    }
  }
</script>

<div class="space-y-3">
  <p class="text-caption text-muted">Anchored discussion</p>

  <div class="space-y-1.5">
    <Textarea
      bind:value={draft}
      rows={2}
      aria-label="New comment"
      placeholder={canComment ? 'Comment on the selected block…' : 'Select a block to comment on it…'}
      disabled={!canComment || busy}
    />
    <Button
      size="sm"
      variant="secondary"
      class="w-full"
      disabled={!canComment || !draft.trim() || busy}
      onclick={addComment}
    >
      Add comment
    </Button>
  </div>

  <div class="grid grid-cols-2 rounded-control bg-panel p-0.5">
    <button
      type="button"
      class={`rounded-control px-2 py-1.5 text-caption ${filter === 'open' ? 'bg-work font-medium text-primary shadow-panel' : 'text-muted'}`}
      onclick={() => (filter = 'open')}
    >
      Open
    </button>
    <button
      type="button"
      class={`rounded-control px-2 py-1.5 text-caption ${filter === 'all' ? 'bg-work font-medium text-primary shadow-panel' : 'text-muted'}`}
      onclick={() => (filter = 'all')}
    >
      All
    </button>
  </div>

  {#if loading}
    <p class="text-body-sm text-muted">Loading comments…</p>
  {:else if error}
    <p class="text-body-sm text-danger">Couldn’t load comments — {error}</p>
  {:else if visible.length === 0}
    <p class="text-body-sm text-muted">{filter === 'open' ? 'No open comments.' : 'No comments yet.'}</p>
  {:else}
    <ol class="space-y-2">
      {#each visible as comment (comment.id)}
        {@const open = expanded === comment.id}
        <li class="overflow-hidden rounded-panel border border-border bg-work">
          <button
            type="button"
            class="w-full px-3 py-2.5 text-left hover:bg-panel/60"
            aria-expanded={open}
            onclick={() => (expanded = open ? null : comment.id)}
          >
            <span class="flex items-start gap-2">
              <Avatar name={comment.authorName} size="xs" />
              <span class="min-w-0 flex-1">
                <span class="flex items-center justify-between gap-2">
                  <span class="truncate text-label font-medium text-primary">{comment.authorName}</span>
                  <ChevronDown
                    class={`size-3.5 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
                  />
                </span>
                <span class="block text-caption text-muted">
                  {documentEditRelative(Date.parse(comment.createdAt))}
                  {#if comment.replies.length}· {comment.replies.length} repl{comment.replies.length === 1 ? 'y' : 'ies'}{/if}
                </span>
                {#if !open}
                  <span class="mt-1.5 line-clamp-2 block text-body-sm text-secondary">{comment.body}</span>
                {/if}
              </span>
            </span>
          </button>

          {#if open}
            <div class="space-y-2.5 border-t border-border px-3 py-3">
              <p class="text-body-sm leading-relaxed text-secondary">{comment.body}</p>
              {#if comment.anchorOrphaned}
                <p class="text-caption text-attention">The anchored text was removed.</p>
              {/if}
              {#each comment.replies as reply (reply.id)}
                <div class="border-l-2 border-border pl-2.5">
                  <p class="text-caption font-medium text-primary">{reply.authorName}</p>
                  <p class="text-body-sm text-secondary">{reply.body}</p>
                </div>
              {/each}
              <div class="flex items-center gap-1.5">
                <Textarea
                  bind:value={replyDraft}
                  rows={1}
                  aria-label="Reply"
                  placeholder="Reply…"
                  disabled={busy}
                />
                <Button size="sm" variant="ghost" disabled={!replyDraft.trim() || busy} onclick={() => sendReply(comment.id)}>
                  Reply
                </Button>
              </div>
              <div class="flex items-center justify-between gap-2">
                <Badge tone={comment.resolved ? 'success' : 'attention'}>
                  {comment.resolved ? 'Resolved' : 'Open'}
                </Badge>
                <Button variant="ghost" size="sm" class="h-7 px-2 text-caption" disabled={busy} onclick={() => toggleResolved(comment)}>
                  {comment.resolved ? 'Reopen' : 'Resolve'}
                </Button>
              </div>
            </div>
          {/if}
        </li>
      {/each}
    </ol>
  {/if}
</div>
