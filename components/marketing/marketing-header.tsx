import type { Brand } from "@/content/brand";
import type { PageCopy } from "@/content/pages";
import type { BrandMark } from "@/lib/brand-mark";
import Image from "next/image";
import Link from "next/link";

/**
 * The marketing chrome's header: the mark, and the one action.
 *
 * Deliberately not `components/layout/header.tsx`. That header is the product shell's — search
 * palette, notification drawer, account menu, sidebar toggle, and the brand-blind nav issue #156
 * is rewriting. A public page gets none of it: no sidebar, no app navigation, no theme toggle
 * (the build has one light default since #157, and a control that flips a class nothing in this
 * layout paints is a knob connected to nothing).
 *
 * The mark is `lib/brand-mark.ts`'s answer for this brand: a real lockup is drawn (its wordmark is
 * black on nothing, so the light ground is the one it was drawn for), and a placeholder resolves to
 * `undefined`, in which case the brand's name is set in type instead. The name is never typed here
 * — it is `brand.name` either way.
 *
 * The CTA is `copy.cta`, the same link the page closes with: one action, repeated, from the
 * fixture. Colours are the theme's (`bg-primary`, `text-primary-foreground`), which
 * `lib/brand-theme.ts` has already pointed at this brand's record on `<html>` — so the header
 * carries no resolved colour value into the markup. No literals either: E23 counts
 * `components/marketing/**` at zero, and this file holds none.
 */
export function MarketingHeader({
  brand,
  copy,
  mark,
}: {
  brand: Brand;
  copy: PageCopy;
  mark?: BrandMark;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-6 px-6">
        <span className="flex items-center gap-2">
          {mark ? (
            <Image
              alt={brand.name}
              className="h-8 w-auto"
              height={mark.height}
              priority
              src={mark.src}
              width={mark.width}
            />
          ) : (
            <span className="text-lg font-semibold text-primary tracking-tight">{brand.name}</span>
          )}
        </span>
        {copy.cta ? (
          <Link
            className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            href={copy.cta.href}
          >
            {copy.cta.label}
          </Link>
        ) : null}
      </div>
    </header>
  );
}
