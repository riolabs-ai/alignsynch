/**
 * `/profile/[username]` — one page, two kinds of person (issue #164).
 *
 * There are now two people a `/profile/<handle>` URL can name, and they are not the same kind of
 * thing:
 *
 *   a **member**     a row in `user_profile`, joined to a Neon Auth user. Their fields are what
 *                    they typed in settings; the page shows the public projection and, when the
 *                    visitor is that person, an edit affordance.
 *   a **demo person** one of the ten in `data/players.ts` — fixture rows with a handle, a level
 *                    and a leaderboard standing. Nobody can sign in as them and nothing they
 *                    show was ever saved.
 *
 * The demo case is why these strings exist. The card's `MUST NOT` forbids "fabricated user data in
 * the seeded demo" and requires that fixture people are **labelled as demo accounts**, so the
 * badge and the note are part of the page rather than a note in a doc: a stranger who lands on
 * `/profile/alexjohnson` is told, on the page, that Alex is sample data.
 *
 * `owner` is a separate band rather than a flag on `public` because it only ever renders for the
 * signed-in owner — the affordance is not hidden, it is absent, and the data it needs (the
 * settings link, the "this is you" line) is not fetched for anyone else.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const profilePageCopy: PageCopy = zPageCopy.parse({
  heading: "Profile",
  sections: [
    {
      id: "member",
      items: [
        { id: "handle-label", label: "Profile URL" },
        { id: "handle-prefix", label: "/profile/" },
        { id: "joined-label", label: "Joined {date}" },
        { id: "bio-empty", label: "No bio yet." },
        { id: "country-label", label: "Country" },
      ],
    },
    {
      id: "owner",
      heading: "This is you",
      body: "This is how your profile looks to everyone else.",
      cta: { label: "Edit your profile", href: "/settings" },
      items: [{ id: "owner-note", label: "You are signed in as this person." }],
    },
    {
      id: "demo",
      heading: "Demo account",
      body: "This profile is sample data from the app's fixtures — not a real member, with no account behind it and nothing to sign in to.",
      items: [
        { id: "demo-badge", label: "Demo account" },
        { id: "demo-note", label: "Sample data, kept so the leaderboard has people in it." },
      ],
    },
    {
      id: "stranger",
      items: [{ id: "stranger-note", label: "Only public fields are shown on this page." }],
    },
  ],
});
