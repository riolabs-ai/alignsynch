// template-ancestor: components/ui/button.tsx   (variation: the hero hand-written — a themed background image, the brand heading, a subtitle and two buttons, no page-header primitive)

import { Button } from "@/components/ui/button";
import type { PageCopy } from "@/content/pages";
import { media } from "@/data/media";
import { headingLines } from "@/lib/page-copy";
import Link from "next/link";
import { Fragment } from "react";

/** The hero carries the route's own heading, so it takes `PageCopy` rather than a section. */
export function HeroSection({ copy }: { copy: PageCopy }) {
  return (
    <section
      className="relative overflow-hidden rounded-xl bg-no-repeat bg-cover p-6 text-white md:p-10 xl:py-14"
      style={{ backgroundImage: `url(${media["hero-bg"].src})` }}
    >
      <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
        <div className="max-w-lg space-y-4">
          <h2 className="text-3xl font-bold xl:leading-tight tracking-tight md:text-4xl xl:text-5xl">
            {headingLines(copy.heading).map((line, index) => (
              <Fragment key={line}>
                {index > 0 && <br />}
                {line}
              </Fragment>
            ))}
          </h2>
          <p className="text-lg text-white/80">{copy.subtitle}</p>
          <div className="flex flex-wrap gap-4">
            {copy.cta && (
              <Button
                size="lg"
                asChild
                className="bg-white duration-300 text-action hover:bg-white/90"
              >
                <Link href={copy.cta.href}>{copy.cta.label}</Link>
              </Button>
            )}
            {copy.secondaryCta && (
              <Button
                size="lg"
                className="bg-action text-action-foreground duration-300 hover:bg-action/90"
                asChild
              >
                <Link href={copy.secondaryCta.href}>{copy.secondaryCta.label}</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
      <div className="absolute -bottom-16 -right-16 h-64 w-64 rounded-full bg-action/20 blur-3xl"></div>
      <div className="absolute -left-16 -top-16 h-64 w-64 rounded-full bg-action/20 blur-3xl"></div>
    </section>
  );
}
