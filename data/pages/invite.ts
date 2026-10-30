/**
 * `/invite/[token]` — the Counterparty's claim page (#146).
 *
 * The page only *shows* the invitation. Claiming is a POST to
 * `/invite/[token]/claim`, and that split is the point: the token is single-use, and a GET
 * that consumed it would be consumed by the first thing that fetches the link — a mail
 * client's link preview, a scanner, a browser prefetch — leaving the person it was sent to
 * holding a dead invitation. So the GET is inert and the button is the one claim.
 *
 * The three refusals are the store's: `unknown`, `claimed`, `expired`.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const invitePageCopy: PageCopy = zPageCopy.parse({
  heading: "You have been invited",
  subtitle: "{initiator} wants to compare notes with you on {template}.",
  sections: [
    {
      id: "claim",
      body: "You answer every Aspect first. You will not see their answers, and they will not see yours, until you have both submitted — and after that, the answers are frozen.",
      items: [{ id: "claim", label: "Accept and answer" }],
    },
    {
      id: "claimed",
      heading: "This invitation was used already",
      body: "An invitation works once. Ask {initiator} to start a new instance with you.",
    },
    {
      id: "expired",
      heading: "This invitation has expired",
      body: "Invitations last seven days. Ask {initiator} to start a new instance with you.",
    },
    {
      id: "unknown",
      heading: "No such invitation",
      body: "This link does not name an invitation. Check that it was copied whole.",
    },
  ],
});
