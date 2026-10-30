import { CategoriesPage } from "@/components/categories/categories-page";
import { categoriesPageCopy } from "@/data/pages/categories";
import { shellPageCopy } from "@/data/pages/shell";
import { hiddenNavHrefs } from "@/lib/flags";

export const metadata = {
  title: "Quiz Categories",
  description: "Browse all quiz categories and find quizzes that match your interests.",
};

export default function CategoriesRoute() {
  // Three props: the page's own bands (WU-8), the shell the footer renders (WU-7), and the gated
  // hrefs the footer must not draw (#175 follow-up). The last one is resolved here because the
  // page and the footer are both client modules and `lib/flags.ts` throws in a browser.
  return (
    <CategoriesPage
      copy={categoriesPageCopy}
      shellCopy={shellPageCopy}
      hiddenNav={hiddenNavHrefs()}
    />
  );
}
