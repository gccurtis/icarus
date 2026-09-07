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

  const page = pageOf("persona");

  const callouts = [
    { n: 1, title: "Band and head", body: "A thin band with Back and the word Persona. Under it, on the surface: the face, an editable name and one-line description that save on blur or Enter, and the actions. New task opens the form on this persona. New automation and New chat create and open. Duplicate copies it. Delete is refused while anything in the project still names it, and the title says so." },
    { n: 2, title: "Definition", body: "One tabbed panel: Focus, Background, Approach, Output, Verification. Under the tabs, what that section is for, written out rather than truncated or hidden in a placeholder. Under that, the text in a box that fills the band, saving on blur." },
    { n: 3, title: "Default", body: "Beside the definition and cut to the same pattern: a tab for Scope and one for Tools, a line saying what that half governs, and the rows in a well. The tabs and the wells line up with the definition's tabs and text box to the pixel. Scope holds what it may read, each row an icon and a name, the first row Add resource; Tools are switches with what granting each means." },
    { n: 4, title: "Tasks, automations, chats", body: "One band under both, with a toggle at its end. Tasks and Automations each carry their own search and filters at the same width, and the task table drops the persona column because every row is this persona. Chats has a band of its own underneath. Nothing carries a count, every band has a set height that grows with the window, and each scrolls inside itself." }
  ];

  const writes = [
    ["Name", "head · lens", "updatePersona · patch.name", "on blur or Enter, if changed"],
    ["Description", "head · lens", "updatePersona · patch.description", "on blur, if changed; empty clears"],
    ["A definition section", "tabbed panel · lens modal", "updatePersona · patch.section", "on blur, or Save in the modal"],
    ["The default scope", "add or remove a row", "updatePersona · patch.scope", "on change"],
    ["A default tool", "switch · tool lens", "updatePersona · patch.tools", "on toggle"],
    ["An automation's On", "switch in the table", "updateAutomation · patch.enabled", "on toggle"],
    ["New chat", "head", "createChat", "then the chat's tab opens"],
    ["Duplicate", "head", "duplicatePersona", "then the copy opens"],
    ["Delete", "head", "removePersona", "refused while named; then the library"]
  ];
</script>

<ReferenceShell {page} {project}>
  <ReferenceSection
    id="live"
    kicker="The surface, live"
    title="Grid Analyst, in full"
    lede="The real persona surface over the seeded project. Edit the name, open a section, flip a tool: each one saves, and a reload keeps it."
  >
    <Noted scope="figure" label="Persona workbench">
      <LiveStage
        label="agents.persona"
        height="52rem"
        content="agents.persona"
        focus="personas:grid-analyst"
        context="agents.personas"
        inspect="agents.persona"
        selection={{ kind: "persona", id: "personas:grid-analyst" }}
      />
    </Noted>
    <Callouts items={callouts} />
  </ReferenceSection>

  <ReferenceSection
    id="writes"
    kicker="What saves"
    title="Nine controls, one procedure each"
    lede="Every control on the surface names the procedure it writes through and when it fires. A stale revision refuses and the surface says so under the head."
  >
    <SpecTable label="Writes" columns={["Control", "Where", "Writes through", "When"]} rows={writes} mono={[2]} noted="write" />
  </ReferenceSection>

  <ReferenceSection
    id="questions"
    kicker="Forks on this page"
    title="Decisions the persona raised"
    lede="Answer by number."
  >
    <Questions questions={questionsFor("persona")} />
  </ReferenceSection>
</ReferenceShell>
