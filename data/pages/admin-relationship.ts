/**
 * `/admin/instances/[id]` — one relationship, and the five repairs on it (#503).
 *
 * The words are the operator's, and the shape of the fixture is the shape of the screen:
 *
 *   facts       what the row is, before anybody touches it
 *   seats       the two parties, with the three facts each button acts on (a mark, an
 *               acceptance, and whether an operator wrote it)
 *   invite      the link's state, and the address a resend reissues for
 *   op-unlock / op-resend / op-revoke / op-void / op-force-close
 *               one band per repair: what it does, what it needs, and the button
 *   refusals    one sentence per `OP_REFUSAL` code, so a refusal is a sentence and never the
 *               server's diagnostic text (which names instants an operator does not need)
 *   done        the success line, and the one place a fresh invitation link is shown
 *   unreadable  the database did not answer
 *
 * **Why the five bands are sections and not one list.** Each repair has its own consequence, its
 * own floor and its own refusals; a single table of buttons would have to describe all of that in
 * one cell. A section per repair is the same amount of copy with one home per sentence, and the
 * component decides which bands to draw from the row it was handed.
 *
 * **Nothing here names a role.** `support may unlock and resend` is `ACTION_REQUIREMENTS` in
 * `lib/admin/roles.ts`, and the screen says what the *action* needs only when the caller is below
 * it — the floor is policy, and a fixture that repeated it would be a second copy of a permission.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const adminRelationshipPageCopy: PageCopy = zPageCopy.parse({
  heading: "Relationship operations",
  subtitle:
    "Five repairs on one relationship: clear a party's unlock mark, reissue or withdraw the invitation, end the session, or accept it on a seat's behalf. Every one of them needs a reason, and every one of them is written to the audit log in the same transaction as the change.",
  sections: [
    {
      id: "facts",
      heading: "This relationship",
      body: "What the row is right now. Nothing on this screen reads either party's answers — a repair changes a mark, an invitation or an acceptance, never a score.",
      items: [
        { id: "id", label: "Instance" },
        { id: "template", label: "Template" },
        { id: "mode", label: "Mode" },
        { id: "setting", label: "Setting" },
        { id: "status", label: "Status" },
        { id: "created", label: "Created" },
        { id: "aspects", label: "Aspects" },
      ],
    },
    {
      id: "status",
      items: [
        { id: "awaiting-counterparty", label: "Awaiting counterparty" },
        { id: "answering", label: "Answering" },
        { id: "complete", label: "Complete" },
        { id: "voided", label: "Voided" },
      ],
    },
    {
      id: "seats",
      heading: "The two seats",
      body: "A seat's unlock mark, its acceptance and — when an operator wrote the acceptance — who wrote it. The answered count is what the force-close refusal is computed from.",
      items: [
        { id: "initiator", label: "Initiator" },
        { id: "counterparty", label: "Counterparty" },
        { id: "account", label: "Account holder" },
        { id: "no-account", label: "Seat, no account" },
        { id: "answered", label: "{answered} of {aspects} Aspects answered" },
        { id: "accepted", label: "Accepted {at}" },
        { id: "not-accepted", label: "Not accepted" },
        { id: "admin-set", label: "Set by an operator ({by})" },
        { id: "unlocked", label: "Unlock mark set at {at}" },
        { id: "not-unlocked", label: "No unlock mark" },
        { id: "missing", label: "Not on this relationship" },
      ],
    },
    {
      id: "invite",
      heading: "The invitation",
      body: "One live link per relationship. Reissuing replaces the token, so the old link stops naming an invitation at all.",
      items: [
        { id: "email", label: "Address" },
        { id: "expires", label: "Expires {at}" },
        { id: "state", label: "State" },
        { id: "resent", label: "Reissued {count} times" },
        { id: "none", label: "This relationship has no invitation" },
        { id: "unclaimed", label: "Unclaimed" },
        { id: "expired", label: "Expired" },
        { id: "claimed", label: "Claimed" },
        { id: "revoked", label: "Withdrawn" },
      ],
    },
    {
      id: "op-unlock",
      heading: "Unlock a party",
      body: 'Clears a seat\'s unlock mark, so the "complete since you last looked" marker shows again for that party. This is the V11 repair — a mark that is set on an instance that is not complete is a row the database gate names, and clearing it is this button.',
      items: [
        { id: "button", label: "Clear the mark" },
        { id: "party", label: "Which seat" },
      ],
    },
    {
      id: "op-resend",
      heading: "Reissue the invitation",
      body: "Mints a new token and a new seven-day window. The old link dies the moment this commits, and the new one is shown once, here, for you to send. Available while the invitation is unclaimed; a withdrawn invitation is terminal and cannot be reissued.",
      items: [
        { id: "button", label: "Issue a new link" },
        { id: "email", label: "Send to a corrected address (optional)" },
      ],
    },
    {
      id: "op-revoke",
      heading: "Withdraw the invitation",
      body: "Kills the link for good. Nothing reopens it — not a claim, not a reissue — so the only way to invite this pair again is a new invitation. This needs an admin.",
      items: [{ id: "button", label: "Withdraw the link" }],
    },
    {
      id: "op-void",
      heading: "Void the session",
      body: "Ends the session for both parties, terminally. Nothing either of them wrote is deleted and the report's rows are untouched — the pair simply cannot answer or accept any more. This needs an admin.",
      items: [{ id: "button", label: "Void this session" }],
    },
    {
      id: "op-force-close",
      heading: "Accept on a seat's behalf",
      body: "Records a seat's acceptance exactly as that party would have recorded it, and marks the row with your account so the report says an operator set it. The seat has to have answered every Aspect; a half-answered sheet cannot be accepted, by anyone.",
      items: [
        { id: "button", label: "Accept for this seat" },
        { id: "party", label: "Which seat" },
      ],
    },
    {
      id: "form",
      heading: "Reason",
      body: "Required, and at least eight characters. It is stored on the audit row with the before and after values, so the next person to read this log knows why.",
      items: [
        { id: "reason", label: "Why this repair" },
        { id: "reason-short", label: "A reason of at least {min} characters is required." },
        { id: "submit", label: "Record it" },
        { id: "submitting", label: "Recording…" },
      ],
    },
    {
      id: "refusals",
      items: [
        { id: "no-such-instance", label: "No session has that id any more." },
        { id: "no-such-party", label: "That seat is not on this relationship." },
        { id: "not-unlocked", label: "That seat has no unlock mark — there is nothing to clear." },
        { id: "no-invite", label: "This relationship has no invitation to act on." },
        {
          id: "already-claimed",
          label: "That invitation was already claimed; the seat is taken.",
        },
        { id: "already-revoked", label: "That invitation was already withdrawn." },
        { id: "already-accepted", label: "That seat has already accepted this session." },
        { id: "already-voided", label: "This session was already voided." },
        {
          id: "instance-voided",
          label: "This session was voided; it takes no invitations and no acceptances.",
        },
        {
          id: "sheet-incomplete",
          label: "That seat has not answered every Aspect — a sheet is accepted whole.",
        },
        { id: "invalid-email", label: "That is not an address a message can be sent to." },
        {
          id: "reason-too-short",
          label: "The reason is too short. At least {min} characters, please.",
        },
        { id: "role-too-low", label: "This repair needs a higher role than yours." },
        { id: "signed-out", label: "The sign-in expired while this form was open." },
        { id: "failed", label: "The repair did not commit. Nothing was changed." },
      ],
    },
    {
      id: "done",
      heading: "Recorded",
      body: "The change and its audit row committed together. The audit log lists it with the before and after values.",
      items: [
        { id: "logged", label: "Written to the audit log as {action}." },
        { id: "link", label: "New invitation link — copy it now, it is not shown again" },
        { id: "audit", label: "Open the audit log" },
      ],
    },
    {
      id: "unreadable",
      heading: "This relationship could not be read",
      body: "The console reads the row from the database on every visit, and this visit did not get an answer. Nothing here came from a cache.",
      items: [{ id: "back", label: "Back to the registry" }],
    },
  ],
});
