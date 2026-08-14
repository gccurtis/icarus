import type { InspectorView } from "$runtime/client/inspector/types";
import Placeholder from "$runtime/client/inspector/views/placeholder.svelte";
import type { InspectionNode } from "$runtime/client/workbench";

/**
 * Inspection kind → the view that inspects it.
 *
 * Keyed on kind alone rather than on (resource kind, inspection kind). Most
 * members of the union are already resource-qualified by name, and the ones that
 * are not — `formula`, `prompt` — are shared capabilities the server models in
 * their own right. One formula view serves a formula wherever it was inspected
 * from, which a per-resource map would force us to duplicate.
 *
 * `Record<InspectionNode["kind"], …>` rather than a partial map: adding a member
 * to the union fails to compile until it has a view, so an inspection can never
 * reach the panel with nothing to render.
 *
 * **Frozen, and process-wide.** An immutable map of stateless component
 * references, which is what makes module scope safe for it where it is not safe
 * for anything holding user state. That stops being true the day this gains a
 * `register()`.
 */
export const INSPECTOR_VIEWS: Record<InspectionNode["kind"], InspectorView> = Object.freeze({
  empty: Placeholder,
  "document-next-text": Placeholder,
  "document-text-selection": Placeholder,
  "document-table": Placeholder,
  formula: Placeholder,
  prompt: Placeholder
});
