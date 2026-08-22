<script lang="ts">
	import * as Carousel from "$lib/simple-components/carousel";
	import { cn, type WithElementRef } from "$lib/simple-components/utils";
	import { traceNode } from "$lib/trace/trace.svelte";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		gap = 16,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & { gap?: number } = $props();

	const trace = traceNode("CarouselShelf", () => ({ gap }));
</script>

<!--
	A recessed shelf: cards sit in a well cut into the page and travel under a
	frame that overhangs them on every side.

	The motion is `simple-components/carousel` unmodified — embla already owns
	looping, dragging, keyboard, and the disabled state of the two buttons. What
	is engineered here is the container: the well, the frame, and the overhang.
	That split is why this is a unique component and the carousel is a simple
	one.
-->
<div
	{...trace}
	bind:this={ref}
	data-slot="carousel-shelf"
	class={cn("relative", className)}
	{...restProps}
>
	<!--
		Drag physics are embla's, and most of them are not options. Reading its
		source, a release computes:

		    rawForce = releaseVelocity * (dragFree ? 500 : 300)
		    speed    = (dragFree ? 43 : 25) - 10 * forceFactor
		    friction = 0.68 + forceFactor / 50

		Every constant there is hard-coded, and `dragFree` is the only handle on
		any of them. Snapped dragging clamps a throw to one card and pulls any
		shorter drag back to where it started, which reads as stuck; free dragging
		lets the shelf go where it was thrown. Free wins — a shelf is a surface
		you push, not a control with detents.

		`duration` does not participate in a drag at all: a release overwrites it
		with `speed` above. It governs the two buttons and any programmatic
		scroll, and there it is worth matching to the system. It is an attraction
		divisor, not milliseconds, running `v += (target - loc) / duration;
		v *= 0.68; loc += v` each frame. Simulating that at 60fps over a card's
		pitch, embla's default of 25 settles in ~900ms, far outside a scale whose
		slowest step is 260ms; 12 lands at 217ms, within a frame of
		`--token-motion-panel`, and a carousel step is the same kind of movement
		as a tab change.
	-->
	<Carousel.Root
		opts={{ align: "start", loop: true, containScroll: false, dragFree: true, duration: 12 }}
	>
		<!--
			The well. `surface-panel` is the recessed plane in both themes: darker
			than the page in Celestial, deeper black in Cyberpunk. Cards take the
			raised plane, so the pairing survives a theme swap without a per-theme
			exception. Embla's viewport is `overflow-hidden`, so the shelf scrolls
			without ever showing a scrollbar.

			Vertical padding only. Embla clips at this element's padding box, so a
			horizontal inset would stop cards short of the frame and clip them
			against empty well instead of letting them travel under it — which is
			the whole effect. Looping means there is no start or end state for
			edge-to-edge cards to look wrong in.
		-->
		<!--
			`select-none` because a drag is a drag, not a text selection. Without
			it every pull highlights whatever the cursor crossed, and the shelf
			ends up smeared blue. Embla suppresses `dragstart` but cannot stop the
			browser's own selection, so it has to be refused in CSS.

			This does not cost clicks. Embla tracks how far the pointer travelled
			and only swallows the click when the drag was real, so a tap still
			reaches a button or link inside a card.
		-->
		<div
			class="bg-surface-panel border-border-subtle rounded-overlay border py-5 select-none"
		>
			<Carousel.Content class="-ms-0" style="margin-left: -{gap}px">
				{@render children?.()}
			</Carousel.Content>
		</div>

		<!--
			The frame's overhang, thrown inward onto whatever passes beneath it.
			Two techniques, because neither survives both polarities alone.

			The gradients do the work: each fades the well's own colour over the
			card at that edge, so a card dissolves into the frame rather than
			ending at it. Reading the well colour is what makes the effect follow
			a theme — it darkens in Cyberpunk and lightens in Celestial, which is
			what "behind the frame" looks like in each.

			The inset shadow adds the contact line right at the frame, and takes
			the `occlusion` colour because that is exactly the job it names. A
			flat black shadow was the first attempt and it was invisible in
			Cyberpunk, where the well is already near-black.

			Horizontal is heavier than vertical because that is the axis cards
			travel on. Negative spread keeps both effects a few pixels deep, so
			the centre of the shelf stays clean.
		-->
		<div
			aria-hidden="true"
			class="rounded-overlay pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--color-surface-panel),transparent_2.5rem),linear-gradient(to_left,var(--color-surface-panel),transparent_2.5rem)] shadow-[inset_10px_0_10px_-10px_var(--color-shadow-occlusion),inset_-10px_0_10px_-10px_var(--color-shadow-occlusion),inset_0_7px_9px_-9px_var(--color-shadow-occlusion),inset_0_-7px_9px_-9px_var(--color-shadow-occlusion)]"
		></div>

		<!--
			Buttons sit on the frame rather than outside it, so the shelf stays one
			rectangle on the page. They are painted after the overhang so the
			overhang cannot wash them out. `loop` keeps both permanently enabled.
		-->
		<Carousel.Previous class="start-2 z-10" />
		<Carousel.Next class="end-2 z-10" />
	</Carousel.Root>
</div>
