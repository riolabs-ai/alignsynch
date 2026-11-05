/**
 * Templates 2–5 through the band (#548).
 *
 * Four properties, asserted for **every** template the same way, because the card states them as
 * rules rather than as copy:
 *
 *   1. **Both parts render, and the HTML is the text.** `renderTemplate()` returns `{ text, html }`
 *      and `html` is exactly `htmlFromText(text, { preheader })` — the band's call graph, not a
 *      second body. The text carries no markup at all (no tag, no `&lt;`, no `**`), so a message
 *      cannot say one thing in a plain-text client and another in an HTML one.
 *   2. **The subject is the spec's**, filled with the record's facts — `{{inviter}} invited you to
 *      a {{template}} assessment`, `Your invitation expires in 2 days`, `{{name}} joined — your
 *      assessment can start`, `Your Gap report is ready`.
 *   3. **Transactional means no unsubscribe line**, and the rule holds in both directions: a
 *      marketing render carries one and refuses to render without it; a transactional render
 *      carries none and refuses to be handed one.
 *   4. **Nothing is invented.** The body is the `{{content_to_refine}}` marker plus the facts it
 *      was handed, and the message carries exactly one link — no metric, no promise, no second
 *      address.
 *
 * The facts are fixtures, the addresses are `.test`, and no transport is involved: this file is
 * pure rendering and runs in the database-free gate. The live sends are the card's own demo-branch
 * run, not a unit test.
 */
import { describe, expect, it } from "vitest";
import { brand } from "@/data/brand";
import {
  CONTENT_TO_REFINE,
  htmlFromText,
  renderEmail,
  type EmailClass,
  type EmailDocument,
} from "@/lib/email/band";
import {
  EMAIL_TEMPLATES,
  joinedTemplate,
  invitationTemplate,
  reminderTemplate,
  renderTemplate,
  reportReadyTemplate,
  templateById,
  type EmailTemplate,
  type RenderedTemplate,
} from "@/lib/email/templates";
import {
  expiryDateOf,
  reminderDueAt,
  reminderIsDue,
} from "@/lib/email/templates/invitation-reminder";

const LINK = "https://alignsynch.com/assessment/instances/assessment-instance-avery-rowan";
const INVITE = "https://alignsynch.com/invite/abcdefghijklmnopqrstuvwxyz0123456789abcdefg";

interface Sample {
  readonly name: string;
  readonly id: string;
  readonly numeral: number;
  readonly subject: string;
  readonly link: string;
  readonly mustSay: readonly string[];
  readonly emailClass: EmailClass;
  readonly document: () => EmailDocument;
  readonly render: () => RenderedTemplate;
}

/** One case: the template, its facts, and the two ways this file asks it for a body. */
function sample<Facts>(
  template: EmailTemplate<Facts>,
  facts: Facts,
  expected: {
    readonly name: string;
    readonly subject: string;
    readonly link: string;
    readonly mustSay: readonly string[];
  },
): Sample {
  return {
    ...expected,
    id: template.id,
    numeral: template.numeral,
    emailClass: template.emailClass,
    document: () => template.document(facts),
    render: () => renderTemplate(template, facts),
  };
}

const SAMPLES: readonly Sample[] = [
  sample(
    invitationTemplate,
    {
      inviter: "Avery",
      counterparty: "Rowan",
      template: "Relationship Basics",
      link: INVITE,
    },
    {
      name: "counterparty invitation (#2)",
      subject: "Avery invited you to a Relationship Basics assessment",
      link: INVITE,
      mustSay: ["Avery", "Rowan", "Relationship Basics"],
    },
  ),
  sample(
    reminderTemplate,
    {
      inviter: "Avery",
      template: "Relationship Basics",
      link: INVITE,
      expiresAt: new Date("2026-11-12T09:00:00.000Z"),
    },
    {
      name: "invitation reminder (#3)",
      subject: "Your invitation expires in 2 days",
      link: INVITE,
      mustSay: ["Relationship Basics", "2026-11-12", "Avery"],
    },
  ),
  sample(
    joinedTemplate,
    { joiner: "Rowan", inviter: "Avery", template: "Relationship Basics", link: LINK },
    {
      name: "counterparty joined (#4)",
      subject: "Rowan joined — your assessment can start",
      link: LINK,
      mustSay: ["Rowan", "Avery", "Relationship Basics"],
    },
  ),
  sample(
    reportReadyTemplate,
    { recipient: "Avery", other: "Rowan", template: "Relationship Basics", link: LINK },
    {
      name: "Gap report ready (#5)",
      subject: "Your Gap report is ready",
      link: LINK,
      mustSay: ["Avery", "Rowan", "Relationship Basics"],
    },
  ),
];

