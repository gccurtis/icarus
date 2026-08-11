# src/lib/features/stages/overview/PurposeStatement.svelte — breakdown

Companion to [PurposeStatement.svelte](PurposeStatement.svelte). The **purpose
statement** under the project name on the Overview stage: a full-width, left-aligned,
editable card fixed at ~two lines (extra text scrolls inside). It reads purpose from the
persisted Project row and auto-saves edits through the shared project data boundary when
the field loses focus. Owners and editors can edit in place; viewers see the same
statement read-only.

## Script

### Props, Project state, and saving

```svelte
<script lang="ts">
  import { isApiError } from '$data/api';
  import { projects, updateProject } from '$data/projects';
  import { toast } from '$lib/components';

  let { projectId }: { projectId: string } = $props();

  const project = $derived($projects.find((p) => p.id === projectId) ?? null);
  const canEdit = $derived(project?.role === 'owner' || project?.role === 'editor');

  // Null means the field is displaying the canonical Project value. Once the user
  // types, draft is the single local value until a successful save clears it.
  let draft = $state<string | null>(null);
  let saving = $state(false);
  const text = $derived(draft ?? project?.purpose ?? '');

  // A project switch must never carry an unfinished purpose into the next project.
  $effect(() => {
    projectId;
    draft = null;
  });

  function edit(event: Event) {
    draft = (event.currentTarget as HTMLTextAreaElement).value;
  }

  async function commit() {
    const current = project;
    const next = draft;
    if (!current || !canEdit || saving || next === null) return;
    const purpose = next.trim();
    if (purpose === current.purpose) {
      draft = null;
      return;
    }
    saving = true;
    try {
      await updateProject(current.id, { purpose });
      if (draft === next) draft = null;
    } catch (e) {
      toast(isApiError(e) ? e.message : 'Could not save project purpose', { tone: 'danger' });
    } finally {
      saving = false;
    }
  }
</script>

```

The component looks up the current Project from the shared store and derives write access
from the role Omega returned. `text` resolves to the canonical persisted purpose until
the user types, at which point one explicit draft becomes the sole displayed value; a
project switch or successful commit clears that draft. `commit` runs when the field
loses focus, trims the text, clears no-op drafts, and sends changed text through the
existing `PATCH /projects/:id` boundary. A failed auto-save retains the draft and reports
the Omega error with a toast.

## Markup

### The full-width in-place editor and read-only state

```svelte
<!--
  Full-width purpose card (matches the resource table's width). Fixed at ~two lines; more
  text scrolls inside. Owners and editors auto-save to Omega on blur; viewers can read it.
-->
<div class="w-full">
  <div class="rounded-panel border border-border bg-panel/40 px-4 py-2.5 text-left">
    <textarea
      value={text}
      oninput={edit}
      onblur={() => void commit()}
      rows="2"
      maxlength="1000"
      readonly={!canEdit}
      placeholder="Add a short purpose for this project…"
      aria-label="Project purpose"
      class="w-full resize-none overflow-y-auto bg-transparent text-body text-secondary outline-none placeholder:text-muted read-only:cursor-default"
    ></textarea>
  </div>
  {#if !canEdit}
    <p class="mt-1 text-caption text-muted">You have view-only access to this project.</p>
  {/if}
</div>
```

A `w-full` card (spanning the same width as the create/activity band and the resource
table) with a subtle fill + border. The `rows="2"` textarea is fixed at two lines and
`overflow-y-auto`, so more text scrolls within the box and the stage never shifts. It is
bounded at Omega's 1,000-character limit. Its value comes from exactly one source at a
time: canonical Project data or the user's draft. Writers edit directly in the field;
blur commits changed text without a separate Save control. The empty-state placeholder
is the only purpose-writing prompt. Viewers see the same text but cannot alter it.
