/**
 * The shell's account menu, as a function of the session (#979).
 *
 * The menu used to be one hardcoded list with two session-dependent rows in the middle of it: the
 * identity block above swapped between a person and a "Sign in" link, but the rows below did not.
 * So a signed-out visitor — on any page behind the shell, in a preview without auth secrets, in the
 * gate's own render — was offered **Settings** and, in a destructive red button under a separator,
 * **Log out**. There is nothing to log out of: the control described a session that did not exist,
 * which is the same class of lie as a menu that prints a stranger's name (#212, #226).
 *
 * The fix is not a label. The rows are derived here, from the session, in one place:
 *
 *   a visitor   Sign in (`/login`) and Sign up (`/register`) — the only two actions that exist
 *   a member    their own profile (when they have a handle, #226), the quiz product's two
 *               destinations (when the viewer carries that product), Settings, and **Log out**
 *
 * `signOut` is a separate field rather than a row because it is drawn differently — a destructive
 * button in the menu's footer, not a link in the list — and because its presence is the claim the
 * defect was about: `null` for a visitor, always set for a member. A test that asserts "no log-out
 * control when signed out" then has a shape to read, not a wording to grep.
 *
 * **The words stay in the fixture.** Every label is `itemLabel()` over the shell's `account`
 * section (`data/pages/shell.ts`), so this module adds no copy and E23 can still resolve each id
 * against the surface that renders it. It holds no hrefs of its own either: `/login` and `/register`
 * are the auth routes and are spelled here as the two constants `lib/start-path.ts` and the auth
 * views already use.
 *
 * Pure and React-free so `tests/account-menu-session.test.tsx` can drive every branch, and so the
 * header stays a renderer: it decides icons and markup, never which rows exist.
 */
import type { PageCopySection } from "@/content/pages";
import type { ShellAccount } from "@/lib/auth/shell-account";
import { itemLabel } from "@/lib/page-copy";

/** The rows a menu can carry. A closed union so the header's icon map is exhaustive. */
export type AccountMenuRowId =
  | "sign-in"
  | "sign-up"
  | "profile"
  | "dashboard"
  | "quizzes"
  | "settings";

/** One row: its id (which the header turns into an icon), its words, and where it goes. */
export interface AccountMenuRow {
  readonly id: AccountMenuRowId;
  readonly label: string;
  /** The second, muted line the shell's member rows carry. Absent on the visitor rows. */
  readonly hint?: string;
  readonly href: string;
}

/** Log out: a button, not a link, so it carries its three sentences rather than an href. */
export interface AccountMenuSignOut {
  readonly label: string;
  /** What the button says while the request is in flight. */
  readonly pending: string;
  /** What is printed under it when the revocation failed. */
  readonly error: string;
}

/** Everything the account menu draws — the whole menu, decided once. */
export interface AccountMenu {
  readonly signedIn: boolean;
  /** The person, or `null` — never a fixture stand-in (#212). */
  readonly account: ShellAccount | null;
  /** The rows the menu offers, in the order it draws them. */
  readonly rows: readonly AccountMenuRow[];
  /** The log-out action, present **only** for a member. */
  readonly signOut: AccountMenuSignOut | null;
}

/** The two routes a signed-out visitor is offered. */
const SIGN_IN_PATH = "/login";
const SIGN_UP_PATH = "/register";

export function accountMenu(input: {
  /** The shell fixture's `account` section. */
  readonly copy: PageCopySection;
  readonly account: ShellAccount | null;
  /** `seesQuizProduct(brandId, viewer)` — whether this viewer carries the quiz destinations. */
  readonly quizRows: boolean;
  /** The signed-in person's own profile path, or `null` when they have no handle yet (#226). */
  readonly profileHref: string | null;
}): AccountMenu {
  const { copy, account, quizRows, profileHref } = input;

  if (account === null) {
    return {
      signedIn: false,
      account: null,
      rows: [
        { id: "sign-in", label: itemLabel(copy, "signed-out"), href: SIGN_IN_PATH },
        { id: "sign-up", label: itemLabel(copy, "sign-up"), href: SIGN_UP_PATH },
      ],
      signOut: null,
    };
  }

  const rows: AccountMenuRow[] = [];

  /**
   * The quiz product's three rows, including the person's own page — the gate is the shipped one
   * (#156): the alignment build's visitor does not get the quiz destinations, and "My Profile" was
   * inside that block before this module existed, so an alignment viewer's menu keeps the shape it
   * had. Settings stays outside it, because a preference page is an account action rather than a
   * product surface.
   *
   * "My Profile" is conditional on there being one (#226): a brand-new account has no
   * `user_profile` row until it first saves `/settings`, so with no handle the row is absent rather
   * than pointing at a stranger — or, since #979, at `/profile/<empty>`.
   */
  if (quizRows) {
    if (profileHref !== null) {
      rows.push({
        id: "profile",
        label: itemLabel(copy, "profile"),
        hint: itemLabel(copy, "profile-hint"),
        href: profileHref,
      });
    }

    rows.push(
      {
        id: "dashboard",
        label: itemLabel(copy, "dashboard"),
        hint: itemLabel(copy, "dashboard-hint"),
        href: "/dashboard/user",
      },
      {
        id: "quizzes",
        label: itemLabel(copy, "quizzes"),
        hint: itemLabel(copy, "quizzes-hint"),
        href: "/my-quizzes",
      },
    );
  }

  rows.push({
    id: "settings",
    label: itemLabel(copy, "settings"),
    hint: itemLabel(copy, "settings-hint"),
    href: "/settings",
  });

  return {
    signedIn: true,
    account,
    rows,
    signOut: {
      label: itemLabel(copy, "logout"),
      pending: itemLabel(copy, "logout-pending"),
      error: itemLabel(copy, "logout-error"),
    },
  };
}
