export const EDITORS_GATES = [
  {
    path: ["capabilities", "document", "api", "read-document-body", "validate-read-document-body.ts"],
    name: "document-read-command-exactness",
    required: /storedFields\(input\)[\s\S]*?hasExactFields\(fields, \["resourceId"\]\)[\s\S]*?isStoredRowId\(fields\.resourceId, "documents"\)/,
    message: "document read admission does not require one exact plain command and nominal document id"
  },
  {
    path: ["capabilities", "document", "api", "submit-document-changes", "validate-submit-document-changes.ts"],
    name: "document-submit-command-exactness",
    required: /storedFields\(input\)[\s\S]*?hasExactFields\(envelope, \["changeSet"\]\)[\s\S]*?storedFields\(envelope\.changeSet\)[\s\S]*?hasExactFields\(changeSet, \["resourceId", "baseRevision", "ops", "touched"\]\)[\s\S]*?isStoredRowId\(changeSet\.resourceId, "documents"\)[\s\S]*?isStoredNatural\(changeSet\.baseRevision\)[\s\S]*?isStoredJson\(changeSet\.ops\)[\s\S]*?every\(isStoredDocumentOp\)[\s\S]*?isStoredJson\(changeSet\.touched\)[\s\S]*?matchingTouched\(changeSet\.ops, changeSet\.touched\)/,
    message: "document submit admission does not require its exact current envelope, operations, paths, and nominal id"
  },
  {
    path: ["representation", "data", "behavior", "documents", "stored-rows.ts"],
    name: "document-operation-exactness",
    required: /export const isStoredDocumentOp[\s\S]*?isStoredJson\(value\)[\s\S]*?isStoredChangeSetOperation\(value, CHANGE_SET_CONTRACT\)[\s\S]*?value\.ids\.length > 0[\s\S]*?value\.values\.length === value\.ids\.length/,
    message: "document operation admission can accept a lossy or cardinality-incoherent current arm"
  },
  {
    path: ["capabilities", "document", "test", "unit", "command-admission.test.ts"],
    name: "document-command-exactness-contract",
    required: /admits only the nominal current read command[\s\S]*?does not execute an accessor while refusing it[\s\S]*?admits one exact envelope, change set, and operation union arm[\s\S]*?requires list payload cardinality and exact touched first-use order/,
    message: "document commands lack an executable exact-own-key, nominal-id, operation, and path contract"
  },
  {
    path: ["capabilities", "presentation", "api", "read-presentation-body", "validate-read-presentation-body.ts"],
    name: "slide-read-command-exactness",
    required: /storedFields\(input\)[\s\S]*?hasExactFields\(fields, \["resourceId"\]\)[\s\S]*?isStoredRowId\(fields\.resourceId, "presentations"\)/,
    message: "slide read admission does not require one exact plain command and nominal presentation id"
  },
  {
    path: ["capabilities", "presentation", "api", "submit-presentation-changes", "validate-submit-presentation-changes.ts"],
    name: "slide-submit-command-exactness",
    required: /storedFields\(input\)[\s\S]*?hasExactFields\(envelope, \["changeSet"\]\)[\s\S]*?storedFields\(envelope\.changeSet\)[\s\S]*?hasExactFields\(changeSet, \["resourceId", "baseRevision", "ops", "touched"\]\)[\s\S]*?isStoredRowId\(changeSet\.resourceId, "presentations"\)[\s\S]*?isStoredNatural\(changeSet\.baseRevision\)[\s\S]*?isStoredJson\(changeSet\.ops\)[\s\S]*?every\(isStoredPresentationOp\)[\s\S]*?isStoredJson\(changeSet\.touched\)[\s\S]*?matchingTouched\(changeSet\.ops, changeSet\.touched\)/,
    message: "slide submit admission does not require its exact current envelope, operations, paths, and nominal id"
  },
  {
    path: ["representation", "data", "behavior", "presentations", "stored-rows.ts"],
    name: "slide-operation-exactness",
    required: /export const isStoredPresentationOp[\s\S]*?isStoredJson\(value\)[\s\S]*?isStoredChangeSetOperation\(value, CHANGE_SET_CONTRACT\)[\s\S]*?value\.ids\.length > 0[\s\S]*?value\.values\.length === value\.ids\.length/,
    message: "slide operation admission can accept a lossy or cardinality-incoherent current arm"
  },
  {
    path: ["capabilities", "presentation", "test", "unit", "command-admission.test.ts"],
    name: "slide-command-exactness-contract",
    required: /admits only the nominal current read command[\s\S]*?does not execute an accessor while refusing it[\s\S]*?admits one exact envelope, change set, and operation union arm[\s\S]*?requires list payload cardinality and exact touched first-use order/,
    message: "slide commands lack an executable exact-own-key, nominal-id, operation, and path contract"
  },
  {
    path: ["capabilities", "variables", "api", "read-variables", "validate-read-variables.ts"],
    name: "variable-read-command-exactness",
    required: /storedFields\(input\)[\s\S]*?hasExactFields\(fields, \[\]\)/,
    message: "variable reads admit a nonempty or non-plain command"
  },
  {
    path: ["capabilities", "variables", "api", "save-variable", "validate-save-variable.ts"],
    name: "variable-save-command-exactness",
    required: /storedFields\(input\)[\s\S]*?hasExactFields\(fields, \["name", "value", "type"\], \["description"\]\)[\s\S]*?isStoredJson\(fields\.value\)[\s\S]*?currentFormulaValue\(fields\.value\)[\s\S]*?isStoredChoice\(fields\.type, TYPES\)/,
    message: "variable save admission does not require its exact current envelope and recursive value arm"
  },
  {
    path: ["capabilities", "variables", "api", "remove-variable", "validate-remove-variable.ts"],
    name: "variable-remove-command-exactness",
    required: /storedFields\(input\)[\s\S]*?hasExactFields\(fields, \["name"\]\)[\s\S]*?isStoredText\(fields\.name, 160\)/,
    message: "variable removal does not require one exact plain current name"
  },
  {
    path: ["capabilities", "variables", "test", "unit", "command-admission.test.ts"],
    name: "variable-command-exactness-contract",
    required: /requires the current exact empty read command[\s\S]*?requires the current exact save envelope[\s\S]*?does not execute an accessor while refusing it[\s\S]*?admits exact nested current values and nominal represented IDs[\s\S]*?rejects legacy, mixed, lossy, and wrongly namespaced nested values[\s\S]*?requires one exact plain remove name/,
    message: "variable commands lack an executable exact-own-key, nested-value, and nominal-id contract"
  }
];
