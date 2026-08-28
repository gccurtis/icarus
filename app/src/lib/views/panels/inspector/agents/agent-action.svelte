<script lang="ts">
  import {
    Panel,
    PanelActor,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelQuote,
    PanelRow,
    PanelSection
  } from "$components/authored/panel";
  import {
    actionsFor,
    automation,
    lastFireOf,
    lookupScopeOf,
    persona,
    toolsFor,
    type ActionOption,
    type ToolPermission
  } from "$capabilities/agents";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * Ask an agent: who is asked, what they are asked, and what comes out.
   *
   * `docs/screen-panel-views/inspector/agents/agent-action.md` is the
   * specification. The instruction is quoted rather than set as a field because
   * it is sent verbatim — nothing is added to it and nothing is templated into
   * it.
   *
   * **What the agent may see and do is here, collapsed.** A rule that asks an
   * agent for something it lacks the tools for fails at 02:00, silently, every
   * night, and the permission is the first place to look.
   */
  let { automationId = "nightly-digest" }: { automationId?: string } = $props();

  const view = viewState();

  const rule = $derived(automation(automationId).current);

  type AskAgent = Extract<ActionOption, { kind: "ask-agent" }>;
  const isAsk = (option: ActionOption): option is AskAgent => option.kind === "ask-agent";

  const action = $derived(actionsFor(automationId).current.find(isAsk));

  const agentId = $derived(action?.agent ?? "grid-analyst");
  const profile = $derived(persona(agentId).current);
  const scope = $derived(lookupScopeOf(agentId).current);
  const allowed = $derived(
    toolsFor(agentId).current.filter((tool: ToolPermission) => tool.allowed)
  );

  /** The dispatch, and the only place a fire's task is recorded. */
  const fire = $derived(lastFireOf(automationId).current);
</script>

<Panel title="Ask an agent">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[
        { label: rule.name, key: "agents.automation" },
        { label: "Do this" },
        { label: "Ask an agent" }
      ]}
      onnavigate={(key: string) => {
        if (isInspectionKey(key)) view.inspect(key, { kind: "automation", id: automationId });
      }}
    />
  {/snippet}

  {#if action?.chosen}
    <PanelSection title="Ask an agent" flush>
      <PanelActor
        name={profile.name}
        kind="agent"
        role={profile.describes}
        size="head"
        onselect={() => view.inspect("agents.persona", { kind: "agent", id: agentId })}
      />
    </PanelSection>

    <PanelSection title="Ask it to" flush>
      <PanelQuote>{action.prompt}</PanelQuote>
      <PanelNote>Sent verbatim. Nothing is added to it and nothing is templated into it.</PanelNote>
      <PanelNote tone="gap">
        A scheduled prompt often wants to say "last night" or "this week".
        Whether any substitution is available is unaddressed, and so is how a
        prompt stays correct as time passes without one.
      </PanelNote>
    </PanelSection>

    <!-- Why a rule fails, rather than what it does, so it arrives shut. -->
    <PanelSection title="That agent" open={false} flush>
      <PanelFields>
        <PanelField label="Can look up">{scope.name} · {scope.contains}</PanelField>
        <PanelField label="Tools">{allowed.length} allowed</PanelField>
      </PanelFields>
      <PanelNote>
        A rule that asks an agent to do something it lacks the tools for fails at
        the hour it fires, silently, every time.
      </PanelNote>
    </PanelSection>

    <PanelSection title="What comes out" flush>
      {#if fire.task}
        {@const task = fire.task}
        <PanelRow
          title={task.title}
          sub="Started by {rule.name}"
          meta={task.detail}
          onselect={() => view.inspect("copilot.task", { kind: "task", id: task.id })}
        />
      {:else}
        <PanelNote>No task yet. The last fire did not make one.</PanelNote>
      {/if}

      <PanelNote>
        A task, marked as started by this Automation. That task is the whole
        trace and it opens in the Copilot — the rule records only that it
        dispatched.
      </PanelNote>
    </PanelSection>
  {:else}
    <PanelNote>
      This rule does not ask an agent. Its action is a re-run of a generated
      block, and a rule has exactly one action.
    </PanelNote>
  {/if}
</Panel>
