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
    PERSONA_CHAINS,
    PERSONA_INHERITANCE,
    PERSONA_STATE,
    PERSONA_SYSTEM,
    PERSONA_UPDATE,
    PERSONA_VISIBILITY
  } from "$development-views/agents-reference/procedures/persona-spec";

  let { project }: { project: string } = $props();

  const page = pageOf("personas");

  const fields = [
    ["name", "string", "required", "At most 160 characters. The only thing createPersona asks for."],
    ["description", "string", "optional", "At most 500. A patch of null removes it."],
    ["definition", "PersonaDefinition", "required", "Five named sections: focus, background, approach, outputPreferences, verification. Never partial; a new persona gets five empty strings."],
    ["scope", "ResourceSet", "optional", "What it may read, as include and exclude term lists. A new persona gets the whole project."],
    ["tools", "ToolId[]", "required", "The grants, from a closed union of six. A new persona gets retrieve and resource.read."],
    ["cast", "Cast", "optional", "A label and two levels, strength and speed. No control sets it any more."],
    ["avatar", "PersonaAvatar", "optional", "An emoji or a stored image. Nothing writes it; it survives an update by riding through the spread."],
    ["projectId", "Id<projects>", "required", "Everything is gated by it, so there is no personal persona and no persona that outlives its project."],
    ["createdBy", "Actor", "required", "The viewer at the moment of creation. A duplicate is owned by whoever duplicated it."],
    ["revision", "number", "required", "The compare-and-swap handle. One at creation, plus one on every update."],
    ["updatedAt", "number", "required", "Wall clock, for display and ordering."]
  ];

  const sections = [
    ["focus", "What it is for, in one or two lines."],
    ["background", "What it should assume the reader knows."],
    ["approach", "How it should go about the work."],
    ["outputPreferences", "What its answers should look like."],
    ["verification", "What it should check before it says something."]
  ];

  const projection = [
    ["id", "copied", "The row id, renamed."],
    ["name · revision · updatedAt", "copied", "Straight through."],
    ["description · scope", "derived", "undefined becomes null, which is how a surface learns to show the default instead."],
    ["tools", "derived", "orderedTools re-sorts into catalogue order and drops anything outside the closed union."],
    ["createdByName", "derived", "The Actor resolved to a display name: a user's name, an agent's persona, a connector, or Icarus."],
    ["counts", "derived", "tasks, running, review, finished, automations and chats, counted over the same visible snapshot. A chat is a research thread that names this persona."],
    ["definition", "rebuilt", "Detail only. Each of the five sections falls back to an empty string, so a surface can always trim it."],
    ["cast · avatar", "derived", "Detail only. undefined becomes null."],
    ["projectId", "not exposed", "No projection carries it."]
  ];

  const truths = [
    {
      n: 1,
      title: "A persona is the visibility root of the whole category",
      body: "visibleIn keeps a persona when its shape is sound, its name is a string, and its projectId is the scope's. There is no personal persona: everything is gated by the project. Every task, rule and chat is then kept only if its personaId is in that set, so an invisible persona hides everything that names it, and nothing raises an error when it does."
    },
    {
      n: 2,
      title: "The lookup is the authorisation",
      body: "There is no separate permission check anywhere in these six procedures. A Scope exists only because the caller holds a handle to that project, and findVisible searches within what that Scope can see. A row that is not there comes back as not-found."
    },
    {
      n: 3,
      title: "Tools are inherited once; scope is never inherited on the server",
      body: "createTask and createAutomation copy the persona's tools when the caller sends none. Neither ever copies its scope: the row is simply written without the field. The fallback a reader sees is resolved on the client, by looking the persona up and showing its scope when the row's own is null."
    },
    {
      n: 4,
      title: "There is no persona behaviour file",
      body: "behavior/agents holds messages, plan, tools and triggers. Not one function in it takes a persona. Everything a persona does is either a field, a projection or a procedure."
    },
    {
      n: 5,
      title: "Removal is guarded by use, not by ownership",
      body: "removePersona counts the visible tasks, automations and chats that name it and refuses with that count written out. It is the only procedure in the category that refuses in-use, and it deletes with store.remove rather than removeRows because a path with no field segments is a whole-row delete."
    }
  ];

  const validation = [
    ["An unknown field", "throws", "agents/create-persona: unknown field(s) colour"],
    ["A patch that changes nothing", "throws", "agents/update-persona: the patch changes nothing"],
    ["A name over 160 characters", "throws", "agents/create-persona: name is at most 160 characters"],
    ["A tool outside the catalogue", "throws", "agents/update-persona: sorcery is not a tool"],
    ["An id that is not visible", "refuses", "not-found, with revision null"],
    ["A revision that has moved", "refuses", "stale, carrying the row's current revision"]
  ];
