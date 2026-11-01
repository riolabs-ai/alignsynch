import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FloatingGlyphs } from "@/components/not-found/floating-glyphs";
import { GoBackButton } from "@/components/not-found/go-back-button";
import { brand, brandIdOf } from "@/data/brand";
import { notFoundPageCopy } from "@/data/pages/not-found";
import { hiddenNavHrefs } from "@/lib/flags";
import { notFoundCopyFor } from "@/lib/not-found-copy";
import { itemLabel, sectionOf } from "@/lib/page-copy";
import type { Metadata } from "next";
import { Brain, Home, Search, Trophy } from "lucide-react";
import Link from "next/link";
import { BrandGlyph } from "@/components/layout/brand-glyph";

/**
 * Next 16 reads `metadata` from the root `app/not-found.tsx`, so the 404 carries a
 * title of its own instead of the root default. It is not a route — the words stay in
 * `data/pages/not-found.ts` (`COPY` surface `not-found`) — but the document name is the
 * one string the fixture does not own, exactly as for every other route here.
 */
export const metadata: Metadata = {
  title: "Page Not Found",
};

/**
 * The 404. Not a route — Next renders this for any path that matches nothing, which is
 * why `data/pages/budget.ts` keys its copy by the surface name `not-found` instead of a
 * route pattern. The words come from `data/pages/not-found.ts`; the randomised glyphs are
 * a client component of their own (`FloatingGlyphs`), so this module stays on the server
 * and the fixture's zod never reaches the browser.
 *
 * **The ground is the brand's ink, not a gradient (issue #187).** This page opened on a
 * three-stop purple and indigo diagonal — a decoration in QuizHub's palette that made the 404 the
 * most QuizHub-looking page in the AlignSynch build, and the one a visitor hits by following a
 * dead link. Three stops cannot be the brand when the brand record carries one ink and one
 * action colour, so the gradient is **removed** rather than recoloured: `bg-foreground` is the
 * dark ground both brands own (`hsl(0 0% 3.9%)` for the template, `#363d49` for AlignSynch),
 * `text-background` is the ink on it, and the brand's `action` paints the one button. The other
 * three gradients here (the `404`'s text fill, the icon disc, the fact panel) went the same way:
 * solid `background` / `white/10` fills. The remaining literals — `text-blue-400`,
 * `text-yellow-400`, `text-gray-200` — are not this card's palette and are untouched.
 *
 * The two suggestion links are drawn, the third is drawn when its surface is on (#175
 * follow-up): `Leaderboard` pointed at `/leaderboard`, which answers 404 while
 * `community.leaderboard` is off, so the 404 used to hand a visitor a second 404. `hiddenNav` is
 * resolved here because this is a server module; no replacement link is invented, so the band
 * keeps exactly the rows the fixture declares and loses the one that cannot resolve. Note that
 * Next prerenders this body at build time (`/_not-found`), so — exactly like the sidebar — the
 * flag is a **build-time** value on this surface: a flip needs a rebuild to be visible here.
 *
 * **`/explore` and `/categories` are gated the same way as `/leaderboard` (#300).** They are quiz
 * product surfaces now, so on the alignment build they answer 404 and this page — which is what a
 * visitor reaches *by* following a dead link — must not hand them two more. Every row reads the
 * same `hiddenNav` list, which is why a surface joining the boundary needs no edit here beyond the
 * href it names; a row whose destination is gated simply is not drawn.
 *
 * **The words are brand-keyed (#351 follow-up).** This page is shared by both builds, and it used
 * to print QuizHub's copy on both: "Oops! Quiz Not Found", quiz masters playing hide and seek, an
 * emoji — the whole of it, on the first error page a new AlignSynch customer can see. `copy` is
 * `lib/not-found-copy.ts::notFoundCopyFor`'s projection of `data/pages/not-found.ts`, resolved here
 * from the brand record, so this module renders one set of ids (`message`, `fact`, `actions`) on
 * either build and still holds no sentence of its own.
 *
 * The suggestion band goes with it: with every one of its three destinations gated off — which is
 * the case on the alignment build — the page draws no band at all rather than a question
 * ("Looking for something else?") with no answers under it.
 */
