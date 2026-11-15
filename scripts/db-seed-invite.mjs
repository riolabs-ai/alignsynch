/**
 * The demo identity that owns a seat, and the address its invitation names (#975, #1083).
 *
 * **Why this lives in its own module.** `scripts/db-seed.mjs` runs its seed at import, so nothing
 * left inside it can be tested — the same reason `db-seed-sweep.mjs`, `db-seed-lock.mjs` and
 * `db-seed-admin-proof.mjs` exist. That untestability is what let `#1083` remove the `party` key
 * from these accounts while the guard that read it stayed behind, and the seed kept passing its
 * own suite because nothing in the suite seeded an invited relationship.
 *
 * **Two sources for the address, in order, and neither invents a person.** A `session_invite` row
 * requires one (`email` is NOT NULL with an `@` check) and the fixture authors none — a party is a
 * name and a sheet, never a mailbox:
 *
 *   1. **the demo account that owns the seat**, when the counterparty's fixture name is that
 *      identity's display name. The display name is the **binding key**
 *      (`bindDemoParties` binds every `party` row whose name is that person), so the invitation
 *      names the identity that can actually sign in and walk `/invite/<token>`.
 *   2. **the counterparty's own fixture name** at `demo.alignsynch.test` — `sam@demo.alignsynch.test`
 *      for the seat a five-party catalogue says belongs to Sam. `.test` is reserved by RFC 6761 and
 *      can never route anywhere, so a derived demo address cannot deliver mail to a stranger.
 */

export const DEMO_DOMAIN = "demo.alignsynch.test";

/**
 * The three accounts, and the seats they hold.
 *
 * The handles are `demo-`prefixed so a leftover row is identifiable by name, and the display
 * names are the party names the dataset carries (`Avery`, `Rowan`) — which is the **binding key**:
 * `bindDemoParties` binds every `party` row whose name is that person, so the demo identities hold
 * every relationship their name appears in rather than one fixture instance (#1079). Avery is the
 * Initiator on four of them and Rowan is the Counterparty on one and the Initiator on two, which is
 * what makes both demo buttons show a populated screen — the requirement the issue states as "at
 * least one relationship where they are the initiator/counterparty".
 *
 * The Admin is an **operator**, not a party: no `party` row in the population carries that name,
 * so it is marked `holdsSeat: false` and the binding skips it. That fact used to be implied by a
 * `party: null` on the record; #1083 removed the field, and with it the only thing that told the
 * binding this identity has no seat to claim — see `bindDemoParties`.
 */
export const DEMO_ACCOUNTS = [
  {
    email: `initiator@${DEMO_DOMAIN}`,
    name: "Avery",
    handle: "demo-initiator",
    role: "member",
  },
  {
    email: `counterparty@${DEMO_DOMAIN}`,
    name: "Rowan",
    handle: "demo-counterparty",
    role: "member",
  },
  {
    email: `admin@${DEMO_DOMAIN}`,
    name: "Demo Admin",
    handle: "demo-admin",
    role: "admin",
    holdsSeat: false,
  },
];

/** The counterparty's seat, or `undefined` when the instance has nobody to invite. */
export function counterpartyOf(instance) {
  return instance.parties.find((party) => party.role === "counterparty");
}

/** The address the invitation was sent to (#975) — see the module docstring for the two sources. */
export function inviteEmailFor(instance) {
  const counterparty = counterpartyOf(instance);
  if (counterparty === undefined) {
    throw new Error(
      `instance "${instance.id}" has no counterparty party — an invitation needs somebody to invite`,
    );
  }

  // The seat's owner, resolved by the same key `bindDemoParties` binds on: the counterparty's
  // fixture name is the account's display name (#1083). The pre-#1079 lookup read an
  // `account.party.instance` field that no longer exists — an override that could only ever have
  // matched the one fixture instance each persona used to own, which is exactly the assumption the
  // population replaced.
  const account = DEMO_ACCOUNTS.find((candidate) => candidate.name === counterparty.name);
  if (account !== undefined) return account.email;

  const stem = counterparty.name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (stem === "") {
    throw new Error(
      `instance "${instance.id}": the counterparty's name "${counterparty.name}" yields no address stem`,
    );
  }
  return `${stem}@${DEMO_DOMAIN}`;
}
