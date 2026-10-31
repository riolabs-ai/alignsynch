import { Button } from "@/components/ui/button";
import type { PageCopySection } from "@/content/pages";
import { brand } from "@/data/brand";
import { itemLabel } from "@/lib/page-copy";
import { ArrowRight } from "lucide-react";

export function AffiliateCta({ copy }: { copy: PageCopySection }) {
  return (
    <section className="py-20 bg-action text-action-foreground">
      <div className="container px-4 mx-auto">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">{copy.heading}</h2>
          <p className="text-lg text-action-foreground/80 mb-8 max-w-2xl mx-auto">{copy.body}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-white text-action hover:bg-white/90 border-0 shadow-lg hover:shadow-xl transition-all duration-200"
            >
              {itemLabel(copy, "join-now")}
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-white text-white hover:bg-white/10 hover:text-white"
            >
              {itemLabel(copy, "learn-more")} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <p className="mt-8 text-sm text-action-foreground/70">
            {itemLabel(copy, "contact-prompt")}
            <a href={`mailto:${brand.affiliateEmail}`} className="underline hover:text-white">
              {itemLabel(copy, "contact-email")}
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
