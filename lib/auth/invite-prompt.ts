/**
 * The one sentence `/login` adds when the visitor was in the middle of accepting an invitation
 * (#t_0aa81144).
 *
 * A sign-in page that says only "Welcome back" is a page that has forgotten why the person is
 * there. The counterparty's onboarding wizard sends a signed-out visitor from step 3 to
 * `/login?next=<step 3>&intent=invite&inviter=<name>`, so this module turns those three facts into
 * one sentence from the login fixture — `named` when the inviter's name came through, `unnamed`
 * when it did not.
 *
 * Two rules:
 *
 *   the sentence is copy      the words are `data/pages/login.ts`, so a literal here would be the
 *                             E23 regression the fixture exists to prevent; this module only
 *                             decides *which* item and what fills its placeholder
 *   the name is display only  it arrives in a URL, so it is trimmed and capped before it is
 *                             filled in. It never decides a destination (that is `next`, and
 *                             `safeNextPath`/`signInDestination` own it), and it is rendered as a
 *                             text node, so React escapes it
 *
 * `next`'s pathname is the second way in: a `next` under `/invite/` with no `intent` — an older
 * link, a person who edited the URL — is still an invitation, and the session's `invite` section
 * rows read the same either way.
 */
import type { PageCopy } from "@/content/pages";
import { pathnameOf } from "@/lib/auth/next-path";
import { INVITE_INTENT_VALUE } from "@/lib/flow/paths";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";

/** The longest inviter name this screen will print. Beyond it the name is not a name. */
const INVITER_MAX = 80;

export function invitePromptFor(
  copy: PageCopy,
  request: {
    readonly intent: string | undefined;
    readonly inviter: string | undefined;
    /** The `next` path this page settled on — validated, not the raw query. */
    readonly next: string;
  },
): string | null {
  const invitation =
    request.intent === INVITE_INTENT_VALUE || pathnameOf(request.next).startsWith("/invite/");
  if (!invitation) return null;

  const band = sectionOf(copy, "invite-intent");
  const inviter = (request.inviter ?? "").trim().slice(0, INVITER_MAX);
  return inviter === ""
    ? itemLabel(band, "unnamed")
    : fillLabel(itemLabel(band, "named"), { inviter });
}