</script>

<ReferenceShell {page} {project}>
  <ReferenceSection
    id="system"
    kicker="The system"
    title="Everything that touches a persona"
    lede="Fifteen surfaces read one, six procedures write or read the row, and one projection stands between them. The persona is shared with research chat by design and not yet in fact: nothing in that capability reads this table."
  >
    <Noted scope="figure" label="The persona system">
      <Diagram
        label="Surfaces, procedures and the row"
        source={PERSONA_SYSTEM}
        caption="Every write goes through the capability's index. No surface reaches past it, and no other capability reaches this table at all."
        minHeight="30rem"
      />
    </Noted>
  </ReferenceSection>

  <ReferenceSection
    id="state"
    kicker="State"
    title="Eleven fields, four of them optional"
    lede="A persona is a name and a definition. Everything else is either what it may reach, who owns it, or how a concurrent edit is caught."
  >
    <SpecTable
      label="personas"
      columns={["Field", "Type", "Required", "What it holds"]}
      rows={fields}
      mono={[0, 1]}
      noted="field"
    />
    <SpecTable
      label="The five definition sections"
      columns={["Section", "What goes in it"]}
      rows={sections}
      mono={[0]}
      noted="section"
    />
    <Noted scope="figure" label="What names a persona">
      <Diagram
        label="The persona and the three tables that name it"
        source={PERSONA_STATE}
        caption="Three tables carry a personaId. Two of them copy the persona's tools at creation and then own their copy."
        minHeight="32rem"
      />
    </Noted>
  </ReferenceSection>

  <ReferenceSection
    id="visibility"
    kicker="State"
    title="What makes a persona visible, and what that decides"
    lede="This is the single most load-bearing rule in the category, and it is eleven lines of one function. Read it before the procedures, because every one of them depends on it and none of them repeats it."
  >
    <Noted scope="figure" label="Visibility">
      <Diagram
        label="The visibleIn rule for a persona"
        source={PERSONA_VISIBILITY}
        caption="A row that fails any check is dropped without a word. That is deliberate: a malformed row is a fact about the store, not an error the caller made."
        minHeight="30rem"
      />
    </Noted>
    <Callouts items={truths} scope="truth" />
  </ReferenceSection>

  <ReferenceSection
    id="projection"
    kicker="Behaviour"
    title="What a surface actually reads"
    lede="No surface sees a persona row. It sees a PersonaItem, or a PersonaDetail on the by-id read, and half of that is computed rather than copied."
  >
    <SpecTable
      label="personaItem and personaDetail"
      columns={["Field", "How", "What it means"]}
      rows={projection}
      mono={[0]}
      pills={[1]}
      noted="projected"
    />
  </ReferenceSection>

  <ReferenceSection
    id="chains"
    kicker="Procedures"
    title="Six procedures, step by step"
    lede="What each takes, every step in order with the function that performs it, what it writes, what it refuses and what it refreshes. Four commands and two queries; only the two by-id reads answer null rather than refusing."
  >
    <div class="ar-chains">
      {#each PERSONA_CHAINS as chain (chain.name)}
        <ProcedureChain {chain} />
      {/each}
    </div>
  </ReferenceSection>

  <ReferenceSection
    id="update"
    kicker="Execution"
    title="One edit, from a keystroke to the row"
    lede="The same five steps for every compare-and-swap write in the capability. What makes it readable is that the refusals come before any write and carry the revision the caller needs to retry."
  >
    <Noted scope="figure" label="An update">
      <Diagram
        label="Editing a persona"
        source={PERSONA_UPDATE}
        caption="undefined means leave it alone, null means remove it. That distinction is the whole of the patch language."
        minHeight="34rem"
      />
    </Noted>
    <SpecTable
      label="What goes wrong, and how"
      columns={["Case", "Kind", "What comes back"]}
      rows={validation}
      pills={[1]}
      noted="failure"
    />
  </ReferenceSection>

  <ReferenceSection
    id="inheritance"
    kicker="Execution"
    title="Where a default actually resolves"
    lede="Worth its own diagram because the answer is not where anyone expects. Tools are copied once on the server. Scope is never copied at all, and the inheritance a reader sees is drawn by the client every time."
  >
    <Noted scope="figure" label="Inheritance">
      <Diagram
        label="Tools and scope, at creation and afterwards"
        source={PERSONA_INHERITANCE}
        caption="This is why changing a persona's tools does not change its tasks, and why changing its scope changes every task that has none."
        minHeight="30rem"
      />
    </Noted>
  </ReferenceSection>
</ReferenceShell>
