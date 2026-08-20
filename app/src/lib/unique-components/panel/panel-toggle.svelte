<script lang="ts">
  import { Switch } from "$lib/simple-components/switch";

  /**
   * An on/off state inside a field.
   *
   * A switch rather than a checkbox, because every use of it here is a setting
   * that takes effect immediately — an Automation is on, a first page differs,
   * a tool is permitted — rather than a value submitted with a form.
   *
   * `simple-components/switch` at its small size, so the thumb motion, the focus
   * ring and the enlarged pointer target are bits-ui's rather than redrawn.
   *
   * **`label` is required, and it is the accessible name.** A switch with no
   * word beside it is still fully operable — it is in the tab order, Space and
   * Enter work it, and a screen reader announces the label — because the name is
   * on the control rather than in the markup next to it. Callers that can afford
   * the width put the word beside it as well; that is a layout decision, not an
   * accessibility one.
   *
   * **Read-only is a state, not an absence.** A toggle with no `onchange` is
   * disabled, because a switch that moves and changes nothing is worse than one
   * that does not move.
   */
  let {
    checked = false,
    label,
    disabled = false,
    onchange
  }: {
    checked?: boolean;
    /** What is being switched. Required — a switch with no name is unusable. */
    label: string;
    disabled?: boolean;
    onchange?: (next: boolean) => void;
  } = $props();
</script>

<Switch
  size="sm"
  {checked}
  aria-label={label}
  disabled={disabled || onchange === undefined}
  onCheckedChange={(next) => onchange?.(next)}
/>
