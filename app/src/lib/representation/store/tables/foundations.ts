import type { MembershipRole } from "$representation/data/types/core/access";
import type { Actor } from "$representation/data/types/core/actor";
import type { Id, Row } from "$representation/data/types/core/id";
import type {
  ConnectorConfiguration,
  ConnectorCredential
} from "$representation/data/types/external/connector";
import type { ExternalFileOrigin, FileSubkind } from "$representation/data/types/external/file";

export type UserFields = {
  authSubject: string;
  displayName: string;
  email?: string;
  imageUrl?: string;
  settings: string;
  updatedAt: number;
};
export type User = Row<"users"> & UserFields;

export type ProjectFields = {
  name: string;
  description?: string;
  archivedAt?: number;
  revision: number;
  settings: string;
  updatedAt: number;
};
export type Project = Row<"projects"> & ProjectFields;

export type MembershipFields = {
  userId: Id<"users">;
  projectId: Id<"projects">;
  token: string;
  role: MembershipRole;
};
export type Membership = Row<"memberships"> & MembershipFields;

export type ConnectorFields = {
  projectId: Id<"projects">;
  name: string;
  configuration: ConnectorConfiguration;
  credential?: ConnectorCredential;
  refreshIntervalMs?: number;
  createdBy: Actor;
  updatedAt: number;
};
export type Connector = Row<"connectors"> & ConnectorFields;

export type ExternalFileFields = {
  projectId: Id<"projects">;
  name: string;
  originalName: string;
  relativePath: string;
  mediaType: string;
  subkind: FileSubkind;
  storageId: Id<"_storage">;
  hash: string;
  size: number;
  origin: ExternalFileOrigin;
  createdBy: Actor;
  updatedBy: Actor;
  semanticContext?: string;
  revision: number;
  updatedAt: number;
};
export type ExternalFile = Row<"externalFiles"> & ExternalFileFields;
