<script lang="ts">
  import Callouts from "$development-views/agents-reference/components/callouts.svelte";
  import Diagram from "$development-views/agents-reference/components/diagram.svelte";
  import Noted from "$development-views/agents-reference/components/noted.svelte";
  import ProcedureChain from "$development-views/agents-reference/components/procedure-chain.svelte";
  import ReferenceSection from "$development-views/agents-reference/components/reference-section.svelte";
  import ReferenceShell from "$development-views/agents-reference/components/reference-shell.svelte";
  import SpecTable from "$development-views/agents-reference/components/spec-table.svelte";
  import { pageOf } from "$development-views/agents-reference/procedures/navigation";
  import {
    AUTOMATION_CHAINS,
    AUTOMATION_STATE,
    RUN_DIAGRAM,
    TRIGGER_DIAGRAM
  } from "$development-views/agents-reference/procedures/automation-spec";

  let { project }: { project: string } = $props();

  const page = pageOf("automations");

  const fields = [
    ["name", "string", "required", "Also the title of every task it makes."],
    ["personaId", "Id<personas>", "required", "Reassignable, unlike a task's. The new persona must be visible too."],
    ["instruction", "string", "required, may be empty", "Also the first message of every thread it opens. Empty means it cannot be switched on and cannot be run."],
    ["trigger", "AutomationTrigger", "required", "One of four kinds. Only the shape is enforced; nothing reads it to fire."],
    ["scope", "ResourceSet", "optional", "Copied onto each task it makes, when present."],
    ["tools", "ToolId[]", "required", "Copied from the persona at creation, then owned. Copied onto each task it makes."],
    ["enabled", "boolean", "required", "True at creation exactly when an instruction survived validation. Nothing at runtime reads it."],
    ["firedCount", "number", "required", "Incremented by one on every Run now, and by nothing else."],
    ["lastFiredAt", "number", "optional", "The same clock value as the task's startedAt and its first message."],
    ["createdBy · revision · updatedAt", "Actor · number · number", "required", "Run now moves updatedAt and leaves the revision alone."]
  ];

  const triggers = [
    ["manual", "none", "someone presses Run", "Runs when pressed"],
    ["schedule", "at as HH:MM · repeats · weekday when weekly · timezone", "the clock reaches 09:00 in Berlin, every weekday", "09:00 weekdays"],
    ["resource-edited", "kinds, at least one · ref for one exact resource", "a document is edited, or the board pack is edited", "Edits to documents"],
    ["resource-created", "kinds, at least one", "a slide deck is created", "New slide decks"]
  ];

  const truths = [
    {
      n: 1,
      title: "Only manual ever fires, and it fires because a person pressed something",
      body: "There is no clock, no queue, no timer and no write hook anywhere in the application that reads this table. The three standing kinds are validated, stored, and read back to render a sentence. Nothing else happens to them."
    },
    {
      n: 2,
      title: "Run now ignores the trigger and ignores enabled",
      body: "runAutomation never inspects either. A rule with a schedule trigger, switched off, still runs by hand, and the task it makes is stamped trigger manual regardless of what the rule says. That is honest about what happened and lossy about why."
    },
    {
      n: 3,
      title: "Off is the safe removal",
      body: "removeAutomation counts the visible tasks whose origin names the rule and refuses while any do, saying to switch it off instead. The count comes from the tasks rather than from firedCount, so removing the tasks would free the rule."
    },
    {
      n: 4,
      title: "Firing is not an edit",
      body: "Run now writes three fields by path and leaves the revision alone, so a client holding the old revision can still edit the rule afterwards. A fire is something that happened, not a change somebody authored."
    },
    {
      n: 5,
      title: "The trigger sentence is written once and read in five places",
      body: "triggerClause and triggerSummary in the representation's behaviour turn a trigger into prose. Three surfaces and the server projection all call them, so a rule reads the same everywhere it appears."
    }
  ];

  const missing = [
    ["A clock", "Nothing reads at, repeats, weekday or timezone for dispatch.", "A scheduled job walking enabled schedule rules, resolving the zone against lastFiredAt. timezone is a free string today, so it would need real zone resolution."],
    ["An event source", "Nothing reads kinds or ref for dispatch.", "A hook on the document, deck, spreadsheet and finding write paths, matching the changed resource against each enabled rule."],
    ["A non-interactive run path", "runAutomation calls requireScope, so it needs a person's session.", "A run that takes a system actor, writes the real trigger kind into the task's origin, and puts the triggering resource in the ref field the type already reserves."],
    ["Anything that reads enabled", "Only the update guard and the surfaces group by it.", "The dispatchers above would be the first readers."]
  ];
</script>

<ReferenceShell {page} {project}>
  <ReferenceSection
    id="state"
    kicker="State"
    title="A rule is a persona, an instruction and a trigger"
    lede="Everything a task needs, held so it can be made again. The rule's name becomes the task's title and its instruction becomes the task's instruction and the thread's first message."
  >
    <SpecTable
      label="automations"
      columns={["Field", "Type", "Required", "What it holds"]}
      rows={fields}
      mono={[0, 1]}
      noted="field"
    />
    <Noted scope="figure" label="A rule and what it makes">
      <Diagram
        label="The automation and the tasks it fires"
        source={AUTOMATION_STATE}
        caption="The link back is the task's origin. It is also what stops the rule being removed."
        minHeight="30rem"
      />
    </Noted>
  </ReferenceSection>

  <ReferenceSection
    id="triggers"
    kicker="State"
    title="Four kinds, and what each one carries"
    lede="The trigger is a closed union with its own parameters per variant, validated on the way in. What it does not have is anything that reads it in order to fire."
  >
    <SpecTable
      label="Trigger kinds"
      columns={["Kind", "Parameters", "Read as a clause", "Read as a summary"]}
      rows={triggers}
      mono={[0]}
      noted="trigger"
    />
    <Noted scope="figure" label="Triggers">
      <Diagram
        label="The four kinds and what fires them"
        source={TRIGGER_DIAGRAM}
        caption="Three of the four converge on something that does not exist. The fourth is a button."
        minHeight="34rem"
      />
    </Noted>
    <Callouts items={truths} scope="truth" />
  </ReferenceSection>

  <ReferenceSection
    id="chains"
    kicker="Procedures"
    title="Five procedures, step by step"
    lede="What each takes, every step in order, what it writes, what it refuses and what it refreshes. Run now is the only one that writes another table."
  >
    <div class="ar-chains">
      {#each AUTOMATION_CHAINS as chain (chain.name)}
        <ProcedureChain {chain} />
      {/each}
    </div>
  </ReferenceSection>

  <ReferenceSection
    id="run"
    kicker="Execution"
    title="Run now, in full"
    lede="The one path in this system that produces anything. Five writes across three tables, and the rule's revision untouched at the end of it."
  >
    <Noted scope="figure" label="Run now">
      <Diagram
        label="Firing a rule by hand"
        source={RUN_DIAGRAM}
        caption="Nothing is read from the persona row. The rule carries its own copy of the tools, seeded from that persona when the rule was created."
        minHeight="38rem"
      />
    </Noted>
  </ReferenceSection>

  <ReferenceSection
    id="missing"
    kicker="Honestly"
    title="What would have to exist for a rule to fire itself"
    lede="Three things, and none of them is in the codebase. Stated in the order they would have to be built."
  >
    <SpecTable
      label="Not built"
      columns={["Missing", "What exists today", "What it would take"]}
      rows={missing}
      noted="missing"
    />
  </ReferenceSection>
</ReferenceShell>
