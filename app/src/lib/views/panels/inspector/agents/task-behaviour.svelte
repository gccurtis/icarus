<script lang="ts">
  import {
    Panel,
    PanelCrumbs,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$authored-components/panel";
  import { task as taskDoor, type TaskSetting } from "$capabilities/agents";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * One line of a task's configuration: what it was told, rather than what it did.
   *
   * **Editable while it runs, and that is the point.** A setting you can only
   * read is a log entry; the reason to open this from a running task is to change
   * what it is allowed to do next. What it was *originally* told stays visible
   * beside the draft, because a task judged against a rule that was changed
   * halfway is a task nobody can judge.
   */
  let { taskId, settingId }: { taskId?: string; settingId?: string } = $props();

  const task = $derived(taskDoor(taskId ?? view.active.focus ?? "t-feeder12").current);

  const id = $derived(settingId ?? view.selection?.id);

  const setting = $derived(
    task.settings.find((entry: TaskSetting) => entry.id === id) ?? task.settings[0]
  );

  /** Undefined until touched, so an untouched value still reads from the door. */
  let draft = $state<string>();
  const changed = $derived(draft !== undefined && draft !== setting.value);
</script>

<Panel title={setting.name}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: task.title, key: "agents.task" }, { label: "How it was configured" }]}
      onnavigate={(key: string) => {
        if (isInspectionKey(key)) view.inspect(key, { kind: "task", id: task.id });
      }}
    />
  {/snippet}

  <PanelSection title="Value">
    <PanelEditableText
      value={draft ?? setting.value}
      label={setting.name}
      multiline
      onchange={(next: string) => (draft = next)}
    />
  </PanelSection>

  {#if changed}
    <PanelSection title="It was told">
      <p class="text-body-sm text-ink-muted m-0">{setting.value}</p>
    </PanelSection>
  {/if}

  <PanelFields>
    <PanelField label="Task">{task.title}</PanelField>
    <PanelField label="State">{task.state}</PanelField>
  </PanelFields>

  <PanelSection title="Everything it was told" count={task.settings.length} flush>
    {#each task.settings as entry (entry.id)}
      <PanelRow
        title={entry.name}
        sub={entry.value}
        selected={entry.id === setting.id}
        onselect={() =>
          view.inspect("agents.task-behaviour", { kind: "setting", id: entry.id })}
      />
    {/each}
  </PanelSection>

  <PanelNote tone="gap">
    A change is held here. Nothing writes a task's configuration back yet, so a
    running task carries on under what it was originally told.
  </PanelNote>
</Panel>
