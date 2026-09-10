export const EXTERNAL_GATES = [
  {
    path: ["model", "server", "external-file-storage", "methods", "shared", "validation.ts"],
    name: "native-storage-own-fields",
    required: /const prototype = Object\.getPrototypeOf\(value\);[\s\S]*?const keys = Reflect\.ownKeys\(value\);[\s\S]*?prototype !== Object\.prototype && prototype !== null[\s\S]*?keys\.length !== fields\.length[\s\S]*?keys\.some\(\(key\) => typeof key !== "string" \|\| !fields\.includes\(key\)\)[\s\S]*?Object\.getOwnPropertyDescriptor\(value, field\)[\s\S]*?descriptor === undefined[\s\S]*?!\("value" in descriptor\)[\s\S]*?!descriptor\.enumerable[\s\S]*?descriptor\.value === undefined/,
    message: "native External storage does not reject custom prototypes, accessors, undefined values, or every unknown own field"
  },
  {
    path: ["model", "server", "external-file-storage", "methods", "shared", "validation.ts"],
    name: "native-storage-reference",
    required: /const validateRef[\s\S]*?exactObject\(\s*ref,\s*\["storageId", "hash", "size"\],\s*"external file storage reference"\s*\)/,
    message: "native External storage references do not require the exact current shape"
  },
  {
    path: ["model", "server", "external-file-storage", "methods", "shared", "validation.ts"],
    name: "native-storage-claim",
    required: /const validateClaim[\s\S]*?exactObject\(\s*claim,\s*\["storageId", "hash", "size", "ownerId"\],\s*"external file storage claim"\s*\)/,
    message: "native External storage claims do not require the exact current shape"
  }
];
