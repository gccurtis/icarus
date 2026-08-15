import type {
  ApplyStyleInput,
  CombineAsListInput,
  RemoveLinkInput,
  RemoveListInput,
  RemoveStyleInput,
  ReplaceTextInput,
  SetLinkInput,
  SetListInput,
  SplitContentInput
} from "$rich-content/types/inputs";
import type { RichContentId } from "$rich-content/types/ids";

/**
 * What a browser sends. Each is exactly one field wider than the procedure input
 * it wraps, and the extra field is the whole boundary.
 *
 * A client instance holds a **project token** — an opaque handle it carries in
 * its URL — and must send it with every call, because a remote function cannot
 * see the page that called it: kit serves them all from `/_app/remote/…` with
 * empty route params.
 *
 * The token is not a credential and is not trusted. `resolveScope` looks it up
 * within the asking user's own handles, and one that is not there resolves to no
 * project at all. By the time a procedure runs it has a `Scope` and the token no
 * longer exists.
 *
 * **Nothing here names a user.** That comes only from the session cookie.
 */
interface ProjectRequest {
  readonly project: string;
}

export interface CreateRequest extends ProjectRequest {
  readonly initialText?: string;
}

export interface DisplayRequest extends ProjectRequest {
  readonly contentId: RichContentId;
}

export interface ReplaceTextRequest extends ProjectRequest, ReplaceTextInput {}
export interface ApplyStyleRequest extends ProjectRequest, ApplyStyleInput {}
export interface RemoveStyleRequest extends ProjectRequest, RemoveStyleInput {}
export interface SetLinkRequest extends ProjectRequest, SetLinkInput {}
export interface RemoveLinkRequest extends ProjectRequest, RemoveLinkInput {}
export interface SetListRequest extends ProjectRequest, SetListInput {}
export interface RemoveListRequest extends ProjectRequest, RemoveListInput {}
export interface SplitRequest extends ProjectRequest, SplitContentInput {}
export interface CombineAsListRequest extends ProjectRequest, CombineAsListInput {}
