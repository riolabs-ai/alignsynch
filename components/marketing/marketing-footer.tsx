import { AppVersion } from "@/components/layout/app-version";
import type { Brand } from "@/content/brand";
import type { PageCopy } from "@/content/pages";
import { pageItemOf } from "@/lib/page-copy";

/**
 * The marketing chrome's footer.
 *
 * Three facts and no navigation: the brand's own name, the beta line from
 * `data/pages/marketing.ts`, and the brand's support address. It is a footer, not a second sitemap
 * — a marketing route may not link into a `(mainlayout)` product route, so the only product link
 * on this layout is the CTA, and the only other link here is `mailto:`.
 *
 * The address is `brand.supportEmail`, not a string: the record owns it, and the shell's footer
 * prints the same field. The label beside it (`footer-contact`) is copy; the address is data.
 */
export function MarketingFooter({ brand, copy }: { brand: Brand; copy: PageCopy }) {
  const note = pageItemOf(copy, "footer-note");
  const contact = pageItemOf(copy, "footer-contact");
  return (
    <footer className="border-t border-slate-200 bg-white text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-12">
        <span className="text-base font-semibold text-primary">{brand.name}</span>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-600">{note.label}</p>
        <a
          className="text-sm font-medium text-primary underline underline-offset-4"
          href={`mailto:${brand.supportEmail}`}
        >
          {contact.label}
        </a>
        {/*
         * The version badge, at the very bottom of this footer (issue #269). This is the second
         * footer in the tree — `components/layout/footer.tsx` is the shell's — and `/welcome` is
         * the one page that renders this one, so the badge is mounted here as well. One
         * component, the surface's own fixture for the words.
         */}
        <div className="mt-4 border-t border-slate-200 pt-4">
          <AppVersion copy={copy} />
        </div>
      </div>
    </footer>
  );
}
