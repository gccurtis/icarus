# src/lib/features/stages/document/panels/AiTasksPanel.svelte — breakdown

Companion to [AiTasksPanel.svelte](AiTasksPanel.svelte). The document-scoped AI
Tasks rail — now backed by **real** Omega agent tasks (Goal 3.5): it loads the
tasks whose target is the open document and creates real Plan/Action tasks.

## Script — imports + document id

### Import the AI-task client and personas, derive the document id

```svelte
<script lang="ts">
  import { Plus, Sparkles } from '@lucide/svelte';
  import {
    Badge,
    Button,
    IdentityHoverCard,
    Modal,
    Select,
    Textarea,
    toast,
    type Tone
  } from '$lib/components';
  import {
    loadDocumentAiTasks,
    createDocumentAiTask,
    type DocumentAiTask,
    type DocumentAiTaskStatus
  } from '$systems/documents/ai-tasks';
  import { personas, loadPersonas } from '$systems/personas';
  import { getIdentityProfile } from '$data/identity-directory';
  import { documentEditRelative } from '$data/time';
  import { editorSession } from '../editor/session';

  // The panel lives in the document stage; the current document id comes from the
  // editor session store (same source the History/Info panels use).
  const documentId = $derived($editorSession?.docId ?? '');

```

Pulls the AI-task client + personas store (for the run persona) and derives the
open document id from the editor session store.

## Script — state + load

### Local UI state and the per-document task load/poll effects

```svelte
  let filter = $state<'active' | 'all'>('active');
  let tasks = $state<DocumentAiTask[]>([]);
  let loading = $state(true);
  let error = $state('');
  let selected = $state<DocumentAiTask | null>(null);
  let detailOpen = $state(false);
  let createOpen = $state(false);
  let creating = $state(false);
  let instruction = $state('');
  let scope = $state('whole-document');
  let review = $state('review');

  // Reload whenever the open document changes.
  $effect(() => {
    const id = documentId;
    if (!id) {
      tasks = [];
      loading = false;
      return;
    }
    load(id);
  });

  async function load(id: string) {
    loading = true;
    error = '';
    try {
      tasks = await loadDocumentAiTasks(id);
    } catch (e) {
      error = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Failed to load AI tasks';
    } finally {
      loading = false;
    }
  }

  // Poll while any task is still in flight so its state advances live (no spinner).
  $effect(() => {
    const id = documentId;
    if (!id || !tasks.some((task) => task.active)) return;
    const timer = setInterval(() => void refresh(id), 3000);
    return () => clearInterval(timer);
  });

  async function refresh(id: string) {
    try {
      tasks = await loadDocumentAiTasks(id);
    } catch {
      // Keep the current list on a transient poll failure.
    }
  }

  const visibleTasks = $derived(filter === 'active' ? tasks.filter((task) => task.active) : tasks);

```

Local UI state plus an effect that (re)loads the document's tasks whenever the open
document changes. The `active` filter now keys off the mapped `active` flag
(non-terminal states) instead of a hardcoded status string.

## Script — options, tones, create

### Scope/completion options, status tones, and the create action

```svelte
  const scopeOptions = [
    { value: 'whole-document', label: 'Whole document' },
    { value: 'selection', label: 'Current selection' },
    { value: 'section', label: 'Current section' }
  ];

  // "Require review" → a Plan (a draft to accept); "Apply when complete" → an
  // Action (edits land directly via the document.append_changes tool).
  const reviewOptions = [
    { value: 'review', label: 'Require review (plan)' },
    { value: 'apply', label: 'Apply when complete (action)' }
  ];

  const statusTone: Record<DocumentAiTaskStatus, Tone> = {
    Queued: 'neutral',
    Running: 'focus',
    'Needs review': 'attention',
    Completed: 'success',
    Partial: 'attention',
    Failed: 'danger',
    Canceled: 'neutral'
  };

  function showTask(task: DocumentAiTask) {
    selected = task;
    detailOpen = true;
  }

  async function createTask() {
    const objective = instruction.trim();
    if (!objective || !documentId) return;
    // Resolve a persona to run under — the project default.
    if ($personas.status === 'idle') await loadPersonas();
    const personaId = $personas.defaultId ?? $personas.personas[0]?.id;
    if (!personaId) {
      toast('No persona available to run this task.', { tone: 'danger' });
      return;
    }
    creating = true;
    try {
      await createDocumentAiTask({
        documentId,
        objective,
        personaId,
        mode: review === 'apply' ? 'action' : 'plan',
        scopeLabel: scopeOptions.find((option) => option.value === scope)?.label
      });
      instruction = '';
      createOpen = false;
      toast('AI task created.', { tone: 'success' });
      await load(documentId);
    } catch (e) {
      const message = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Could not create the task';
      toast(message, { tone: 'danger' });
    } finally {
      creating = false;
    }
  }
</script>

```

The completion select maps to Omega's two task modes (Plan vs Action). `createTask`
resolves the project default persona (loading personas on demand), posts a real
task scoped to this document, then reloads. Every status maps to a semantic tone.

## Markup — list with loading / error / empty states

