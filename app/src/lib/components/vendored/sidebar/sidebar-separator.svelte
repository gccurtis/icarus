<script lang="ts">
	import { Separator } from "$vendored-components/separator";
	import { cn } from "$vendored-components/utils";
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
