/**
 * The admin notice bar's *decisions*, separate from the component that draws it (#906).
 *
 * Two facts live here and nothing else does:
 *
 *   1. **Who sees the bar.** The predicate is a pure function of the three reads the spec names
 *      (`docs/specs/spec-design-page-rel-templates-v2/banner/README.md` §7), so the negative cases
 *      — a member, a signed-out visitor, the QuizHub build — are answerable in a unit test with no
 *      session, no database and no React.
 *   2. **The shell marker and the height it publishes.** `ADMIN_NOTICE_SHELL_CLASS` is put on the
 *      layout's wrapper *only when the bar renders*, and `app/globals.css` gives that class the one
 *      number the bar's box is measured by (`--admin-notice-h`: 40px at a wide viewport, 56px on a
 *      phone, where the label wraps to two lines). The default on `:root` is `0px`, so a shell
 *      without the bar resolves every consumer of the property to its old value.
 *
 * **Why this module has no server imports.** `components/layout/main-layout.tsx` is a client
 * component and it needs the marker string; a module that reached `lib/auth/require-role.ts` would
 * drag the session reader into the browser graph, which `data:check` E34 fails on. The role is
 * *read* by the bar (a server component) and *judged* here, by the ladder, which carries no zod.
 */
import { roleAdmits, type UserRole } from "@/content/role-ladder";

/** The one destination the bar carries, and the page it opens. */
export const ADMIN_BRAND_PATH = "/admin/brand";

/**
 * The class the shell wrapper carries when the bar renders.
 *
 * A plain class name rather than a Tailwind arbitrary property: `tailwind.config.ts` scans
 * `app/`, `components/` and the root files, not `lib/`, so a utility written here would never be
 * generated. `app/globals.css` owns the rule, which is also where the two heights are written once.
 */
export const ADMIN_NOTICE_SHELL_CLASS = "admin-notice-shell";

/** The three reads that decide the bar, as values. */
export interface AdminNoticeAudience {
  /** Does this build sell the operator console? (`product.admin`.) */
  readonly adminProduct: boolean;
  /** Does this build sell the quiz product? (`product.quiz-surfaces`.) */
  readonly quizProduct: boolean;
  /** `user_profile.role` for this request, or `null` when nobody is signed in. */
  readonly role: UserRole | null;
}

/**
 * Is the bar drawn for this request?
 *
 * Three answers, and each one is a different bug if it is missing:
 *
 *   - `adminProduct` — a template that sells no console has no `/admin/brand`, so it draws no door
 *     into one. The console is a capability (`lib/brand-boundary.ts`), not a constant.
 *   - `quizProduct` — `/admin/brand` is the alignment product's page and answers 404 on a
 *     quiz-only build (`requireAlignmentProduct()`), so a bar linking there would be a door to a
 *     404. This is the same switch the page uses, read from the other side, never a brand name
 *     typed into a component.
 *   - `role` — `roleAdmits("admin", null)` is false, so a signed-out visitor and a member are one
 *     answer here. The bar decides what to *draw*; `requireAdmin()` decides what to *serve*.
 */
export function adminNoticeVisible(audience: AdminNoticeAudience): boolean {
  return audience.adminProduct && !audience.quizProduct && roleAdmits("admin", audience.role);
}
