import { defineSchema } from "convex/server";
import { accessTables } from "$access/schema";
import { activityTables } from "$activity/schema";
import { commentsTables } from "$comments/schema";
import { documentsTables } from "$documents/schema";
import { externalFilesTables } from "$external-files/schema";
import { findingsTables } from "$findings/schema";
import { hypothesesTables } from "$hypotheses/schema";
import { knowledgeTables } from "$knowledge/schema";
import { messagesTables } from "$messages/schema";
import { nameManagerTables } from "$name-manager/schema";
import { personaThreadsTables } from "$persona-threads/schema";
import { personasTables } from "$personas/schema";
import { questionsTables } from "$questions/schema";
import { researchLinksTables } from "$research-links/schema";
import { researchThreadsTables } from "$research-threads/schema";
import { resourceSetsTables } from "$resource-sets/schema";
import { revisionsTables } from "$revisions/schema";
import { settingsTables } from "$settings/schema";
import { slideDecksTables } from "$slide-decks/schema";
import { spreadsheetsTables } from "$spreadsheets/schema";
import { templatesTables } from "$templates/schema";

/**
 * The deployment's schema, composed from one fragment per capability.
 *
 * This file owns the *list* and nothing else. A capability declares its own
 * tables in its own `schema.ts`, so adding one does not mean editing a file that
 * describes every other capability's storage.
 *
 * The spread is what carries the table types through to `ctx.db`, so it has to
 * be written literally — a helper that merged them would erase what it merged.
 */
const tables = {
  ...accessTables,
  ...activityTables,
  ...commentsTables,
  ...documentsTables,
  ...externalFilesTables,
  ...findingsTables,
  ...hypothesesTables,
  ...knowledgeTables,
  ...messagesTables,
  ...nameManagerTables,
  ...personaThreadsTables,
  ...personasTables,
  ...questionsTables,
  ...researchLinksTables,
  ...researchThreadsTables,
  ...resourceSetsTables,
  ...revisionsTables,
  ...settingsTables,
  ...slideDecksTables,
  ...spreadsheetsTables,
  ...templatesTables
};

/**
 * A spread resolves a duplicate key by declaration order and says nothing. Two
 * capabilities claiming one table name is a design mistake, so count the names
 * declared against the names that survived and fail the push naming the
 * collision.
 *
 * The fragment list appears twice, and that is the cost of keeping the spread
 * literal. Adding a fragment to one and not the other makes this check pass
 * while claiming less than it should — it cannot produce a false failure.
 */
const declared = [
  accessTables,
  activityTables,
  commentsTables,
  documentsTables,
  externalFilesTables,
  findingsTables,
  hypothesesTables,
  knowledgeTables,
  messagesTables,
  nameManagerTables,
  personaThreadsTables,
  personasTables,
  questionsTables,
  researchLinksTables,
  researchThreadsTables,
  resourceSetsTables,
  revisionsTables,
  settingsTables,
  slideDecksTables,
  spreadsheetsTables,
  templatesTables
].flatMap((fragment) => Object.keys(fragment));
if (declared.length !== Object.keys(tables).length) {
  const duplicate = declared.find((name, index) => declared.indexOf(name) !== index);
  throw new Error(`Two capabilities define a table named '${duplicate}'`);
}

export default defineSchema(tables);