describe("every template renders both parts, text first", () => {
  for (const item of SAMPLES) {
    it(`${item.name}: html is htmlFromText(text)`, () => {
      const rendered = item.render();
      const document = item.document();
      expect(rendered.html).toBe(htmlFromText(rendered.text, { preheader: document.preheader }));
    });

    it(`${item.name}: the text carries no markup`, () => {
      const { text } = item.render();
      expect(text).not.toMatch(/<[a-z/!]/i);
      expect(text).not.toContain("&lt;");
      expect(text).not.toContain("&quot;");
      expect(text).not.toContain("**");
      expect(text).not.toContain("style=");
    });

    it(`${item.name}: has the spec's subject`, () => {
      const rendered = item.render();
      expect(rendered.subject).toBe(item.subject);
      // The subject is also the first line of the text — the band's title.
      expect(rendered.text.split("\n")[0]).toBe(item.subject);
    });

    it(`${item.name}: names the record's facts and carries one link`, () => {
      const { text } = item.render();
      for (const fact of item.mustSay) expect(text).toContain(fact);
      const links = text.match(/https?:\/\/\S+/g) ?? [];
      // The band's footer carries the site line (`https://<brand.domain>`) on every message; the
      // message's own link is the only other address, and it appears once.
      const contentLinks = links.filter((href) => !href.startsWith(`https://${brand.domain}`));
      expect(contentLinks).toEqual([item.link]);
    });

    it(`${item.name}: keeps {{content_to_refine}} where the prose is not written`, () => {
      expect(item.render().text).toContain(CONTENT_TO_REFINE);
    });

    it(`${item.name}: carries no unsubscribe line`, () => {
      const rendered = item.render();
      expect(rendered.text).not.toContain("Unsubscribe");
      expect(rendered.html).not.toContain("Unsubscribe");
    });
  }
});

describe("the class rule holds in both directions", () => {
  const document: EmailDocument = {
    subject: "A subject",
    preheader: "A preheader.",
    blocks: [{ kind: "paragraph", text: "Body." }],
  };

  it("a marketing render carries the unsubscribe line", () => {
    const rendered = renderEmail(document, {
      emailClass: "marketing",
      unsubscribeUrl: "https://alignsynch.com/unsubscribe?token=abc",
    });
    expect(rendered.text).toContain("Unsubscribe: https://alignsynch.com/unsubscribe?token=abc");
    expect(rendered.html).toContain("Unsubscribe:");
  });

  it("the transactional templates refuse one", () => {
    for (const item of SAMPLES) {
      expect(item.emailClass).toBe("transactional");
      expect(() =>
        renderEmail(item.document(), {
          emailClass: "transactional",
          unsubscribeUrl: "https://alignsynch.com/unsubscribe?token=abc",
        }),
      ).toThrow(/must not carry an unsubscribe line/);
    }
  });
});

describe("the register", () => {
  it("holds templates 1–5, in order, once each", () => {
    expect(EMAIL_TEMPLATES.map((template) => template.numeral)).toEqual([1, 2, 3, 4, 5]);
    const ids = EMAIL_TEMPLATES.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of SAMPLES) expect(ids).toContain(item.id);
    expect(ids).toContain("stakeholder-release-note");
  });

  it("is transactional for every flow template — no unsubscribe on any of them", () => {
    for (const item of SAMPLES) {
      expect(templateById(item.id)?.emailClass).toBe("transactional");
    }
  });
});

describe("the reminder's due window is a pure function of the stored instant", () => {
  const expiresAt = new Date("2026-11-12T09:00:00.000Z");

  it("is due 48 hours before it expires", () => {
    expect(reminderDueAt(expiresAt).toISOString()).toBe("2026-11-10T09:00:00.000Z");
  });

  it("is false a minute early, true inside the window, false once expired", () => {
    expect(reminderIsDue(expiresAt, new Date("2026-11-10T08:59:00.000Z"))).toBe(false);
    expect(reminderIsDue(expiresAt, new Date("2026-11-10T09:00:00.000Z"))).toBe(true);
    expect(reminderIsDue(expiresAt, new Date("2026-11-12T08:59:00.000Z"))).toBe(true);
    expect(reminderIsDue(expiresAt, expiresAt)).toBe(false);
  });

  it("prints the calendar date from the stored instant, not from a clock", () => {
    expect(expiryDateOf(expiresAt)).toBe("2026-11-12");
  });
});
