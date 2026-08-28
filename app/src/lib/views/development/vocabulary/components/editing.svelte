<script lang="ts">
  import Entry from "$views/development/vocabulary/components/entry.svelte";
  import SectionTitle from "$views/development/vocabulary/components/section-title.svelte";
  import {
    PanelField,
    PanelFields,
    PanelNote,
    PanelPair,
    PanelPairs,
    PanelSelect,
    PanelEditableText,
    PanelSection,
    PanelToggle
  } from "$authored-components/panel";

  /**
   * The words that hand a value back.
   *
   * Every other section on this page documents a shape for *displaying*
   * something the model owns. This one is the other half, and it was missing:
   * a vocabulary that can only show is a vocabulary for a reader, and half of
   * what these screens are for is making things.
   *
   * The set is deliberately three plus one. Three because a value is free text,
   * one of a known set, or a boolean, and those are genuinely different controls
   * rather than three skins of the same one. Plus one because there is a second
   * question underneath — whether the *names* are the reader's too — and that
   * is a different shape, not a different type.
   */
  const CODE = {
    editable: `<PanelField label="Name" stacked>
  <PanelEditableText
    value={project.name}
    label="Project name"
    onchange={(next) => project.rename(next)}
  />
</PanelField>

<!-- single click when changing it is why they came -->
<PanelEditableText activate="click" ... />`,
    select: `<PanelField label="Type">
  <PanelSelect
    value={variable.type}
    label="Variable type"
    options={[
      { value: "text", label: "Text" },
      { value: "number", label: "Number" },
      { value: "table", label: "Table" }
    ]}
    onchange={(next) => variable.retype(next)}
  />
</PanelField>`,
    pairs: `<PanelPairs
  columns={["Name", "Value"]}
  addLabel="Add variable"
  onadd={() => variables.create()}
>
  {#each variables.all as variable (variable.id)}
    <PanelPair
      name={variable.key}
      value={variable.value}
      onrename={(next) => variable.rename(next)}
      onchange={(next) => variable.set(next)}
      onremove={() => variable.remove()}
    />
  {/each}
</PanelPairs>`,
    multiline: `<PanelField label="Description" stacked>
  <PanelEditableText multiline
    value={persona.brief}
    label="What this persona is for"
    placeholder="Say what this persona is for"
    onchange={(next) => persona.describe(next)}
  />
</PanelField>`
  };

  let name = $state("Northwind Grid Resilience");
  let brief = $state("");
  let type = $state("number");
  let alerts = $state(true);

  let pairs = $state([
    { id: 1, key: "outageThreshold", value: "1500" },
    { id: 2, key: "region", value: "Eastbrook" },
    { id: 3, key: "reviewedBy", value: "" }
  ]);
  let next = 4;
</script>

