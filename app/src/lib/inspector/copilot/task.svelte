<script lang="ts">
  import Ban from "@lucide/svelte/icons/ban";
  import Bell from "@lucide/svelte/icons/bell";
  import BellOff from "@lucide/svelte/icons/bell-off";
  import Check from "@lucide/svelte/icons/check";
  import Circle from "@lucide/svelte/icons/circle";
  import CircleAlert from "@lucide/svelte/icons/circle-alert";
  import Loader from "@lucide/svelte/icons/loader";
  import Package from "@lucide/svelte/icons/package";
  import Wrench from "@lucide/svelte/icons/wrench";
  import X from "@lucide/svelte/icons/x";

  import {
    Panel,
    PanelActions,
    PanelActor,
    PanelButton,
    PanelChip,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelProgress,
    PanelQuote,
    PanelRow,
    PanelSection
  } from "$lib/unique-components/panel";
  import { Separator } from "$lib/simple-components/separator";
  import { actorName } from "$mock-capabilities/cast";
  import {
    planFor,
    producedBy,
    task,
    toolsUsedIn,
    type Dispatcher,
    type TaskToolCall
  } from "$mock-capabilities/copilot";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * A task — what was asked, who is doing it, the plan, and where it has got to.
   *
   * `docs/screen-panel-views/inspector/copilot/task.md` is the specification. A
   * task is the unit of agent work and its own whole trace, so this is one lens
   * reached from four places: the Copilot, Project Overview, a Persona's Work
   * view, and an Automation's last fire.
   *
   * **`from` is the only thing that varies.** It sets the breadcrumb, and it drops
   * the *Agent* row when the trail already names the persona — reached from a
   * Persona the trail reads *Grid Analyst › Summarise overnight outage reports*
   * and the row would repeat it. There is no second copy of this lens.
   *
   * **The title is not repeated as a field.** It is the panel's heading, directly
   * above the block that would have restated it.
   *
   * **Retry is absent rather than disabled.** Retry semantics are not modelled,
   * and a button that might re-run a partly-completed task is worse than no
   * button.
   */
  let {
    taskId = "t-1",
    from = "copilot",
    oncancel
  }: {
    taskId?: string;
    /** Where this was reached from. Sets the trail, and whether the Agent row is needed. */
    from?: "copilot" | "project" | "persona" | "automation";
    /** Stop the work. Absent where whoever mounted this cannot stop it. */
    oncancel?: () => void;
  } = $props();

  const record = $derived(task(taskId).current);
  const plan = $derived(planFor(taskId).current);
  const tools = $derived(toolsUsedIn(taskId).current);
  const outputs = $derived(producedBy(taskId).current);

  const agent = $derived(actorName(record.agent));

  /** Local, and only local: nothing records who is following a task. */
  let following = $state(false);

  const STATE_WORD = {
    waiting: "Waiting",
    running: "Running",
    failed: "Not working",
    completed: "Done"
  };

  const STATE_TONE = {
    waiting: "attention",
    running: "active",
    failed: "danger",
    completed: "success"
  } as const;

  /**
   * The one phrase the state has beyond its word. Running says nothing here — the
   * step count is the progress bar's, and saying it twice makes two claims to
   * keep in step.
   */
  const line = $derived(
    record.state === "failed"
      ? record.reason
      : record.state === "completed"
        ? record.result
        : undefined
  );

  /** Cancel means something only while there is work left to stop. */
  const live = $derived(record.state === "running" || record.state === "waiting");

  const STEP_WORD = { done: "Done", active: "Active", pending: "Pending" };
  const STEP_ICON = { done: Check, active: Loader, pending: Circle };
  const STEP_TONE = { done: "success", active: "active", pending: "default" } as const;

  const TOOL_ICON = { Success: Wrench, "Nothing found": Ban, Failed: CircleAlert };
  const TOOL_TONE = { Success: "default", "Nothing found": "attention", Failed: "danger" } as const;

  /** A successful call is its result; anything else leads with the outcome, because that is the news. */
  const toolLine = (call: TaskToolCall): string | undefined =>
    call.outcome === "Success"
      ? call.result
      : call.result === undefined
        ? call.outcome
        : `${call.outcome} — ${call.result}`;

  const DISPATCHER_LENS = {
    person: "collaboration.person",
    automation: "automations.automation",
    agent: "agents.persona"
  };

  /** A dispatcher with no id has nowhere to go, and the name is drawn flat. */
  const openDispatcher = (who: Dispatcher): (() => void) | undefined =>
    who.id === undefined
      ? undefined
      : () =>
          mockWorkbench.inspect(DISPATCHER_LENS[who.kind], {
            kind: who.kind,
            id: who.id ?? ""
          });

  const trail = $derived.by(() => {
    switch (from) {
      case "persona":
        return [{ label: agent, key: "persona" }, { label: record.title }];
      case "automation":
        return [{ label: record.startedBy.name, key: "dispatcher" }, { label: record.title }];
      case "project":
        return [{ label: mockWorkbench.project.name, key: "project" }, { label: record.title }];
      default:
        return [{ label: "Copilot", key: "home" }, { label: record.title }];
    }
  });

  const navigate = (key: string) => {
    if (key === "persona") {
      mockWorkbench.inspect("agents.persona", { kind: "agent", id: record.agent });
    } else if (key === "dispatcher") {
      openDispatcher(record.startedBy)?.();
    } else if (key === "project") {
      mockWorkbench.inspect("project.project", { kind: "project", id: mockWorkbench.project.id });
    } else {
      mockWorkbench.inspect("copilot.home");
    }
  };
