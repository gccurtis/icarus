<script lang="ts">
  import { browser } from "$app/environment";

  import { clientModel, type CommandId } from "$model/client";
  import * as Command from "$lib/simple-components/command";
  import { Kbd } from "$lib/simple-components/kbd";

  /**
   * The command bar — every action this application can perform, by name.
   *
   * It reads the model rather than owning what it shows: whether it is open,
   * which commands exist, and which of them apply are all the model's, because
   * `command-bar.open` is itself a command and a chord has to reach the same
   * state this view does.
   *
   * **Display copy lives here**, because this is the surface that displays it.
   * A command id is stable and a label is not — rewording or translating one
   * must not change what a chord points at, which is the same split the tab bar
   * and the context panel already make.
   *
   * `Record<CommandId, …>` rather than a partial map, so a new command fails to
   * compile until it can be shown. There is no fallback label, deliberately: a
   * command nobody named would render as its own id, and an id is not English.
   */
  const COMMANDS: Record<CommandId, { label: string; description: string; keywords?: string }> = {
    "command-bar.open": {
      label: "Command bar",
      description: "Show or hide this list",
      keywords: "palette search commands"
    },
    "tab.close": {
      label: "Close tab",
      description: "Close the tab you are on",
      keywords: "shut dismiss"
    },
    "tab.next": {
      label: "Next tab",
      description: "Move one tab to the right, wrapping at the end"
    },
    "tab.previous": {
      label: "Previous tab",
      description: "Move one tab to the left, wrapping at the start"
    }
  };

  const { commands } = clientModel();

  /**
   * `$mod` is one binding and two glyphs. Guarded on `browser` because this
   * renders during SSR too, where there is no machine to ask — `Ctrl` is the
   * answer for every platform but one, so it is the one to be wrong about.
   */
  const modifier = $derived(browser && /mac|iphone|ipad/i.test(navigator.userAgent) ? "⌘" : "Ctrl");

  /**
   * Read through `enabled` rather than filtered by it, because a disabled
   * command is greyed rather than hidden: the list is how a person learns what
   * the application can do, and a row that appears only sometimes teaches
   * nothing.
   *
   * This tracks without subscribing. Each predicate reads the workbench's
   * `$state`, so switching tabs regreys the list on its own.
   */
  const rows = $derived(
    commands.ids.map((id) => ({
      id,
      ...COMMANDS[id],
      enabled: commands.enabled(id),
      chords: commands.bindingsFor(id)
    }))
  );

  const select = (id: CommandId) => {
    commands.hide();
    commands.run(id);
  };
</script>

<!--
  The dialog reports only one direction back. It opens because a command opened
  it, and Escape, a click away, and a selection all mean closed — so a bound
  `open` would let a stray close event race the command that just opened it.
-->
<Command.Dialog
  open={commands.open}
  onOpenChange={(next) => {
    if (!next) commands.hide();
  }}
  title="Command bar"
  description="Search for a command to run"
>
  <Command.Input placeholder="Type a command" />
  <Command.List>
    <Command.Empty>No commands found.</Command.Empty>
    <Command.Group heading="Commands">
      {#each rows as row (row.id)}
        <Command.Item
          value="{row.label} {row.keywords ?? ''}"
          disabled={!row.enabled}
          onSelect={() => select(row.id)}
        >
          <span class="label">{row.label}</span>
          <span class="description">{row.description}</span>

          <!--
            An unbound command renders nothing here rather than a placeholder.
            `tab.close` is the one that ships that way, so the column has to
            read correctly while empty.
          -->
          {#if row.chords.length > 0}
            <span class="chords">
              {#each row.chords as chord (chord)}
                {#each chord.split("+") as part (part)}
                  <Kbd>{part === "$mod" ? modifier : part}</Kbd>
                {/each}
              {/each}
            </span>
          {/if}
        </Command.Item>
      {/each}
    </Command.Group>
  </Command.List>
</Command.Dialog>

<style>
  .label {
    font-size: var(--token-text-body-sm);
    color: var(--token-ink-primary);
  }

  /* Secondary, and it stays secondary when the row is selected — the label is
   * what a person is scanning for. */
  .description {
    font-size: var(--token-text-caption);
    color: var(--token-ink-muted);
  }

  .chords {
    display: flex;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 1);
    margin-inline-start: auto;
  }
</style>