<section class="flex flex-col gap-8">
  <SectionTitle title="Editing" source="src/lib/components/authored/panel/">
    Every shape above displays what the model owns. These are the ones that hand
    it back, and they are the reason the vocabulary is not just a reader's. A
    value is free text, one of a known set, or a boolean — three controls,
    because those are three genuinely different questions. The fourth shape is
    for when the <em>names</em> are the reader's too.
  </SectionTitle>

  <PanelNote>
    These are the only examples on this page that do something: typing in one
    changes the state beside it, so the gesture can be judged rather than
    described. Nothing is saved anywhere — an edit here dies with the tab.
  </PanelNote>

  <Entry
    name="PanelEditableText"
    use="A value the reader changes where it is shown. Single click by default — a value drawn as editable is one someone came to change, and asking for a second click to honour the first is a toll on the common case. Enter, Space and F2 all open it from the keyboard, Escape abandons, blur commits."
    instead="a value the model owns and the reader cannot set. That is a plain PanelField — an edit affordance on something read-only is a promise the panel cannot keep. Reach for activate=&quot;double-click&quot; only where the text has another job a single click would take away."
    code={CODE.editable}
  >
    <div class="py-3">
      <PanelFields>
        <PanelField label="Name" stacked>
          <PanelEditableText
            value={name}
            label="Project name"
            onchange={(text) => (name = text)}
          />
        </PanelField>
        <PanelField label="Key" stacked>
          <PanelEditableText
            value="northwind-grid"
            label="Project key"
            mono
            activate="click"
            onchange={() => {}}
          />
        </PanelField>
        <PanelField label="Owner">
          <PanelEditableText value="Ana Reyes" label="Owner" />
        </PanelField>
      </PanelFields>
      <div class="px-3 pt-1">
        <PanelNote>
          The third has no onchange, so it renders as plain text with no
          affordance. Read-only is the absence of a handler, not a disabled box.
        </PanelNote>
      </div>
    </div>
  </Entry>

  <Entry
    name="PanelEditableText multiline"
    use="The same word for a description, a brief, or a prompt. Enter stays a newline and Cmd-Enter commits, because a paragraph whose Enter key closes the editor cannot be written."
    instead="a formula or an expression. Those are one line that must not wrap on a keystroke — PanelCode shows them, and a single-line editable sets them."
    code={CODE.multiline}
  >
    <div class="py-3">
      <PanelFields>
        <PanelField label="Description" stacked>
          <PanelEditableText
            multiline
            value={brief}
            label="What this persona is for"
            placeholder="Say what this persona is for"
            activate="click"
            onchange={(text) => (brief = text)}
          />
        </PanelField>
      </PanelFields>
    </div>
  </Entry>

  <Entry
    name="PanelSelect"
    use="A value from a fixed set — a type, a role, a permission, a format. simple-components/select underneath, so the listbox semantics, typeahead and keyboard are bits-ui's."
    instead="an open set. If tomorrow's answer might be a word nobody listed, it is editable text, and a select would be a validation error waiting to happen."
    code={CODE.select}
  >
    <div class="py-3">
      <PanelFields>
        <PanelField label="Type">
          <PanelSelect
            value={type}
            label="Variable type"
            options={[
              { value: "text", label: "Text" },
              { value: "number", label: "Number" },
              { value: "table", label: "Table" },
              { value: "function", label: "Function" }
            ]}
            onchange={(chosen) => (type = chosen)}
          />
        </PanelField>
        <PanelField label="Alerts">
          <PanelToggle
            checked={alerts}
            label="Alert when this variable changes"
            onchange={(on) => (alerts = on)}
          />
        </PanelField>
      </PanelFields>
      <div class="px-3 pt-1">
        <PanelNote>
          The three value editors, together: free text above, one of a set, and a
          boolean. A panel that needs a fourth is a panel that needs a screen.
        </PanelNote>
      </div>
    </div>
  </Entry>

  <Entry
    name="PanelPairs · PanelPair"
    use="Pairs the reader creates, names and fills in — project variables, connector headers, a template's inputs. What makes it a different shape from PanelFields is not that the values are editable but that the left column is."
    instead="facts the schema decided. Provider, Status and Last sync are PanelFields — no reader adds a row to those, and an add control there would be a lie."
    code={CODE.pairs}
  >
    <div class="py-2">
      <PanelSection title="Variables" count={pairs.length}>
        <PanelPairs
          columns={["Name", "Value"]}
          addLabel="Add variable"
          empty="No variables yet."
          count={pairs.length}
          onadd={() => {
            pairs = [...pairs, { id: next++, key: "", value: "" }];
          }}
        >
          {#each pairs as pair (pair.id)}
            <PanelPair
              name={pair.key}
              value={pair.value}
              onrename={(text) => (pair.key = text)}
              onchange={(text) => (pair.value = text)}
              onremove={() => (pairs = pairs.filter((other) => other.id !== pair.id))}
            />
          {/each}
        </PanelPairs>
      </PanelSection>
    </div>
  </Entry>
</section>