</script>

<Panel title={record.title}>
  {#snippet crumbs()}
    <PanelCrumbs {trail} onnavigate={navigate} />
  {/snippet}

  <PanelFields>
    <PanelField label="State">
      <span class="flex flex-wrap items-center gap-1.5">
        <PanelChip tone={STATE_TONE[record.state]}>{STATE_WORD[record.state]}</PanelChip>
        {#if line}
          <span class="text-ink-secondary">{line}</span>
        {/if}
      </span>
    </PanelField>

    <!-- Dropped where the trail already names the persona. -->
    {#if from !== "persona"}
      <PanelField label="Agent">
        <PanelActor
          name={agent}
          kind="agent"
          onselect={() =>
            mockWorkbench.inspect("agents.persona", { kind: "agent", id: record.agent })}
        />
      </PanelField>
    {/if}

    <PanelField label="Started by">
      <PanelActor
        name={record.startedBy.name}
        kind={record.startedBy.kind}
        onselect={openDispatcher(record.startedBy)}
      />
    </PanelField>

    <PanelField label="Started" mono>{record.started}</PanelField>
  </PanelFields>

  {#if record.progress}
    <PanelProgress
      label="Progress"
      detail="Step {record.progress.step} of {record.progress.of}"
      value={(record.progress.step / record.progress.of) * 100}
    />
  {/if}

  <PanelSection title="Asked to">
    <PanelQuote>{record.prompt}</PanelQuote>
    <PanelNote>
      The instruction is immutable. Changing what was asked means a new task.
    </PanelNote>
  </PanelSection>

  <!-- The progress bar, spelled out: every step with its own state, in words and icon. -->
  <PanelSection title="Plan" count={plan.length} flush>
    {#each plan as step (step.id)}
      <PanelRow
        title={step.title}
        sub={step.detail === undefined
          ? STEP_WORD[step.state]
          : `${STEP_WORD[step.state]} · ${step.detail}`}
        icon={STEP_ICON[step.state]}
        tone={STEP_TONE[step.state]}
      />
    {/each}
  </PanelSection>

  <!-- The trace rather than the answer, so it arrives shut. -->
  <PanelSection title="Tools used" count={tools.length} open={false} flush>
    {#each tools as call (call.id)}
      <PanelRow
        title={call.name}
        sub={toolLine(call)}
        meta={call.duration}
        icon={TOOL_ICON[call.outcome]}
        tone={TOOL_TONE[call.outcome]}
      >
        <span class="text-mono text-ink-primary truncate font-mono">{call.name}</span>
      </PanelRow>
    {/each}

    {#if tools.length === 0}
      <PanelNote>It has not called anything yet.</PanelNote>
    {/if}
  </PanelSection>

  <PanelSection title="Produced" count={outputs.length} open={false} flush>
    {#each outputs as output (output.id)}
      <PanelRow
        title={output.title}
        sub={output.summary}
        meta={output.promotedAs === undefined ? output.promotesTo : "Promoted"}
        icon={Package}
        tone={output.promotedAs === undefined ? "default" : "success"}
        onselect={output.promotedAs === undefined
          ? undefined
          : () => mockWorkbench.inspect("project.resource", { kind: "resource", id: output.id })}
      />
    {/each}

    <PanelNote>
      A task result is not a resource. Nothing in the project can retrieve it until
      it is promoted into a finding, a document, a deck or a spreadsheet.
    </PanelNote>
    <PanelNote tone="gap">
      There is no promotion here to press. A task records what it produced and
      nothing records how to promote it.
    </PanelNote>
  </PanelSection>

  <Separator />

  <PanelActions>
    <PanelButton
      label={following ? "Unfollow" : "Follow"}
      icon={following ? BellOff : Bell}
      title={following ? "Stop being told what it does" : "Be told what it does"}
      onclick={() => (following = !following)}
    />
    <PanelButton
      label="Cancel"
      icon={X}
      tone="danger"
      disabled={!live || oncancel === undefined}
      title={!live
        ? "It has already stopped."
        : oncancel === undefined
          ? "Nothing here can stop it."
          : "Stop this task"}
      onclick={oncancel}
    />
  </PanelActions>
</Panel>
