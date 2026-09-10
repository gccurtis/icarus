import { createHash, randomUUID } from "node:crypto";

export const publicationName = (hash: string): string =>
  `.publish.${hash}.${randomUUID()}.next`;

export const garbageName = (hash: string): string =>
  `.garbage.${hash}.${randomUUID()}.next`;

export const claimName = (hash: string, ownerId: string): string => {
  const owner = createHash("sha256").update(ownerId).digest("hex");
  return `.claim.${hash}.${owner}`;
};

export const publicationHash = (name: string): string | undefined =>
  /^\.publish\.([a-f0-9]{64})\.[0-9a-f-]{36}\.next$/.exec(name)?.[1];

export const garbageHash = (name: string): string | undefined =>
  /^\.garbage\.([a-f0-9]{64})\.[0-9a-f-]{36}\.next$/.exec(name)?.[1];
