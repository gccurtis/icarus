<!--
  /demo — the design system reference.

  Minimal for now: it proves the route resolves and the stylesheet applies.
  The previous version rendered every token in the system and was the only
  thing that exercised `@theme static` in lib/style/system/color/roles.css.
  Rebuilding it is follow-up work; see docs/routing.md.
-->
<div class="mx-auto flex max-w-5xl flex-col gap-4 p-8">
  <h1 class="text-h1 font-semibold">Design system</h1>
  <p class="text-body text-ink-secondary max-w-[70ch]">
    Every value on this page resolves through the palette. Nothing is hard-coded — each element
    reads a token, so the whole surface moves with the theme.
  </p>
</div>
