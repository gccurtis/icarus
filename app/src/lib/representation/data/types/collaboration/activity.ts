import type { Id } from "$representation/data/types/core/id";

/** A frozen reference derived from a typed event for panel navigation. */
export type ActivityTarget = { kind: string; id: string; label: string };

export type ActivityPresentation = {
  readonly type: ActivityEvent["kind"];
  readonly what: string;
  readonly action: string;
  readonly target: ActivityTarget;
  readonly context?: ActivityTarget;
  readonly detail?: string;
};

export type ExternalFileActivitySubject = {
  readonly id: Id<"externalFiles">;
  readonly name: string;
  readonly relativePath: string;
};

export type AgentTaskActivitySubject = {
  readonly id: Id<"agentTasks">;
  readonly title: string;
};

export type AgentActivityPersona = {
  readonly id: Id<"personas">;
  readonly name: string;
};

export type ActivityEvent =
  | {
      readonly kind: "external-file.uploaded";
      readonly file: ExternalFileActivitySubject;
      readonly size: number;
      readonly mediaType: string;
    }
  | {
      readonly kind: "external-file.reuploaded";
      readonly file: ExternalFileActivitySubject;
      readonly replacementName: string;
      readonly size: number;
      readonly revision: number;
    }
  | {
      readonly kind: "external-file.renamed";
      readonly file: ExternalFileActivitySubject;
      readonly previousName: string;
      readonly previousRelativePath: string;
    }
  | {
      readonly kind: "external-file.moved";
      readonly file: ExternalFileActivitySubject;
      readonly previousRelativePath: string;
    }
  | {
      readonly kind: "external-file.context-changed";
      readonly file: ExternalFileActivitySubject;
      readonly change: "set" | "cleared";
    }
  | {
      readonly kind: "external-file.deleted";
      readonly file: ExternalFileActivitySubject;
      readonly size: number;
      readonly revision: number;
    }
  | {
      readonly kind: "agents.task-started";
      readonly task: AgentTaskActivitySubject;
      readonly persona: AgentActivityPersona;
      readonly origin:
        | { readonly kind: "person" }
        | {
            readonly kind: "automation";
            readonly automationId: Id<"automations">;
            readonly automationName: string;
          };
    }
  | {
      readonly kind: "agents.task-completed";
      readonly task: AgentTaskActivitySubject;
      readonly persona: AgentActivityPersona;
      readonly outcome: "answered" | "insufficient-evidence";
      readonly sourceCount: number;
    };
