<script lang="ts">
  import Callouts from "$development-views/agents-reference/components/callouts.svelte";
  import LiveStage from "$development-views/agents-reference/components/live-stage.svelte";
  import Noted from "$development-views/agents-reference/components/noted.svelte";
  import Questions from "$development-views/agents-reference/components/questions.svelte";
  import ReferenceSection from "$development-views/agents-reference/components/reference-section.svelte";
  import ReferenceShell from "$development-views/agents-reference/components/reference-shell.svelte";
  import SpecTable from "$development-views/agents-reference/components/spec-table.svelte";
  import { pageOf } from "$development-views/agents-reference/procedures/navigation";
  import { questionsFor } from "$development-views/agents-reference/procedures/questions";

  let { project }: { project: string } = $props();

  const page = pageOf("automation");

  const callouts = [
    { n: 1, title: "Band", body: "Back, an editable name, the trigger kind, On or Off, how many are running, how often it fired and when last. The On switch, Run now, and Delete. A rule with no instruction cannot be switched on or run, and Delete is refused once it has fired." },
    { n: 2, title: "The sentence", body: "The rule read back as prose: when the clause, ask the persona to the instruction. It takes the inactive tone while the rule is off." },
    { n: 3, title: "Trigger", body: "Four equal cards, one chosen, its parameters under it: a time, a repeat and a timezone for a schedule; kinds and optionally one exact resource for an edit; kinds for a creation. Every change saves at once." },
    { n: 4, title: "Do this", body: "A searchable persona picker on the left and the instruction on the right. Picking a persona saves; the instruction saves on blur." },
    { n: 5, title: "What it may reach, and what it fired", body: "One band with a toggle: the scope, which is the resources and saved sets it may read, or the tools, each marked default, added or removed against the persona. Until the rule sets its own scope it reads whatever the persona reads. Fired is the table of tasks the rule made, in the same shape as the library's." }
  ];

  const triggers = [
    ["Manual", "Someone presses Run", "none", "Run here, or in the Manual panel"],
    ["On a schedule", "The clock reaches a time", "at · repeats · weekday · timezone", "daily, weekdays, or one weekday"],
    ["When a resource is edited", "Something of these kinds changes", "kinds · one exact resource", "any of the kinds, or one document, deck or sheet"],
    ["When a resource is created", "Something of these kinds is made", "kinds", "any of the kinds"]
  ];

  const writes = [
    ["Name", "band", "updateAutomation · patch.name", "on blur"],
    ["On", "band · lens · persona table", "updateAutomation · patch.enabled", "refused while unwritten"],
    ["Trigger", "cards and parameters", "updateAutomation · patch.trigger", "on every change; validated first"],
    ["Persona", "picker", "updateAutomation · patch.personaId", "on pick"],
    ["Instruction", "text", "updateAutomation · patch.instruction", "on blur"],
    ["A tool", "switch", "updateAutomation · patch.tools", "on toggle"],
    ["The scope", "add or remove a row", "updateAutomation · patch.scope", "null gives it back to the persona"],
    ["Run now", "band · lens · Manual row", "runAutomation", "one task, and the fire counted; refused while unwritten"],
    ["Delete", "band", "removeAutomation", "refused once fired"]
  ];
</script>

<ReferenceShell {page} {project}>
  <ReferenceSection
    id="live"
    kicker="The surface, live"
    title="The nightly digest, as a rule"
    lede="The real automation surface on a scheduled rule from the seed. Change the time, pick another persona, press Run now: each one writes."
  >
    <Noted scope="figure" label="Automation workbench">
      <LiveStage
        label="agents.automation"
        height="56rem"
        content="agents.automation"
        focus="automations:nightly"
        context="agents.automations"
        inspect="agents.automation"
        selection={{ kind: "automation", id: "automations:nightly" }}
      />
    </Noted>
    <Callouts items={callouts} />
  </ReferenceSection>

  <ReferenceSection
    id="triggers"
    kicker="Triggers"
    title="Four kinds, one chosen"
    lede="Once is not a trigger any more: a task that runs once is a task. The four here are what makes a rule a rule."
  >
    <SpecTable label="Trigger kinds" columns={["Kind", "Fires when", "Parameters", "Notes"]} rows={triggers} noted="trigger" />
  </ReferenceSection>

  <ReferenceSection
    id="writes"
    kicker="What saves"
    title="Eight controls, one procedure each"
    lede="Every control names the procedure it writes through. A trigger that fails validation throws before anything is read, so the surface shows the reason and keeps the old one."
  >
    <SpecTable label="Writes" columns={["Control", "Where", "Writes through", "When"]} rows={writes} mono={[2]} noted="write" />
  </ReferenceSection>

  <ReferenceSection
    id="questions"
    kicker="Forks on this page"
    title="Decisions the automation raised"
    lede="Answer by number."
  >
    <Questions questions={questionsFor("automation")} />
  </ReferenceSection>
</ReferenceShell>
