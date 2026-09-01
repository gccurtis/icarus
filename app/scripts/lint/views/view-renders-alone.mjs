import { check } from "../shared/check.mjs";
import { renderAll } from "../shared/render.mjs";
import { viewLeaves } from "../shared/trees.mjs";
import { RENDER_PROPS } from "../shared/views.mjs";

export default check({
  name: "view-renders-alone",
  says: "Every view server-renders with an empty prop bag. No client instance, no route, no parent threading content down.",
  run(tree) {
    return renderAll(tree, viewLeaves(tree).map(({ path }) => path), RENDER_PROPS);
  }
});
