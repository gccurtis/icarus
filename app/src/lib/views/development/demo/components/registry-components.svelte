<script lang="ts">
  import SectionHeading from "$views/development/demo/components/section-heading.svelte";
  import { Badge } from "$lib/components/vendor/badge";
  import { Button } from "$lib/components/vendor/button";
  import * as Card from "$lib/components/vendor/card";
  import { Input } from "$lib/components/vendor/input";
  import { Label } from "$lib/components/vendor/label";

  let inputValue = $state("");
</script>

<section class="flex flex-col gap-4">
  <SectionHeading title="Components" source="shadcn-svelte, bridged to our tokens" />
  <p class="text-body-sm text-ink-secondary max-w-[70ch]">
    Unmodified registry components. They reference shadcn's own vocabulary — <code
      class="font-mono">bg-primary</code
    >, <code class="font-mono">border-input</code> — which the shadcn integration aliases onto our tokens,
    so they can be updated without patching their imports.
  </p>

  <div class="flex flex-col gap-3">
    <h3 class="text-h4 font-semibold">Button</h3>
    <div class="flex flex-wrap items-center gap-2">
      <Button>Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
      <Button variant="destructive">Destructive</Button>
      <Button disabled>Disabled</Button>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <Button size="sm">Small</Button>
      <Button>Default</Button>
      <Button size="lg">Large</Button>
    </div>
  </div>

  <div class="flex flex-col gap-3">
    <h3 class="text-h4 font-semibold">Badge</h3>
    <div class="flex flex-wrap items-center gap-2">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="destructive">Destructive</Badge>
    </div>
  </div>

  <div class="flex flex-col gap-3">
    <h3 class="text-h4 font-semibold">Input and Label</h3>
    <div class="flex max-w-sm flex-col gap-2">
      <Label for="demo-input">Project name</Label>
      <Input id="demo-input" bind:value={inputValue} placeholder="Enter a name" />
      <!-- Placeholder never substitutes for a label; it disappears exactly when
           the user needs it. -->
      <p class="text-caption text-ink-muted">
        {inputValue === "" ? "Nothing entered yet" : `Bound value: ${inputValue}`}
      </p>
    </div>
  </div>

  <div class="flex flex-col gap-3">
    <h3 class="text-h4 font-semibold">Card</h3>
    <div class="grid gap-4 md:grid-cols-2">
      <Card.Root>
        <Card.Header>
          <Card.Title>Bounded surface</Card.Title>
          <Card.Description>Background plus a 1px border.</Card.Description>
        </Card.Header>
        <Card.Content>
          <p class="text-body-sm text-ink-secondary">
            Depth is earned by behaviour: a surface floats only if it can be dismissed.
          </p>
        </Card.Content>
        <Card.Footer>
          <Button variant="outline" size="sm">Action</Button>
        </Card.Footer>
      </Card.Root>

      <Card.Root>
        <Card.Header>
          <Card.Title>With an action</Card.Title>
          <Card.Description>One primary action per region.</Card.Description>
          <Card.Action>
            <Badge variant="outline">Live</Badge>
          </Card.Action>
        </Card.Header>
        <Card.Content>
          <p class="text-body-sm text-ink-secondary">
            Never a stack of cards — two levels of separation is the hard limit.
          </p>
        </Card.Content>
      </Card.Root>
    </div>
  </div>
</section>
