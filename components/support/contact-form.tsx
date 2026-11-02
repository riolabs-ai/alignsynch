"use client";

// template-ancestor: components/assessment-flow/template-form.tsx   (variation: the account contact form — name, email, subject, a category select, a message, and one disabled submit with its reason printed beside it)

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
import { supportCategories } from "@/data/support-categories";
import { itemLabel, sectionBody } from "@/lib/page-copy";
import type { SupportCategory } from "./category";

/**
 * The contact form, disconnected on purpose (#290), and honest about it where the reader is
 * looking.
 *
 * Until #290 a submit answered with a 1.5 s `setTimeout`, a green-tick confirmation screen and a
 * random eight-character reference number, while the message, the name and the email were
 * discarded. There is no support queue, no ticket and no recipient behind this page, so the
 * honest shape is the form's markup plus visible words: the banner names the mailbox that does
 * reach a person, and `submit-note` sits directly above the control that cannot fire.
 *
 * **Why the note is beside the button and not only at the top.** A reader scrolls to the submit
 * after typing, which is the moment "did this go anywhere?" is a live question. The sentence is
 * printed there, and the disabled button points at it with `aria-describedby`, so the reason is
 * announced by a screen reader and not only painted. There is no submit handler, no state and no
 * success branch to reach; wiring it later is a smaller change than one more screen that lies
 * (`lib/flow/email.ts` already reports `sent` / `unset` / `failed`).
 *
 * The words and every label come from `data/pages/support.ts`; the address is the brand record's
 * (`brand.supportEmail`), passed down from the route so the fixture carries no literal address.
 * The `{email}` placeholder in the banner is intentional: the view splits on it to wrap the
 * address in its own `mailto:` link, so a brand swap moves the link with the words.
 *
 * The fields stay enabled and uncontrolled — a reader can draft and copy what they are about to
 * send — but a disabled control that carries its reason is a different thing from a control that
 * silently does nothing.
 */
interface ContactFormProps {
  /**
   * The category the select starts on. Optional because the account page has no category rail to
   * carry one — the help centre's rail passes its selection when it renders this form's sibling
   * panels, and the account page lets the form start where the taxonomy's "I do not know which"
   * lives.
   */
  selectedCategory?: SupportCategory;
  copy: PageCopySection;
  categoryCopy: PageCopySection;
  supportEmail: string;
}

/** The id the disabled submit points at — one value, so the pair cannot drift apart. */
const SUBMIT_NOTE_ID = "support-submit-note";

export function ContactForm({
  selectedCategory = "general",
  copy,
  categoryCopy,
  supportEmail,
}: ContactFormProps) {
  const [before, after] = itemLabel(copy, "not-connected").split("{email}");
  /** The categories this build offers — the same list the help centre's rail uses (#313). */
  const offered: readonly SupportCategory[] = supportCategories;

  return (
    <Card className="p-6">
      <h2 className="mb-2 text-2xl font-bold">{copy.heading}</h2>
      <p className="mb-6 text-sm text-muted-foreground">{sectionBody(copy)}</p>

      <p className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        {before}
        <a className="font-medium underline" href={`mailto:${supportEmail}`}>
          {supportEmail}
        </a>
        {after}
      </p>

      <form className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">{itemLabel(copy, "name")}</Label>
            <Input id="name" placeholder={itemLabel(copy, "name-placeholder")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{itemLabel(copy, "email")}</Label>
            <Input id="email" type="email" placeholder={itemLabel(copy, "email-placeholder")} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="subject">{itemLabel(copy, "subject")}</Label>
            <Input id="subject" placeholder={itemLabel(copy, "subject-placeholder")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">{itemLabel(copy, "category")}</Label>
            <Select
              defaultValue={offered.includes(selectedCategory) ? selectedCategory : "general"}
            >
              <SelectTrigger>
                <SelectValue placeholder={itemLabel(copy, "category-placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {offered.map((id) => (
                  <SelectItem key={id} value={id}>
                    {itemLabel(categoryCopy, id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="message">{itemLabel(copy, "message")}</Label>
          <Textarea id="message" placeholder={itemLabel(copy, "message-placeholder")} rows={6} />
        </div>

        <div className="space-y-3">
          {/*
            The honest state line, beside the control it describes. `role="status"` because it is
            a state the reader is being told, not an alert they must act on.
          */}
          <p id={SUBMIT_NOTE_ID} role="status" className="text-sm text-muted-foreground">
            {itemLabel(copy, "submit-note")}
          </p>
          <Button
            type="submit"
            className="w-full md:w-auto"
            disabled
            aria-describedby={SUBMIT_NOTE_ID}
          >
            {itemLabel(copy, "submit")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
