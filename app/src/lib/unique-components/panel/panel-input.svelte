<script lang="ts">
  import { Input } from "$lib/simple-components/input";
  import { cn } from "$lib/simple-components/utils";

  /**
   * A field that is not editing anything yet.
   *
   * The third field shape, and the one the other two leave out. `PanelSearch`
   * contains what it filters, so its scope is the markup — which is exactly wrong
   * for a field whose text is going somewhere else entirely. `PanelEditableText`
   * edits a value that is already on screen beside it. A replace field is
   * neither: it holds a string the panel will *use*, against content it does not
   * contain and does not display.
   *
   * Find and replace is what brought it. So is a name being typed for something
   * that does not exist yet, and a filter whose results are in another region.
   *
   * **It never stands alone.** A bare field with no name is unusable, so `label`
   * is required and is the accessible name; give it a visible one with
   * `PanelField` where the placeholder is not enough on its own.
   */
  let {
    label,
    value = $bindable(""),
    placeholder,
    mono = false,
    disabled = false,
    flush = false,
    onenter
  }: {
    /** What is being typed. The accessible name, and never empty. */
    label: string;
    value?: string;
    placeholder?: string;
    /** For a value where the difference between two characters matters. */
    mono?: boolean;
    disabled?: boolean;
    /** Drop the panel gutter, for a field already inside a padded region. */
    flush?: boolean;
    /**
     * Enter was pressed. Present where the field has an obvious commit —
     * replace, add, go to. Absent where typing is the whole interaction and the
     * panel is reading `value` as it changes.
     */
    onenter?: (value: string) => void;
  } = $props();
</script>

<div class={cn("flex", flush ? "px-0" : "px-3")}>
  <Input
    bind:value
    {placeholder}
    {disabled}
    aria-label={label}
    class={cn("text-body-sm h-7", mono && "font-mono text-mono tabular-nums")}
    onkeydown={(event: KeyboardEvent) => {
      if (event.key === "Enter" && onenter) {
        event.preventDefault();
        onenter(value);
      }
    }}
  />
</div>
