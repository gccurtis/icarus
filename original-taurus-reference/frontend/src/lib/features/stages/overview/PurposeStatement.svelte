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
