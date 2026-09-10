export const CORE_GATES = [
  {
    path: ["representation", "data", "behavior", "core", "stored.ts"],
    name: "stored-value-own-fields",
    required: /export const hasExactFields[\s\S]*?const fields = Reflect\.ownKeys\(value\);[\s\S]*?typeof field === "string"/,
    message: "stored-value admission ignores non-enumerable or symbolic own fields"
  },
  {
    path: ["representation", "data", "behavior", "core", "resource-set-rows.ts"],
    name: "resource-set-owner-exactness",
    required: /owner\.kind === "resource"[\s\S]*?exact\(owner, \["kind", "ref", "hole"\]\)[\s\S]*?ref: admitResourceRef\(owner\.ref/,
    forbidden: /owner\.resourceId/,
    message: "private Resource Set owners do not require the exact nominal current ResourceRef arm"
  },
  {
    path: ["representation", "data", "behavior", "core", "test", "unit", "resource-set.test.ts"],
    name: "resource-set-owner-exactness-contract",
    required: /admits exact private ownership only through the private row boundary[\s\S]*?resourceId: "documents:one"[\s\S]*?kind: "slides", id: "documents:one"/,
    message: "private Resource Set ownership lacks executable retired-shape and nominal-kind rejection proofs"
  },
  {
    path: ["representation", "data", "behavior", "core", "stored-change-set.ts"],
    name: "slide-set-target",
    required: /if \(op\.op === "set"\) \{[\s\S]*?hasExactFields\(op, \["op", "target", "path", "value", "was"\]\)[\s\S]*?isStoredChoice\(op\.target, contract\.setTargets\)/,
    forbidden: /setTargetOptional/,
    message: "stored set operations can omit their exact closed target discriminator"
  }
];
