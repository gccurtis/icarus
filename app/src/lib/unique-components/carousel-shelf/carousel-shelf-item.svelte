<script lang="ts">
	import * as Carousel from "$lib/simple-components/carousel";
	import { cn } from "$lib/simple-components/utils";
	import type { Snippet } from "svelte";

	let {
		class: className,
		gap = 16,
		children,
	}: { class?: string; gap?: number; children?: Snippet } = $props();
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
