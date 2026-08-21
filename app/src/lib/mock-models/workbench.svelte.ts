/**
 * The workbench, as much of it as a panel needs and no more.
 *
 * `$model/client` already holds the real one, but reaching it requires a client
 * instance, which requires the `/app/[project]` layout to have run. A panel
 * rendered anywhere else — a gallery, a test, a review page — would throw before
 * it painted.
 *
 * This is the same three questions that object answers, over module `$state`:
 * what is inspected, what is selected inside the centre, and which project we are
 * in. A module singleton is safe for the same reason it is safe there — there is
 * no second person inside a browser tab to leak to.
 *
 * **The key vocabularies are wider here than in the real model.** `CONTEXT_IDS`
 * has sixteen members on `main` and the specifications describe fifty; the same
 * is true of inspection. Panels are written against the vocabulary the
 * specifications use, and the real model widens to meet it rather than the panels
 * narrowing to fit.
 */
import { PROJECT } from "$mock-capabilities/cast";

/**
 * What the inspector is showing, as a namespaced label and nothing more.
 *
 * The prefix before the dot names the family and the suffix names the lens, which
 * is exactly how the real `InspectionKey` reads. It is a `string` rather than a
 * union because a union here would have to be kept in step with ninety files by
 * hand, and a stale union is a compile error in the wrong place.
 */
export type InspectionKey = string;

/** What is selected in the centre. One id and what kind of thing it is. */
export type Selection = {
  readonly kind: string;
  readonly id: string;
};

let inspected = $state<InspectionKey>("empty");
let selection = $state<Selection | undefined>(undefined);
let contextId = $state<string>("project");

export const mockWorkbench = {
  /** The project every door is scoped to. */
  get project() {
    return PROJECT;
  },

  get inspected() {
    return inspected;
  },

  get selection() {
    return selection;
  },

  /** Which rail entry the context panel is on. */
  get contextId() {
    return contextId;
  },

  /**
   * Open a lens. Takes the selection with it where there is one, because the
   * inspector routes on the key and reads the detail from the selection — the
   * key never carries a payload of its own.
   */
  inspect(key: InspectionKey, selected?: Selection) {
    inspected = key;
    if (selected !== undefined) selection = selected;
  },

  selectContext(id: string) {
    contextId = id;
  },

  /** Nothing selected is a state, not an absence. */
  clear() {
    inspected = "empty";
    selection = undefined;
  }
};
