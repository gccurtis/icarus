import { check } from "../shared/check.mjs";
import { renderAll } from "../shared/render.mjs";
import { panelLeaves } from "../shared/trees.mjs";
import { RENDER_PROPS } from "../shared/views.mjs";

export default check({
  name: "panel-renders-alone",
  says: "Every leaf server-renders with an empty prop bag. No client instance, no route, no parent threading content down.",
  run(tree) {
    const leaves = panelLeaves(tree)
      .filter(({ path }) => path.endsWith(".svelte"))
      .map(({ path }) => path);
    return renderAll(tree, leaves, RENDER_PROPS);
  }
});
