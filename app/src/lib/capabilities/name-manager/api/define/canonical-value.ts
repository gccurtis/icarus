import { NameManagerError } from "$name-manager/errors";
import { KIND_OF, type ValueType, type VariableValue } from "$name-manager/types/variable";

/**
 * The value as it will be stored, or a refusal that it is not the kind that was
 * declared.
 *
 * **Structural, and only structural.** Nothing here parses an expression,
 * resolves a reference, or computes anything: a variable holding a computed
 * result was computed by whoever called, and what arrives is the result. Declare
 * `number` and send a function and it is refused because it is not a number —
 * not because the call is wrong, which is a judgement this capability has no way
 * to make and no business making.
 */
export const canonicalValue = (declaredType: ValueType, value: VariableValue): VariableValue => {
  if (value.kind !== KIND_OF[declaredType]) {
    throw new NameManagerError(
      "type-mismatch",
      `Declared ${declaredType}, but the value is a ${value.kind}`
    );
  }
  return value;
};
