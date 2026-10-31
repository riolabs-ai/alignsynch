"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { PageCopySection } from "@/content/pages";
import { itemLabel } from "@/lib/page-copy";
import type { SupportCategory } from "./support-page";

/**
 * The contact form, disconnected on purpose (#290).
 *
 * Until #290 a submit answered with a 1.5 s `setTimeout`, a green-tick confirmation screen and a
 * random eight-character reference number, while the message, the name and the email were
 * discarded. There is no support queue, no ticket and no recipient behind this page, so the
 * honest shape is the form's markup plus one visible line naming where to write instead, and a
 * submit control that cannot fire.
 *
 * The sentence and every label come from `data/pages/support.ts`; the address is the brand
 * record's (`brand.supportEmail`), passed down from the route so the fixture carries no
 * literal address. The sentence keeps its `{email}` placeholder by design: the view splits on
 * it to wrap the address in its own `mailto:` link, so a brand swap moves the link with the
 * words.
 *
 * The fields stay enabled and uncontrolled — a reader can draft and copy what they are about
 * to send — but there is no submit handler, no state and no success branch to reach. Wiring it
 * later is a smaller change than one more screen that lies: `lib/flow/email.ts` already reports
 * `sent` / `unset` / `failed`.
 */
interface ContactFormProps {
  selectedCategory: SupportCategory;
  copy: PageCopySection;
  categoryCopy: PageCopySection;
  supportEmail: string;
}
export function ContactForm({
  selectedCategory,
  copy,
  categoryCopy,
  supportEmail,
}: ContactFormProps) {
  const [before, after] = itemLabel(copy, "not-connected").split("{email}");

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-6">{copy.heading}</h2>

      <p className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        {before}
        <a className="font-medium underline" href={`mailto:${supportEmail}`}>
          {supportEmail}
        </a>
        {after}
      </p>

      <form className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="name">{itemLabel(copy, "name")}</Label>
            <Input id="name" placeholder={itemLabel(copy, "name-placeholder")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{itemLabel(copy, "email")}</Label>
            <Input id="email" type="email" placeholder={itemLabel(copy, "email-placeholder")} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="subject">{itemLabel(copy, "subject")}</Label>
            <Input id="subject" placeholder={itemLabel(copy, "subject-placeholder")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">{itemLabel(copy, "category")}</Label>
            <Select defaultValue={selectedCategory === "all" ? "general" : selectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder={itemLabel(copy, "category-placeholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="account">{itemLabel(categoryCopy, "account")}</SelectItem>
                <SelectItem value="billing">{itemLabel(categoryCopy, "billing")}</SelectItem>
                <SelectItem value="quiz-creation">
                  {itemLabel(categoryCopy, "quiz-creation")}
                </SelectItem>
                <SelectItem value="tournaments">
                  {itemLabel(categoryCopy, "tournaments")}
                </SelectItem>
                <SelectItem value="privacy">{itemLabel(categoryCopy, "privacy")}</SelectItem>
                <SelectItem value="technical">{itemLabel(categoryCopy, "technical")}</SelectItem>
                <SelectItem value="general">{itemLabel(categoryCopy, "general")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="message">{itemLabel(copy, "message")}</Label>
          <Textarea id="message" placeholder={itemLabel(copy, "message-placeholder")} rows={6} />
        </div>

        <Button type="submit" className="w-full md:w-auto" disabled>
          {itemLabel(copy, "submit")}
        </Button>
      </form>
    </Card>
  );
}
