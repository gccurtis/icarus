<script lang="ts">
  import { NumberField } from '$lib/components';
  import { cn } from '$lib/utils';
  import { editorSession } from '../../../editor/session';

  // "Line spacing" is the row's height increase above the standard row height, in
  // whole points: 0 = tight/default, up to layoutRules.maxHeightIncrease. The lens
  // names the rows; an empty list means the control has nothing to write to.
  let { rowKeys, divided = false }: { rowKeys: string[]; divided?: boolean } = $props();

  let lineSpacing = $state<number>(0);
  let lineSpacingFor = $state('');

  const standardHeightPt = $derived(
    $editorSession
      ? $editorSession.layoutRules.maxFontHeight + 2 * $editorSession.layoutRules.minRowPadding
      : 32
  );
  const maxSpacing = $derived($editorSession?.layoutRules.maxHeightIncrease ?? 144);

  // Seed from the modelled row height, re-reading when the target rows or their
  // heights change (so an undo or a reload is reflected).
  $effect(() => {
    const modeledHeights = rowKeys.map((rowKey) => $editorSession?.rowHeights[rowKey]);
    const key = `${rowKeys.join(':')}:${modeledHeights.join(':')}`;
    if (key !== lineSpacingFor) {
      lineSpacingFor = key;
      const px = modeledHeights[0];
      lineSpacing =
        px == null
          ? 0
          : Math.min(maxSpacing, Math.max(0, Math.round((px * 72) / 96) - standardHeightPt));
    }
  });

  function changeSpacing(value: number) {
    lineSpacing = Math.min(maxSpacing, Math.max(0, value || 0));
    const totalPx = Math.round(((standardHeightPt + lineSpacing) * 96) / 72);
    $editorSession?.actions.setRowHeight(rowKeys, totalPx);
  }
</script>

<div class={cn('flex items-center justify-between gap-3', divided && 'border-t border-border pt-3')}>
  <span class="flex items-center gap-2 text-caption text-secondary"> Line spacing </span>
  <NumberField
    bind:value={lineSpacing}
    ariaLabel="Line spacing"
    min={0}
    max={maxSpacing}
    step={1}
    class="w-20"
    onchange={changeSpacing}
  />
</div>