### New-task button, active/all filter, and the task list states

```svelte
<div class="space-y-3">
  <p class="text-caption text-muted">Document AI work</p>

  <Button variant="secondary" size="sm" class="w-full" onclick={() => (createOpen = true)}>
    <Plus class="size-4" />
    New AI task
  </Button>

  <div class="grid grid-cols-2 rounded-control bg-panel p-0.5">
    <button
      type="button"
      class={`rounded-control px-2 py-1.5 text-caption ${filter === 'active' ? 'bg-work font-medium text-primary shadow-panel' : 'text-muted'}`}
      onclick={() => (filter = 'active')}
    >
      Active
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
    <p class="text-body-sm text-muted">Loading AI tasks…</p>
  {:else if error}
    <p class="text-body-sm text-danger">Couldn’t load AI tasks — {error}</p>
  {:else if visibleTasks.length === 0}
    <p class="text-body-sm text-muted">
      {filter === 'active' ? 'No active AI tasks.' : 'No AI tasks for this document yet.'}
    </p>
  {:else}
    <ol class="space-y-1.5">
      {#each visibleTasks as task (task.id)}
        {@const actorProfile = getIdentityProfile(task.actor)}
        <li
          class="dur-micro rounded-control border border-border bg-work transition-colors hover:border-border-strong hover:bg-panel"
        >
          <button
            type="button"
            class="w-full px-2.5 pt-2.5 pb-1.5 text-left"
            onclick={() => showTask(task)}
            aria-label={`Open AI task: ${task.title}`}
          >
            <span class="flex items-start justify-between gap-2">
              <span class="min-w-0 flex-1">
                <span class="block text-body-sm font-medium text-primary">{task.title}</span>
                <span class="mt-0.5 block truncate text-caption text-secondary">{task.scope}</span>
              </span>
              <Badge tone={statusTone[task.status]}>{task.status}</Badge>
            </span>
          </button>
          <div class="flex items-center gap-1 px-2 pb-2 text-caption text-muted">
            <IdentityHoverCard profile={actorProfile} showName portalled class="min-w-0 flex-1" />
            <span aria-hidden="true">·</span>
            <span class="shrink-0">{documentEditRelative(Date.parse(task.updatedAt))}</span>
          </div>
        </li>
      {/each}
    </ol>
  {/if}
</div>

```

The list renders loading / error / empty / populated states. The Mock badge is
gone; each row shows the task's objective, mode, real status badge, persona actor,
and a relative time from the task's `updatedAt`.

## Markup — create modal

### The create-task modal (objective, scope, completion)

```svelte
<Modal bind:open={createOpen} title="New AI task" size="sm">
  <div class="space-y-3">
    <p class="text-body-sm text-muted">
      Describe a bounded piece of document work, its scope, and how the result should be reviewed.
    </p>
    <label class="block">
      <span class="mb-1 block text-caption text-muted">Task</span>
      <Textarea
        bind:value={instruction}
        rows={4}
        aria-label="AI task instruction"
        placeholder="Verify every claim against its cited source…"
      />
    </label>
    <label class="block">
      <span class="mb-1 block text-caption text-muted">Scope</span>
      <Select bind:value={scope} options={scopeOptions} />
    </label>
    <label class="block">
      <span class="mb-1 block text-caption text-muted">Completion</span>
      <Select bind:value={review} options={reviewOptions} />
    </label>
  </div>
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (createOpen = false)}>Cancel</Button>
    <Button disabled={!instruction.trim() || creating} onclick={createTask}>
      <Sparkles class="size-4" />
      {creating ? 'Creating…' : 'Create task'}
    </Button>
  {/snippet}
</Modal>

```

The create modal (no longer "· Mock") gathers the objective, a scope hint (attached
as a context item), and the completion policy (plan vs action). The submit button
disables and shows "Creating…" during the request.

## Markup — detail modal

### The read-only task detail modal

```svelte
<Modal bind:open={detailOpen} title="AI task" size="sm">
  {#if selected}
    {@const selectedActor = getIdentityProfile(selected.actor)}
    <div class="space-y-3">
      <div class="flex items-start justify-between gap-2">
        <div>
          <p class="text-body-sm font-medium text-primary">{selected.title}</p>
          <p class="mt-0.5 text-caption text-muted">{selected.scope}</p>
        </div>
        <Badge tone={statusTone[selected.status]}>{selected.status}</Badge>
      </div>
      <p class="text-body-sm leading-relaxed text-secondary">{selected.detail}</p>
      <div class="flex items-center gap-2 border-t border-border pt-3">
        <IdentityHoverCard profile={selectedActor} size="sm" showName portalled />
        <p class="text-caption text-muted">{documentEditRelative(Date.parse(selected.updatedAt))}</p>
      </div>
    </div>
  {/if}
  {#snippet footer()}
    <Button variant="secondary" onclick={() => (detailOpen = false)}>Close</Button>
  {/snippet}
</Modal>
```

The detail modal (also de-mocked) shows the selected task's title, mode, status,
the composed detail line (run failure / plan summary / fallback), persona, and time.
