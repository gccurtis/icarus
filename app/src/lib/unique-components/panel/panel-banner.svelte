<script lang="ts">
  import type { Snippet } from "svelte";
  import CircleAlert from "@lucide/svelte/icons/circle-alert";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";

  import * as Alert from "$lib/simple-components/alert";
  import { cn } from "$lib/simple-components/utils";

  type Tone = "attention" | "danger" | "intelligence";

  type Common = {
    title: string;
    /**
     * `attention` is something the reader has to deal with. `danger` is
     * something already lost or about to be. `intelligence` is the machine
     * saying it noticed.
     *
     * This is the one place a panel may use the danger role, which is what makes
     * it worth anything: a flank that shouts twice a session has stopped
     * shouting.
     */
    tone?: Tone;
  };

  /**
   * A statement that something is wrong, made inside a 300px column, with a way
   * to act on it.
   *
   * **Not `PanelNote tone="gap"`.** A gap note says the model cannot store this
   * — a permanent limitation of the surface, true before the reader arrived and
   * true after they leave. A banner says something *is* wrong right now, in this
   * project, about this thing, and here is what to do about it. Drawing the two
   * the same way teaches a reader to read past both.
   *
   * **Not `ScreenBanner`.** Same argument as `PanelEmpty`: the tones are that
   * component's and are kept, but the decision is resized. No count beside the
   * title — "affects 34 slides" set against a title in 276px leaves neither
   * enough room — and the controls sit under the text rather than beside it.
   *
   * **It always carries an action or a reason, and the type says so.** The props
   * are a union of "has an explanation" and "has controls", so a banner that
   * only worries will not compile. A worry with no way out and no reason given
   * is noise, and noise is what makes the next real one invisible.
   *
   * `simple-components/alert` underneath, for its `role="alert"` and its
   * icon-and-text grid. The registry's variants are default and destructive;
   * none of these three is either, so the tones are ours over its base.
   */
  let {
    title,
    tone = "attention",
    children,
    actions
  }:
    | (Common & { children: Snippet; actions?: Snippet })
    | (Common & { children?: Snippet; actions: Snippet }) = $props();

  /**
   * A different shape per tone, not only a different colour. A reader who
   * cannot separate the amber from the red still separates a triangle from a
   * circle, and the title says which it is in words on top of that.
   */
  const ICON = {
    attention: TriangleAlert,
    danger: CircleAlert,
    intelligence: Sparkles
  } as const;

  const TONE: Record<Tone, string> = {
    attention: "border-attention-border bg-attention-surface text-attention-text",
    danger: "border-danger-border bg-danger-surface text-danger-text",
    intelligence: "border-intelligence-border bg-intelligence-surface text-intelligence-text"
  };

  const Icon = $derived(ICON[tone]);
</script>

<Alert.Root class={cn("rounded-panel mx-3 items-start gap-x-2 p-2.5", TONE[tone])}>
  <Icon aria-hidden="true" />
  <Alert.Title class="text-body-sm font-medium">{title}</Alert.Title>
  {#if children}
    <Alert.Description class="text-caption text-current">
      {@render children()}
    </Alert.Description>
  {/if}
  {#if actions}
    <!-- Under the text, in the second column: a 276px panel has no room for a
         control beside a sentence, and wrapping is what `PanelActions` already
         decided a row of panel controls does. -->
    <div class="col-start-2 flex flex-wrap gap-1 pt-1.5">{@render actions()}</div>
  {/if}
</Alert.Root>
