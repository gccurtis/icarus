<script lang="ts">
  import { FunctionSquare, Search, Trash2, Pencil, Check, X } from '@lucide/svelte';
  import { Badge, Button, IconButton, Input, Modal, toast } from '$lib/components';
  import {
    fetchProjectNames,
    setNameFunction,
    setNameValue,
    deleteProjectName,
    evaluateExpression,
    type NamesEntry
  } from '$data/projects';
  import { workspace } from '$data/workspace';

  const projectId = $derived($workspace?.projectId ?? '');

  let filter = $state('');
  let creatorOpen = $state(false);
  let mode = $state<'formula' | 'value'>('formula');
  let formula = $state('');
  let literal = $state('');
  let assignedName = $state('');
  let editingName = $state<string | null>(null);
  let entries = $state<NamesEntry[]>([]);
  let loading = $state(true);
  let evaluating = $state(false);
  let evalResult = $state('');
  let evalError = $state('');
  let pendingDelete = $state<string | null>(null);
  let saving = $state(false);

  async function load() {
    if (!projectId) return;
    loading = true;
    try {
      entries = await fetchProjectNames(projectId);
    } catch {
      entries = [];
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (projectId) void load();
  });

  const names = $derived(
    entries.filter((entry) =>
      `${entry.name} ${entry.type} ${displayValue(entry)}`.toLowerCase().includes(filter.toLowerCase())
    )
  );

  const modeOptions = [
    { value: 'formula', label: 'Formula' },
    { value: 'value', label: 'Value' }
  ];

  function displayValue(entry: NamesEntry): string {
    if (entry.type === 'function') return entry.source ?? '';
    if (entry.type === 'table') return 'table';
    if (entry.value == null) return '—';
    return String(entry.value);
  }

  function typeLabel(type: NamesEntry['type']): string {
    const labels: Record<string, string> = { number: 'Number', text: 'Text', logic: 'Logic', table: 'Table', function: 'Function', null: 'Null' };
    return labels[type] ?? type;
  }

  // Parse a value-mode literal into the JSON the backend stores: boolean, number, or text.
  function parseLiteral(raw: string): unknown {
    const s = raw.trim();
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (s !== '' && Number.isFinite(Number(s))) return Number(s);
    return raw;
  }

  function openCreate() {
    mode = 'formula';
    formula = '';
    literal = '';
    assignedName = '';
    editingName = null;
    evalResult = '';
    evalError = '';
    creatorOpen = true;
  }

  // Edit an existing name: functions reopen in formula mode with their source; other
  // entries reopen in value mode. The name is fixed (Omega has no rename — it's an upsert).
  function openEdit(entry: NamesEntry) {
    editingName = entry.name;
    assignedName = entry.name;
    evalResult = '';
    evalError = '';
    if (entry.type === 'function') {
      mode = 'formula';
      formula = entry.source ?? '';
      literal = '';
      void handleEvaluate();
    } else {
      mode = 'value';
      literal = entry.value == null ? '' : String(entry.value);
      formula = '';
    }
    creatorOpen = true;
  }

  async function saveCreator() {
    const name = assignedName.trim();
    saving = true;
    try {
      if (mode === 'formula') {
        if (!formula.trim()) return;
        const result = await evaluateExpression(projectId, formula);
        evalResult = `${result.value} (${result.type})`;
        evalError = '';
        if (name) {
          await setNameFunction(projectId, name, formula);
          toast(`${editingName ? 'Updated' : 'Created'} formula “${name}”.`, { tone: 'success' });
          void load();
        } else {
          toast('Expression evaluated successfully.', { tone: 'success' });
        }
        creatorOpen = false;
      } else {
        if (!name) return;
        await setNameValue(projectId, name, parseLiteral(literal));
        toast(`${editingName ? 'Updated' : 'Created'} “${name}”.`, { tone: 'success' });
        void load();
        creatorOpen = false;
      }
    } catch (e) {
      const msg = typeof e === 'object' && e !== null && 'message' in e ? String((e as { message: string }).message) : 'Save failed.';
      evalError = msg;
      if (mode === 'value') toast(msg, { tone: 'danger' });
    } finally {
      saving = false;
    }
  }

  async function confirmRemove(name: string) {
    try {
      await deleteProjectName(projectId, name);
      pendingDelete = null;
      toast(`Deleted “${name}”.`, { tone: 'success' });
      void load();
    } catch (e) {
      const msg = typeof e === 'object' && e !== null && 'message' in e ? String((e as { message: string }).message) : 'Delete failed.';
      toast(msg, { tone: 'danger' });
    }
  }

  async function handleEvaluate() {
    if (!formula.trim()) return;
    evaluating = true;
    evalError = '';
    try {
      const result = await evaluateExpression(projectId, formula);
      evalResult = `${result.value} (${result.type})`;
    } catch (e) {
      const msg = typeof e === 'object' && e !== null && 'message' in e ? String((e as { message: string }).message) : 'Evaluation failed.';
      evalError = msg;
      evalResult = '';
    } finally {
      evaluating = false;
    }
  }

  const saveDisabled = $derived(
    saving || (mode === 'formula' ? !formula.trim() : !assignedName.trim())
  );
</script>

