import { getContext, hasContext, onDestroy, setContext } from "svelte";

/**
 * What a panel is actually made of, while it is running.
 *
 * The review pages ask a question no static reading answers: given this state,
 * which components got rendered, and what was each one handed? A source parse
 * gets the first half — it can see `<PanelField label={variable.name} />` — and
 * cannot get the second, because `variable.name` only has a value once something
 * has run.
 *
 * So every primitive in `unique-components/` registers itself. The cost is one
 * line each; what it buys is that the composition tree on a review page is the
 * real one, with the real values, rather than a drawing of what the source said.
 *
 * **It is a no-op unless someone is watching.** `traceNode` looks for a run in
 * context and returns immediately when there is none, which is every case except
 * a review page. Nothing is allocated and nothing is recorded in the application.
 *
 * **Props are a thunk, not a snapshot.** A destructured `$props()` stays reactive
 * in runes mode, so a closure over it re-reads. Recording the values at init
 * would freeze the tree at first render, which is exactly the moment before the
 * reader changes anything.
 */

/**
 * A class rather than an object literal, because `children` has to be `$state`
 * and a rune cannot initialise a property inside a literal. The reactivity has
 * to be on the property for a tree that grows as an `{#each}` fills.
 */
export class TraceNode {
  readonly id: string;
  /** The component's exported name — `PanelField`, `ScreenRow`. */
  readonly name: string;
  /** Read at display time, so the values are current. */
  readonly props: () => Record<string, unknown>;
  children = $state<TraceNode[]>([]);

  constructor(name: string, props: () => Record<string, unknown>) {
    this.id = `t${(counter += 1)}`;
    this.name = name;
    this.props = props;
  }
}

export type TraceRun = {
  readonly root: TraceNode;
  /** Empty the tree, for a remount. */
  reset: () => void;
};

const KEY = Symbol.for("icarus.trace");

let counter = 0;

/**
 * Start a run. The review page owns one and hands it down; nothing else calls
 * this, which is what keeps the tracing off everywhere else.
 */
export const createTrace = (): TraceRun => {
  const root = new TraceNode("root", () => ({}));
  return {
    root,
    reset: () => {
      root.children.length = 0;
    }
  };
};

/** Put a run in context, so everything below it registers into that tree. */
export const provideTrace = (run: TraceRun): void => {
  setContext(KEY, run.root);
};

/**
 * Register this component, and become the parent of everything under it.
 *
 * Returns the attributes to spread on the component's root element. A traced
 * node that also marks its DOM is what lets a review page point at a name on the
 * right and light up the thing it drew on the left — and, for a workspace, work
 * out which grid area each component landed in without anyone writing that down.
 */
export const traceNode = (
  name: string,
  props: () => Record<string, unknown> = () => ({})
): Record<string, string> => {
  if (!hasContext(KEY)) return {};

  const parent = getContext<TraceNode>(KEY);
  const self = new TraceNode(name, props);
  parent.children.push(self);
  setContext(KEY, self);

  // An `{#each}` that drops a row must drop its node too, or the tree grows
  // every time a filter narrows.
  //
  // **Browser only, and that is not an optimisation.** `onDestroy` is the one
  // lifecycle that also runs on the server, at the end of the render — so
  // registering it there unwinds the whole tree the moment it is finished, and a
  // node test reads an empty root while the markup it just produced is full of
  // markers.
  if (typeof window !== "undefined") {
    onDestroy(() => {
      const at = parent.children.indexOf(self);
      if (at >= 0) parent.children.splice(at, 1);
    });
  }

  return { "data-trace": self.id };
};

/** Everything a node was handed, minus what a reader cannot be shown. */
export const readableProps = (node: TraceNode): [string, unknown][] =>
  Object.entries(node.props()).filter(([, value]) => typeof value !== "function");

/** The snippets and callbacks, named. What they do is the caller's business. */
export const behaviourProps = (node: TraceNode): string[] =>
  Object.entries(node.props())
    .filter(([, value]) => typeof value === "function")
    .map(([key]) => key);
