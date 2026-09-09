<script lang="ts">
  import Construction from "@lucide/svelte/icons/construction";

  import { ScreenEmpty, ScreenSurface } from "$authored-components/screen";
</script>

<div data-category-readiness="unavailable" class="h-full min-h-0">
  <ScreenSurface>
    <ScreenEmpty title="The Context editor is not available yet" icon={Construction}>
      Contexts remain represented, but there is no editor workflow to open until its durable
      authoring contract is implemented.
    </ScreenEmpty>
  </ScreenSurface>
</div>
