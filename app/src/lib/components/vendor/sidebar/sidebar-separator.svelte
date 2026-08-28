<script lang="ts">
	import { Separator } from "$lib/components/vendor/separator/index.js";
	import { cn } from "$lib/components/vendor/utils.js";
	import type { ComponentProps } from "svelte";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: ComponentProps<typeof Separator> = $props();
</script>

<Separator
	bind:ref
	data-slot="sidebar-separator"
	data-sidebar="separator"
	class={cn("mx-2 bg-sidebar-border w-auto", className)}
	{...restProps}
/>
