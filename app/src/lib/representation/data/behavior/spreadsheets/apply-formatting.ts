import type {
  FormatRule,
  SheetPrint,
  SpreadsheetBody
} from "$representation/data/types/spreadsheets/body";
import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import type { CellStyle } from "$representation/data/types/spreadsheets/style-set";
import {
  insertAfter,
  refuse,
  setDeep,
  withBody,
  withField,
  withoutIds,
  type ListOp,
  type SetOp
} from "$representation/data/behavior/spreadsheets/editing";

export const setRule = (sheet: LiveSheet, op: SetOp): LiveSheet => {
  const [word, id, ...fields] = op.path.split("/");
  if (word !== "formatRules" || !id || fields.length === 0) {
    refuse(op, "a rule path is formatRules/<id>/<field…>");
  }
  const rules = sheet.body.formatRules;
  const at = rules.findIndex((rule) => rule.id === id);
  if (at === -1) refuse(op, `no rule ${id}`);
  const next = rules.map((rule, index) =>
    index === at ? (setDeep(rule, fields, op.value) as FormatRule) : rule
  );
  return withBody(sheet, { ...sheet.body, formatRules: next });
};

export const listRules = (sheet: LiveSheet, op: ListOp): LiveSheet => {
  if (op.path !== "formatRules") refuse(op, "rules are inserted and removed at formatRules");
  if (op.op === "insert") {
    const values = op.values as FormatRule[];
    if (values.length !== op.ids.length || values.some((rule, index) => rule.id !== op.ids[index])) {
      refuse(op, "ids and values disagree");
    }
    if (values.some((rule) => sheet.body.formatRules.some((held) => held.id === rule.id))) {
      refuse(op, "a rule with that id is already there");
    }
    return withBody(sheet, {
      ...sheet.body,
      formatRules: insertAfter(sheet.body.formatRules, op.after, values, op)
    });
  }
  return withBody(sheet, {
    ...sheet.body,
    formatRules: withoutIds(sheet.body.formatRules, op.ids, op)
  });
};

export const setSheet = (sheet: LiveSheet, op: SetOp): LiveSheet => {
  const [root, ...rest] = op.path.split("/");
  const body = sheet.body;

  if (root === "frozenRows" || root === "frozenColumns") {
    if (rest.length > 0) refuse(op, `${root} is one number`);
    if (
      op.value !== null &&
      (typeof op.value !== "number" || !Number.isInteger(op.value) || op.value < 0)
    ) {
      refuse(op, "a frozen count is a whole number");
    }
    return withBody(sheet, withField(body, root, op.value));
  }

  if (root === "print") {
    if (rest.length === 0 && (op.value === null || typeof op.value !== "object")) {
      refuse(op, "print is set whole as an object or by field");
    }
    return withBody(sheet, { ...body, print: setDeep(body.print, rest, op.value) as SheetPrint });
  }

  if (root === "styles") {
    const [which, key, ...fields] = rest;
    if (which === "defaultKey" && key === undefined) {
      const defaultKey = typeof op.value === "string" ? op.value : undefined;
      if (defaultKey === undefined || !(defaultKey in body.styles.styles)) {
        return refuse(op, "the default names a style that exists");
      }
      return withBody(sheet, { ...body, styles: { ...body.styles, defaultKey } });
    }
    if (which === "styles" && key !== undefined && fields.length > 0) {
      const held = body.styles.styles[key];
      if (held === undefined) refuse(op, `no style ${key}`);
      const next = setDeep(held, fields, op.value) as CellStyle;
      return withBody(sheet, {
        ...body,
        styles: { ...body.styles, styles: { ...body.styles.styles, [key]: next } }
      });
    }
    refuse(op, "a style path is styles/defaultKey or styles/styles/<key>/<field>");
  }

  if (root === "rows" || root === "columns") {
    const [id, field, ...more] = rest;
    const size = root === "rows" ? "height" : "width";
    if (!id || field !== size || more.length > 0) refuse(op, `${root}/<id>/${size}`);
    if (op.value !== null && (typeof op.value !== "number" || op.value <= 0)) {
      refuse(op, "a size is a positive number");
    }
    const list = body[root];
    if (!list.some((entry) => entry.id === id)) refuse(op, `no ${root} entry ${id}`);
    const next = list.map((entry) => (entry.id === id ? withField(entry, size, op.value) : entry));
    return withBody(sheet, { ...body, [root]: next } as SpreadsheetBody);
  }

  return refuse(op, "not a field of the sheet");
};

export const listStyles = (sheet: LiveSheet, op: ListOp): LiveSheet => {
  if (op.path !== "styles") refuse(op, "styles are the one list on the sheet");
  const styles = { ...sheet.body.styles.styles };
  if (op.op === "insert") {
    const values = op.values as CellStyle[];
    if (values.length !== op.ids.length) refuse(op, "ids and values disagree");
    for (const [index, key] of op.ids.entries()) {
      if (styles[key] !== undefined) refuse(op, `a style ${key} is already there`);
      styles[key] = values[index];
    }
  } else {
    for (const key of op.ids) {
      if (styles[key] === undefined) refuse(op, `no style ${key} to remove`);
      if (key === sheet.body.styles.defaultKey) refuse(op, "the default style stays");
      if (sheet.body.formatRules.some((rule) => rule.style === key)) {
        refuse(op, `a rule still names ${key}`);
      }
      delete styles[key];
    }
  }
  return withBody(sheet, { ...sheet.body, styles: { ...sheet.body.styles, styles } });
};
