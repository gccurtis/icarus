import { v } from "convex/values";
import { projectMutation, projectQuery } from "$convex/functions";
import { create as createSpreadsheet } from "$spreadsheets/api/create/create";
import { list as listSpreadsheets } from "$spreadsheets/api/list/list";
import { remove as removeSpreadsheet } from "$spreadsheets/api/remove/remove";
import { rename as renameSpreadsheet } from "$spreadsheets/api/rename/rename";

/**
 * Spreadsheets' public surface — `api.capabilities.spreadsheets.*`.
 *
 * Everything a browser can do to a workbook's metadata, and nothing it can do to
 * its grid: adding a sheet, setting a cell, and renaming a sheet are all
 * `revisions.submit`, because all three are edits an undo has to reach.
 */
export const list = projectQuery({
  args: {},
  handler: (ctx) => listSpreadsheets(ctx, ctx.scope)
});

export const create = projectMutation({
  args: { title: v.string(), templateId: v.optional(v.string()) },
  handler: (ctx, args) => createSpreadsheet(ctx, ctx.scope, args.title, args.templateId)
});

export const rename = projectMutation({
  args: { spreadsheetId: v.id("spreadsheets"), title: v.string() },
  handler: (ctx, args) => renameSpreadsheet(ctx, ctx.scope, args.spreadsheetId, args.title)
});

export const remove = projectMutation({
  args: { spreadsheetId: v.id("spreadsheets") },
  handler: (ctx, args) => removeSpreadsheet(ctx, ctx.scope, args.spreadsheetId)
});
