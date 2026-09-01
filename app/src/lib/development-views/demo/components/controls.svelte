<script lang="ts">
  import SectionHeading from "$development-views/demo/components/section-heading.svelte";
  import { Checkbox } from "$vendored-components/checkbox";
  import * as Field from "$vendored-components/field";
  import * as InputGroup from "$vendored-components/input-group";
  import { Label } from "$vendored-components/label";
  import * as RadioGroup from "$vendored-components/radio-group";
  import * as Select from "$vendored-components/select";
  import { Slider } from "$vendored-components/slider";
  import { Switch } from "$vendored-components/switch";
  import { Textarea } from "$vendored-components/textarea";
  import { Toggle } from "$vendored-components/toggle";
  import * as ToggleGroup from "$vendored-components/toggle-group";

  let bold = $state(false);
  let marks = $state<string[]>([]);
  let live = $state(true);
  let confidence = $state([70]);
  let scope = $state("selection");
  let kind = $state("");
</script>

<section class="flex flex-col gap-4">
  <SectionHeading title="Controls" source="shadcn-svelte, bridged to our tokens" />
  <p class="text-body-sm text-ink-secondary max-w-[70ch]">
    What the inspector is built from. These are the surfaces a user acts through when a session has
    something under inspection.
  </p>

  <h3 class="text-h4 font-semibold">Toggle and toggle group</h3>
  <p class="text-body-sm text-ink-secondary max-w-[70ch]">
    Exactly what a <code class="font-mono">document-next-text</code> inspection needs: set a mark
    once and the editor applies it to each subsequent keypress, without the inspection changing.
  </p>
  <div class="flex flex-wrap items-center gap-4">
    <Toggle bind:pressed={bold} aria-label="Bold">B</Toggle>
    <ToggleGroup.Root type="multiple" bind:value={marks}>
      <ToggleGroup.Item value="bold" aria-label="Bold">B</ToggleGroup.Item>
      <ToggleGroup.Item value="italic" aria-label="Italic">I</ToggleGroup.Item>
      <ToggleGroup.Item value="mono" aria-label="Monospace">M</ToggleGroup.Item>
    </ToggleGroup.Root>
    <span class="text-caption text-ink-muted font-mono">
      {marks.length ? marks.join(" · ") : "no marks"}
    </span>
  </div>

  <h3 class="text-h4 font-semibold">Switch, checkbox, radio</h3>
  <div class="flex flex-col gap-3">
    <div class="flex items-center gap-2">
      <Switch id="live" bind:checked={live} />
      <Label for="live">Keep this value live</Label>
    </div>
    <div class="flex items-center gap-2">
      <Checkbox id="attribute" />
      <Label for="attribute">Show attribution inline</Label>
    </div>
    <RadioGroup.Root bind:value={scope}>
      <div class="flex items-center gap-2">
        <RadioGroup.Item value="selection" id="scope-selection" />
        <Label for="scope-selection">Selection</Label>
      </div>
      <div class="flex items-center gap-2">
        <RadioGroup.Item value="document" id="scope-document" />
        <Label for="scope-document">Whole document</Label>
      </div>
    </RadioGroup.Root>
  </div>

  <h3 class="text-h4 font-semibold">Select</h3>
  <Select.Root type="single" bind:value={kind}>
    <Select.Trigger class="w-56">{kind || "Choose a resource kind"}</Select.Trigger>
    <Select.Content>
      <Select.Item value="document">Document</Select.Item>
      <Select.Item value="investigation">Investigation</Select.Item>
      <Select.Item value="spreadsheet">Spreadsheet</Select.Item>
    </Select.Content>
  </Select.Root>

  <h3 class="text-h4 font-semibold">Slider</h3>
  <div class="flex max-w-sm flex-col gap-2">
    <Label for="confidence">Confidence threshold</Label>
    <Slider type="multiple" bind:value={confidence} max={100} step={1} />
    <!-- A number a user sets should read back as a number, in tabular figures
         so it does not jitter as it changes. -->
    <span class="text-caption text-ink-muted font-mono tabular-nums">{confidence[0]}%</span>
  </div>

  <h3 class="text-h4 font-semibold">Field and input group</h3>
  <div class="flex max-w-md flex-col gap-4">
    <Field.Field>
      <Field.Label for="prompt">Prompt</Field.Label>
      <Textarea id="prompt" placeholder="What should this produce?" rows={3} />
      <Field.Description>
        Intelligence stays out of the way: quiet until directed, explicit about scope.
      </Field.Description>
    </Field.Field>

    <InputGroup.Root>
      <InputGroup.Addon>=</InputGroup.Addon>
      <InputGroup.Input placeholder="SUM(findings.confidence)" />
    </InputGroup.Root>
  </div>
</section>
