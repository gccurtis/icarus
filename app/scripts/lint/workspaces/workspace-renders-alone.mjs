import { check } from "../shared/check.mjs";
import { renderAll } from "../shared/render.mjs";
import { workspaceFiles } from "../shared/trees.mjs";
import { RENDER_PROPS } from "../shared/views.mjs";

export default check({
  name: "workspace-renders-alone",
  says: "Server-renders with an empty prop bag, like a panel.",
  run(tree) {
    return renderAll(tree, workspaceFiles(tree).map(({ path }) => path), RENDER_PROPS);
  }
});
