/**
 * The error Name Manager raises, and the codes it raises it with.
 *
 * At the capability root rather than in `types/` because a consumer catching one
 * is using the public contract. A code is a decision this capability made and
 * states; anything thrown without one is a fault, and the two are recorded
 * differently.
 *
 * The codes divide by what was wrong with the request. `invalid-name` is the
 * name itself; `name-conflict` is a name already taken. `invalid-type` is a
 * malformed declaration, `invalid-schema` a structurally impossible one — a
 * scalar with two fields, a type that contains itself — and `invalid-value` a
 * value that does not conform to a declaration that was otherwise fine.
 */
export type NameManagerErrorCode =
  | "invalid-name"
  | "name-conflict"
  | "invalid-type"
  | "invalid-schema"
  | "invalid-value"
  | "variable-not-found";

export class NameManagerError extends Error {
  constructor(
    readonly code: NameManagerErrorCode,
    message: string
  ) {
    super(message);
    this.name = "NameManagerError";
  }
}