export default function NotFound() {
  const copy = notFoundCopyFor(notFoundPageCopy, brandIdOf(brand));
  const message = sectionOf(copy, "message");
  const fact = sectionOf(copy, "fact");
  const actions = sectionOf(copy, "actions");
  const hiddenNav = hiddenNavHrefs();
  /**
   * Is any of the three suggestions drawable? A band whose every row is gated off is a prompt with
   * no answers — the alignment build's case — so it is not drawn at all.
   */
  const hasSuggestions = ["/explore", "/categories", "/leaderboard"].some(
    (href) => !hiddenNav.includes(href),
  );

  return (
    <div className="min-h-screen bg-foreground text-background relative overflow-hidden">
      {/* Animated Background Elements */}
      <FloatingGlyphs />

      {/* Main Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <div className="text-center max-w-2xl mx-auto">
          {/* 404 Animation */}
          <div className="mb-8">
            <div className="relative">
              <h1 className="text-9xl md:text-[12rem] font-bold text-background animate-pulse">
                404
              </h1>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center animate-bounce">
                  <BrandGlyph className="w-12 h-12 text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Error Message */}
          <Card className="bg-white/10 backdrop-blur-lg border-white/20 mb-8 xl:pt-6">
            <CardContent className="p-8">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{copy.heading}</h2>
              <p className="text-lg text-gray-200 mb-6 leading-relaxed">
                {itemLabel(message, "line-1")}
                <br />
                {itemLabel(message, "line-2")}
              </p>

              {/* About the error (#291: the false CERN trivia lived here) */}
              <div className="bg-white/10 rounded-lg p-4 mb-6 border border-white/20">
                <div className="flex items-center justify-center mb-2">
                  <Trophy className="w-5 h-5 text-yellow-400 mr-2" />
                  <span className="text-sm font-semibold text-yellow-400">{fact.heading}</span>
                </div>
                <p className="text-sm text-gray-200">{fact.body}</p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/">
                  <Button variant={"action"}>
                    <Home className="w-5 h-5 mr-2" />
                    {itemLabel(actions, "home")}
                  </Button>
                </Link>

                <GoBackButton label={itemLabel(actions, "back")} />
              </div>
            </CardContent>
          </Card>

          {/* Search Suggestion — only when at least one of its three rows can be drawn */}
          {hasSuggestions && (
            <div className="text-center">
              <p className="text-gray-300 mb-4">{itemLabel(actions, "prompt")}</p>
              <div className="flex justify-center space-x-4 text-sm">
                {!hiddenNav.includes("/explore") && (
                  <Link
                    href="/explore"
                    className="text-background/80 hover:text-background transition-colors flex items-center"
                  >
                    <Search className="w-4 h-4 mr-1" />
                    {itemLabel(actions, "browse")}
                  </Link>
                )}
                {!hiddenNav.includes("/categories") && (
                  <Link
                    href="/categories"
                    className="text-blue-400 hover:text-blue-300 transition-colors flex items-center"
                  >
                    <Brain className="w-4 h-4 mr-1" />
                    {itemLabel(actions, "categories")}
                  </Link>
                )}
                {!hiddenNav.includes("/leaderboard") && (
                  <Link
                    href="/leaderboard"
                    className="text-yellow-400 hover:text-yellow-300 transition-colors flex items-center"
                  >
                    <Trophy className="w-4 h-4 mr-1" />
                    {itemLabel(actions, "leaderboard")}
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="w-full h-20 fill-white/5">
          <path
            d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z"
            opacity=".25"
          ></path>
          <path
            d="M0,0V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-49.24V0Z"
            opacity=".5"
          ></path>
          <path d="M0,0V5.63C149.93,59,314.09,71.32,475.83,42.57c43-7.64,84.23-20.12,127.61-26.46,59-8.63,112.48,12.24,165.56,35.4C827.93,77.22,886,95.24,951.2,90c86.53-7,172.46-45.71,248.8-84.81V0Z"></path>
        </svg>
      </div>
    </div>
  );
}
