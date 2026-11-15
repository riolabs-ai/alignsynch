import { CategoriesPage } from "@/components/categories/categories-page";
import { brand, brandIdOf } from "@/data/brand";
import { categoriesPageCopy } from "@/data/pages/categories";
import { shellPageCopy } from "@/data/pages/shell";
import { currentUserIfConfigured } from "@/lib/auth/session";
import { requireQuizProduct } from "@/lib/brand-boundary";
import { hiddenNavHrefs } from "@/lib/flags";
import { REGISTER_PATH, startHrefFor, startViewer } from "@/lib/start-path";

export const metadata = {
  title: "Quiz Categories",
  description: "Browse all quiz categories and find quizzes that match your interests.",
};

/**
 * The subject index.
 *
 * The brand boundary (#300) comes before the copy: on the alignment build this route is a 404, so
 * the quiz subjects are never projected and the footer is never asked for.
 *
 * **The closing band's action is the viewer's (#979).** Its "join" link was a literal `/register`,
 * so a signed-in member browsing subjects was invited to create the account they already had —
 * a control under a band whose neighbours (the shell's own header, the sidebar) already knew who
 * they were. `currentUserIfConfigured()` answers the request's session and `lib/start-path.ts`
 * resolves the destination: `/register` for a visitor, the brand's account home for a member. The
 * shell around this page already reads the same session, so the render mode does not change and a
 * signed-out visitor's markup is byte-identical.
 *
 * Four props, and the last one is resolved here rather than in the page component because
 * `lib/flags.ts` throws in a browser and the session is a server fact: this route is the only
 * place that holds both.
 */
export default async function CategoriesRoute() {
  requireQuizProduct();
  const signedIn = (await currentUserIfConfigured()) !== null;
  const viewer = startViewer(brandIdOf(brand), signedIn);
  return (
    <CategoriesPage
      copy={categoriesPageCopy}
      shellCopy={shellPageCopy}
      hiddenNav={hiddenNavHrefs()}
      startHref={startHrefFor(REGISTER_PATH, viewer)}
    />
  );
}
