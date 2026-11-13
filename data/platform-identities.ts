/**
 * The identities a platform package **declares** (#899).
 *
 * A platform package carries people, and carrying a person means naming the ones a demo flow
 * signs in as — never a password, a hash or a session. Three facts per row is the whole
 * declaration: `email` (what the target's own `sign-up/email` endpoint receives),
 * `displayName` (the party name the seeded relationships carry, which is how `db:seed` binds
 * Avery and Rowan to their seats) and `role` (`member` or `admin`).
 *
 * **`demo.alignsynch.test` is the demo domain, and it is the only classifier.** `--subset prod`
 * strips every identity whose email is on it and the relationships those personas own, because
 * a production tenant must receive zero demo sign-ins; a package that carried them and relied
 * on the operator to notice would ship a backdoor with the data. The domain is a reserved
 * `.test` name, so it can never be a real mailbox.
 *
 * This file is a *declaration*, not a store: nothing here is a credential, and an import
 * creates each row through the target branch's own sign-up path (`scripts/bundle-platform.ts
 * identities --apply`), which is exactly what `pnpm db:seed` does for the same three people.
 * The password is generated on the target, lives in that branch's `demo_account` row, and
 * never travels in a package — `B4` refuses a document that names one.
 */
import { z } from "zod";

import { zPlatformIdentity, type PlatformIdentity } from "../content/bundle";

/** The reserved domain every demo persona is on. `--subset prod` strips these declarations. */
export const DEMO_IDENTITY_DOMAIN = "demo.alignsynch.test";

/** One declaration list, validated at module load: a typo is a red build, not a bad import. */
export const zPlatformIdentities = z.array(zPlatformIdentity);

export const platformIdentities: readonly PlatformIdentity[] = zPlatformIdentities.parse([
  { email: `initiator@${DEMO_IDENTITY_DOMAIN}`, displayName: "Avery", role: "member" },
  { email: `counterparty@${DEMO_IDENTITY_DOMAIN}`, displayName: "Rowan", role: "member" },
  { email: `admin@${DEMO_IDENTITY_DOMAIN}`, displayName: "Demo Admin", role: "admin" },
]);

/** True for a declaration `--subset prod` must drop: a persona on the demo domain. */
export function isDemoIdentity(identity: PlatformIdentity): boolean {
  return identity.email.toLowerCase().endsWith(`@${DEMO_IDENTITY_DOMAIN}`);
}
