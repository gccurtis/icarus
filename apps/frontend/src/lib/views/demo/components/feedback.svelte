<script lang="ts">
  import SectionHeading from "$views/demo/components/section-heading.svelte";
  import * as Alert from "$lib/simple-components/alert";
  import * as Avatar from "$lib/simple-components/avatar";
  import { Button } from "$lib/simple-components/button";
  import * as Empty from "$lib/simple-components/empty";
  import { Progress } from "$lib/simple-components/progress";
  import { Spinner } from "$lib/simple-components/spinner";
</script>

<section class="flex flex-col gap-4">
  <SectionHeading title="Feedback and state" source="system/interaction/component.md" />
  <p class="text-body-sm text-ink-secondary max-w-[70ch]">
    Every state names itself in copy. Colour never carries a state alone, and a failure without a
    recovery path is an accusation rather than a state.
  </p>

  <h3 class="text-h4 font-semibold">Resolving</h3>
  <div class="flex flex-col gap-3">
    <div class="flex items-center gap-2">
      <Spinner />
      <!-- Progress plus current stage, per the state matrix — not a bare spinner. -->
      <span class="text-body-sm text-ink-secondary">Reading sources — 3 of 8</span>
    </div>
    <Progress value={38} max={100} class="max-w-sm" />
  </div>

  <h3 class="text-h4 font-semibold">Alerts</h3>
  <div class="flex flex-col gap-3">
    <Alert.Root>
      <Alert.Title>Needs review</Alert.Title>
      <Alert.Description>
        Derived content is waiting on human judgment. Says what to look at, not merely that something
        happened.
      </Alert.Description>
    </Alert.Root>
    <Alert.Root variant="destructive">
      <Alert.Title>Failed</Alert.Title>
      <Alert.Description>
        The run could not reach its source. Retry, or detach the binding and keep the last value.
      </Alert.Description>
    </Alert.Root>
  </div>

  <h3 class="text-h4 font-semibold">Empty</h3>
  <p class="text-body-sm text-ink-secondary max-w-[70ch]">
    A named state with a route out of it. A blank region is a state nobody designed.
  </p>
  <Empty.Root class="border-border-subtle rounded-panel border">
    <Empty.Header>
      <Empty.Title>No findings yet</Empty.Title>
      <Empty.Description>Findings appear here once a run has something to report.</Empty.Description>
    </Empty.Header>
    <Empty.Content>
      <Button variant="outline" size="sm">Start a run</Button>
    </Empty.Content>
  </Empty.Root>

  <h3 class="text-h4 font-semibold">Attribution</h3>
  <p class="text-body-sm text-ink-secondary max-w-[70ch]">
    Material action is attributable. Who or what produced a change is part of the change.
  </p>
  <div class="flex items-center gap-2">
    <Avatar.Root>
      <Avatar.Fallback>IC</Avatar.Fallback>
    </Avatar.Root>
    <span class="text-body-sm text-ink-secondary">Resolved by an agent run, 4 minutes ago</span>
  </div>
</section>
