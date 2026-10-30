"use client";

import { createAuthClient } from "@neon/auth/next";

/**
 * The browser client. It takes no arguments on purpose: it talks to the same-origin
 * `/api/auth` proxy above, which is what keeps the auth URL out of the client bundle.
 *
 * Better Auth methods only — `signUp.email`, `signIn.email`, `getSession`, `signOut`,
 * `token`. The Managed wrapper pins its plugin list, so bare `better-auth/client`
 * calls are not interchangeable with these.
 */
export const authClient = createAuthClient();
