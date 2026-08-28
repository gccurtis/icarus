<script lang="ts">
	import * as Carousel from "$vendored-components/carousel";
	import { cn } from "$vendored-components/utils";
	import { traceNode } from "$development-components/trace.svelte";
	import type { Snippet } from "svelte";

	let {
		class: className,
		gap = 16,
		children,
	}: { class?: string; gap?: number; children?: Snippet } = $props();

	// The root is `Carousel.Item`, a component rather than an element, so nothing marks the DOM.
	const trace = traceNode("CarouselShelfItem", () => ({ gap }));
</script>

<!--
	A card on the shelf. `surface-elevated` is the raised plane — the lightest
	surface in Celestial and the lightest black in Cyberpunk — so it reads as
	sitting above the well rather than cut into it, in either theme.

	`basis-auto` replaces the carousel's default of one card per window, so the
	card's own width decides how many are visible.
-->
<Carousel.Item class="basis-auto" style="padding-left: {gap}px">
	<div
		class={cn(
			"bg-surface-elevated border-border-subtle rounded-panel shadow-raised border",
			className
		)}
	>
		{@render children?.()}
	</div>
</Carousel.Item>
