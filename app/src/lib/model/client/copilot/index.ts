/**
 * The entry for Copilot.
 *
 * The composition root takes the constructor; the dock and the inspector take
 * the types. `Selector`, `ResourceSetExpression` and `ResourceRef` are not
 * re-exported — they are `$shared`'s, and a second path to them would let this
 * object look like their owner.
 */
export { createCopilot } from "$model/client/copilot/constructor";
export type {
  Attachment,
  Blocked,
  CopilotModel,
  Destination,
  LinkAttachment,
  Mode
} from "$model/client/copilot/types";
