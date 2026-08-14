<script lang="ts">
	import * as ResizablePrimitive from "paneforge";
	import { cn, type WithoutChildrenOrChild } from "$lib/simple-components/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		withHandle = false,
		...restProps
	}: WithoutChildrenOrChild<ResizablePrimitive.PaneResizerProps> & {
		withHandle?: boolean;
	} = $props();
</script>

<ResizablePrimitive.PaneResizer
	bind:ref
	data-slot="resizable-handle"
	class={cn(
		"cn-resizable-handle group/handle relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-2 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-hidden data-[direction=vertical]:h-px data-[direction=vertical]:w-full data-[direction=vertical]:after:left-0 data-[direction=vertical]:after:h-2 data-[direction=vertical]:after:w-full data-[direction=vertical]:after:translate-x-0 data-[direction=vertical]:after:-translate-y-1/2 [&[data-direction=vertical]>div]:rotate-90",
		// The drag affordance. Without this the handle is a hairline that looks
		// identical whether or not the pointer can act on it, so the only way to
		// discover it is to guess. `interactive` is the role for "can be acted
		// upon": cursor and color change together, exactly when the pointer
		// enters the hit area. That area is widened from 4px to 8px here — a cue
		// you have to hunt for is not much of a cue.
		"cursor-col-resize transition-colors duration-micro ease-standard hover:bg-interactive-border active:bg-interactive-fill data-[direction=vertical]:cursor-row-resize",
		className
	)}
	{...restProps}
>
	{#if withHandle}
		<div
			class="bg-border group-hover/handle:bg-interactive-border group-active/handle:bg-interactive-fill duration-micro ease-standard z-10 flex h-6 w-1 shrink-0 rounded-lg transition-colors"
		></div>
	{/if}
</ResizablePrimitive.PaneResizer>
