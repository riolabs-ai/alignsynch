/**
 * The shapes the edit surface and the edit writer share — types only, and deliberately their own
 * module.
 *
 * **Why this is not in `lib/member/relationship-edit.ts`.** That module opens a pool and reads
 * rows; a client component may not import it (E34 — `lib/db/client` reaches `pg`). The values that
 * cross the boundary are the state a screen draws and the draft it posts, so they live here, where
 * both halves can name them and neither direction is a violation.
 *
 * No runtime at all: `import type` only, so this file adds nothing to any bundle.
 */
import type { AlignmentSetting, Assessment, AssessmentMode, PartyRole } from "@/content/assessment";
import type { EditAspect, AnswerTally } from "@/lib/relationship/edit";
import type { RelationshipStatus } from "@/lib/relationship/status";

/** One version the pin may move to, as the select draws it. */
export interface EditableVersion {
  readonly id: string;
  readonly version: number;
  readonly publishedAt: string;
  /** Is this the version the relationship is bound to now? */
  readonly current: boolean;
}

/** Everything the edit surface draws, and everything the writer needs to compute a cost. */
export interface RelationshipEditState {
  readonly relationshipId: string;
  readonly status: RelationshipStatus;
  readonly closed: boolean;
  /**
   * The relationship's copy as a whole (`zAssessment`) — the object the editor posts back.
   *
   * The surface needs more than four strings per Aspect: a save posts a *record*, and building one
   * from scratch in a component would be a second answer to "what is a template's copy". This is
   * the same object `readMyRelationship` draws from, so the form and the page cannot disagree.
   */
  readonly record: Assessment;
  readonly title: string;
  readonly summary: string;
  readonly mode: AssessmentMode;
  readonly setting: AlignmentSetting;
  readonly aspects: readonly EditAspect[];
  readonly versions: readonly EditableVersion[];
  readonly versionId: string | null;
  /** `null` while the relationship has no invitation (a draft). */
  readonly invite: {
    readonly name: string;
    readonly email: string;
    readonly claimed: boolean;
    readonly expiresAt: string;
    readonly daysLeft: number;
  } | null;
  /** Per-seat answer counts, per Aspect. A count — never a score. */
  readonly answers: readonly AnswerTally[];
  /** Does a session row exist? Exactly the fact that locks `mode`/`setting`. */
  readonly sessionExists: boolean;
}

/** What an edit is asked for: the relationship, the actor, and the values the surface holds. */
export interface EditDraft {
  /** The relationship's copy as the editor built it — `zAssessment`-validated by the action. */
  readonly record: Assessment;
  /** Move the pin to this version, applying its payload — `null`/absent is "leave the pin". */
  readonly versionId?: string | null;
  readonly counterpartyName?: string;
  readonly counterpartyEmail?: string;
  /** The invitation window, in days from now. Absent is "leave the date alone". */
  readonly inviteDays?: number;
}

/** A seat's share of a stated cost, for the sentence the screen prints. */
export interface CostSeat {
  readonly role: PartyRole;
  readonly name: string;
  readonly answers: number;
}