<div class="space-y-3">
  <div class="flex items-center justify-between">
    <p class="text-caption text-muted">Named values and formulas</p>
  </div>

  <Button variant="secondary" size="sm" class="w-full" onclick={openCreate}>
    <FunctionSquare class="size-4" />
    New name
  </Button>

  <label class="relative block">
    <Search class="pointer-events-none absolute top-2 left-2.5 size-3.5 text-muted" />
    <Input
      bind:value={filter}
      size="sm"
      class="pl-8"
      placeholder="Search names…"
      aria-label="Search document names"
    />
  </label>

  <section class="border-t border-border pt-3">
    <div class="mb-2 grid grid-cols-[1fr_auto] gap-2 px-2 text-caption font-medium text-muted">
      <span>Name / value preview</span>
      <span>Type</span>
    </div>
    {#if loading}
      <p class="text-caption text-muted">Loading names…</p>
    {:else if names.length === 0}
      <p class="text-body-sm text-muted">{filter ? 'No matching names.' : 'No named values in this project yet.'}</p>
    {:else}
      <ul class="divide-y divide-border overflow-hidden rounded-panel border border-border bg-work">
        {#each names as entry (entry.name)}
          <li class="group px-2.5 py-2.5" title={`Value: ${displayValue(entry)}`}>
            <div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <span class="truncate font-mono text-label font-medium text-primary">{entry.name}</span>
              {#if pendingDelete === entry.name}
                <span class="flex items-center gap-1">
                  <span class="text-caption text-danger">Delete?</span>
                  <IconButton label="Confirm delete" size="sm" onclick={() => confirmRemove(entry.name)}>
                    <Check class="size-3.5 text-danger" />
                  </IconButton>
                  <IconButton label="Cancel delete" size="sm" onclick={() => (pendingDelete = null)}>
                    <X class="size-3.5" />
                  </IconButton>
                </span>
              {:else}
                <span class="flex items-center gap-1">
                  <span class="hidden items-center gap-1 group-hover:flex">
                    <IconButton label={`Edit ${entry.name}`} size="sm" onclick={() => openEdit(entry)}>
                      <Pencil class="size-3.5" />
                    </IconButton>
                    <IconButton label={`Delete ${entry.name}`} size="sm" onclick={() => (pendingDelete = entry.name)}>
                      <Trash2 class="size-3.5" />
                    </IconButton>
                  </span>
                  <Badge tone="neutral">{typeLabel(entry.type)}</Badge>
                </span>
              {/if}
            </div>
            <p class="mt-1 truncate text-caption text-muted">{displayValue(entry)}</p>
            {#if entry.source}
              <p class="mt-1 hidden truncate font-mono text-caption text-secondary group-hover:block">
                {entry.source}
              </p>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>

<Modal bind:open={creatorOpen} title={editingName ? `Edit “${editingName}”` : 'New name'} size="sm">
  <div class="space-y-3">
    <div class="inline-flex rounded-control border border-border bg-panel p-1">
      {#each modeOptions as opt (opt.value)}
        <button
          type="button"
          disabled={!!editingName}
          onclick={() => (mode = opt.value as 'formula' | 'value')}
          class={'dur-small rounded-[5px] px-3 py-1 text-label font-medium transition-colors disabled:opacity-50 ' +
            (mode === opt.value ? 'bg-work text-primary shadow-panel' : 'text-muted hover:text-secondary')}
        >
          {opt.label}
        </button>
      {/each}
    </div>

    {#if mode === 'formula'}
      <p class="text-body-sm text-muted">
        Compose a formula from document names, then optionally assign its result to a name.
      </p>
      <label class="block">
        <span class="mb-1 block text-caption text-muted">Formula</span>
        <Input bind:value={formula} aria-label="Formula" class="font-mono" oninput={handleEvaluate} />
      </label>
    {:else}
      <p class="text-body-sm text-muted">Assign a literal value (number, text, or true/false) to a name.</p>
      <label class="block">
        <span class="mb-1 block text-caption text-muted">Value</span>
        <Input bind:value={literal} aria-label="Value" class="font-mono" placeholder="e.g. 42 or Hello" />
      </label>
    {/if}

    <label class="block">
      <span class="mb-1 block text-caption text-muted">
        Assign to name {#if mode === 'formula'}<span class="text-muted">(optional)</span>{/if}
      </span>
      <Input
        bind:value={assignedName}
        aria-label="Assign result to name"
        placeholder="e.g. distance_parsecs"
        class="font-mono"
        disabled={!!editingName}
      />
    </label>

    {#if mode === 'formula' && entries.length > 0}
      <div class="rounded-control bg-panel p-3">
        <p class="text-caption text-muted">Available names</p>
        <div class="mt-2 flex flex-wrap gap-1.5">
          {#each entries as entry (entry.name)}
            <button
              type="button"
              class="rounded-control border border-border bg-work px-2 py-1 font-mono text-caption text-secondary hover:border-border-strong"
              onclick={() => (formula += entry.name)}
            >
              {entry.name}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    {#if mode === 'formula'}
      <div class="rounded-control border border-border px-3 py-2">
        <p class="text-caption text-muted">Preview</p>
        {#if evaluating}
          <p class="mt-1 font-mono text-body-sm text-muted">Evaluating…</p>
        {:else if evalError}
          <p class="mt-1 font-mono text-body-sm text-danger">{evalError}</p>
        {:else if evalResult}
          <p class="mt-1 font-mono text-body-sm text-primary">{evalResult}</p>
        {:else}
          <p class="mt-1 text-caption text-muted">Enter a formula to see its result.</p>
        {/if}
      </div>
    {/if}
  </div>
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (creatorOpen = false)}>Cancel</Button>
    <Button variant="secondary" disabled={saveDisabled} onclick={saveCreator}>
      {editingName ? 'Save' : 'Create'}
    </Button>
  {/snippet}
</Modal>
