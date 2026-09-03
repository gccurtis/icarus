/**
 * What a surface is made of.
 *
 * Five concerns, each declaring by extension what its entries are. `shared/` has
 * no extension of its own because what belongs there is whatever two other
 * concerns both needed, and that can be either kind.
 */
export const CONCERN_EXTENSIONS = {
  components: ".svelte",
  interactions: ".ts",
  effects: ".svelte.ts",
  procedures: ".ts",
  shared: null
};

/**
 * Names that mean a decision was avoided rather than made.
 *
 * `utils`/`helpers`/`common`/`lib` are the drawer `procedures/` exists to
 * prevent; `handlers` names events where `interactions/` names intent. The last
 * three are required filenames in the model tree, so any of them here is an
 * object with a real lifetime written inside a surface that cannot hold one.
 */
export const BANNED = new Map([
  ["utils", "a named procedure belongs in procedures/"],
  ["helpers", "a named procedure belongs in procedures/"],
  ["common", "a named procedure belongs in procedures/"],
  ["lib", "a named procedure belongs in procedures/"],
  ["handlers", "interactions/ names intent, not events"],
  ["containers", "a component is a component"],
  ["stores", "state declares a lifetime — a component, shared/, or $model/client"],
  ["store.ts", "state declares a lifetime — a component, shared/, or $model/client"],
  ["state.svelte.ts", "state declares a lifetime — a component, shared/, or $model/client"],
  ["index.ts", "a surface has one entry and <surface>.svelte already names it"],
  ["definition.ts", "a definition is a model object; a surface holds no lifetime"],
  ["constructor.ts", "a constructor is a model object; a surface holds no lifetime"]
]);
