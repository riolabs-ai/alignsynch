/**
 * The ten templates through the band (#548).
 *
 * Every property below is asserted for **every** template the same way, because the card states
 * them as rules rather than as copy:
 *
 *   1. **Both parts render, and the HTML is the text.** `renderTemplate()` returns `{ text, html }`
 *      and `html` is exactly `htmlFromText(text, { preheader })` — the band's call graph, not a
 *      second body. The text carries no markup at all (no tag, no `&lt;`, no `**`), so a message
 *      cannot say one thing in a plain-text client and another in an HTML one.
 *   2. **The text is the source, not a strip of the HTML.** Two independent proofs: the fixpoint
 *      above, and a document whose prose contains `&` and `<` — the *text* keeps the raw characters
 *      and the *HTML* carries the entities. If the text were derived from the HTML it would carry
 *      `&amp;` and lose the reader's characters, which is the failure the issue names.
 *   3. **The subject is the spec's**, filled with the record's facts.
 *   4. **The class decides the footer, in both directions.** #9 is the only marketing template: it
 *      carries the unsubscribe line and the band refuses to render it without a URL. The other nine
 *      carry none and the band refuses to be handed one.
 *   5. **Nothing is invented.** The body is the `{{content_to_refine}}` marker plus the facts it was
 *      handed, and the message carries only the addresses it names — no metric, no rating, no
 *      customer name, no promise.
 *
 * The facts are fixtures, the addresses are `.test`, and no transport is involved: this file is
 * pure rendering and runs in the database-free gate. The live sends are each sending card's own
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
  invitationTemplate,
  joinedTemplate,
  membershipLapsedTemplate,
  purchaseConfirmationTemplate,
  releaseNoteTemplate,
  reminderTemplate,
  renderTemplate,
  reportReadyTemplate,
  signupConfirmationTemplate,
  supportReplyTemplate,
  templateById,
  trialEndingTemplate,
  type EmailTemplate,
  type RenderedTemplate,
} from "@/lib/email/templates";
import {
  expiryDateOf,
  reminderDueAt,
  reminderIsDue,
} from "@/lib/email/templates/invitation-reminder";
import type { ChangelogSection } from "@/lib/email/release-note";

const LINK = "https://alignsynch.com/assessment/instances/assessment-instance-avery-rowan";
const INVITE = "https://alignsynch.com/invite/abcdefghijklmnopqrstuvwxyz0123456789abcdefg";
const RELATIONSHIP = "https://alignsynch.com/dashboard/relationships/relationship-avery-rowan";
const PLAN = "https://alignsynch.com/pricing";
const UNSUBSCRIBE = "https://alignsynch.com/news/unsubscribe?token=abcdefghijklmnop";

/** One release's section, with the Known limits block the note refuses to send without. */
const RELEASE: ChangelogSection = {
  version: "9.9.9",
  date: "2026-11-06",
  body: [
    "The band reaches every mail this product sends.",
    "",
    "### Added",
    "",
    "- One shell, and the plain text is its source.",
    "",
    "### Known limits",
    "",
    "The bodies carry markers where the prose is not written.",
  ].join("\n"),
};

interface Sample {
  readonly name: string;
  readonly id: string;
  readonly numeral: number;
  readonly subject: string;
  readonly emailClass: EmailClass;
  /** The addresses the body names, in order — the site line and the unsubscribe line excluded. */
  readonly links: readonly string[];
  readonly mustSay: readonly string[];
  /** Does this body carry the `{{content_to_refine}}` marker in this pass? */
  readonly marker: boolean;
  readonly unsubscribeUrl?: string;
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
    readonly links: readonly string[];
    readonly mustSay: readonly string[];
    readonly marker?: boolean;
    readonly unsubscribeUrl?: string;
  },
): Sample {
  return {
    name: expected.name,
    subject: expected.subject,
    links: expected.links,
    mustSay: expected.mustSay,
    marker: expected.marker ?? true,
    ...(expected.unsubscribeUrl === undefined ? {} : { unsubscribeUrl: expected.unsubscribeUrl }),
    id: template.id,
    numeral: template.numeral,
    emailClass: template.emailClass,
    document: () => template.document(facts),
    render: () =>
      renderTemplate(
        template,
        facts,
        expected.unsubscribeUrl === undefined ? {} : { unsubscribeUrl: expected.unsubscribeUrl },
      ),
  };
}

const SAMPLES: readonly Sample[] = [
  sample(releaseNoteTemplate, RELEASE, {
    name: "stakeholder release note (#1)",
    subject: `${brand.name} 9.9.9 is live`,
    links: [],
    mustSay: ["Version 9.9.9", "Known limits", "One shell, and the plain text is its source."],
    // The note carries the marker only when the entry has no intro of its own; this entry has one.
    marker: false,
  }),
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
      links: [INVITE],
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
      links: [INVITE],
      mustSay: ["Relationship Basics", "2026-11-12", "Avery"],
    },
  ),
  sample(
    joinedTemplate,
    { joiner: "Rowan", inviter: "Avery", template: "Relationship Basics", link: LINK },
    {
      name: "counterparty joined (#4)",
      subject: "Rowan joined — your assessment can start",
      links: [LINK],
      mustSay: ["Rowan", "Avery", "Relationship Basics"],
    },
  ),
  sample(
    reportReadyTemplate,
    { recipient: "Avery", other: "Rowan", template: "Relationship Basics", link: LINK },
    {
      name: "Gap report ready (#5)",
      subject: "Your Gap report is ready",
      links: [LINK],
      mustSay: ["Avery", "Rowan", "Relationship Basics"],
    },
  ),
  sample(
    trialEndingTemplate,
    { recipient: "Avery", trialEndsAt: new Date("2026-11-08T09:00:00.000Z"), link: PLAN },
    {
      name: "trial ending (#6)",
      subject: "Your trial ends in 2 days",
      links: [PLAN],
      mustSay: ["Avery", "2026-11-08"],
    },
  ),
  sample(
    membershipLapsedTemplate,
    {
      recipient: "Rowan",
      template: "Relationship Basics",
      endedAt: new Date("2026-11-05T09:00:00.000Z"),
      link: RELATIONSHIP,
    },
    {
      name: "membership lapsed (#7)",
      subject: "Your relationship is read-only",
      links: [RELATIONSHIP],
      mustSay: ["Rowan", "Relationship Basics", "2026-11-05"],
    },
  ),
  sample(
    supportReplyTemplate,
    {
      recipient: "Avery",
      subject: "Invitation link expired",
      receivedAt: new Date("2026-11-04T09:00:00.000Z"),
    },
    {
      name: "support reply (#8)",
      subject: "Re: Invitation link expired",
      // The reply *is* the message: no second screen to open, so no address of its own.
      links: [],
      mustSay: ["Avery", "Invitation link expired", "2026-11-04"],
    },
  ),
  sample(
    signupConfirmationTemplate,
    { address: "avery@example.test" },
    {
      name: "signup confirmation (#9, marketing)",
      subject: "You're on the list",
      // The only address this mail carries is the unsubscribe line the band appends below the
      // footer — asserted on its own below, so it is not counted as a content link here.
      links: [],
      mustSay: ["avery@example.test"],
      unsubscribeUrl: UNSUBSCRIBE,
    },
  ),
  sample(
    purchaseConfirmationTemplate,
    { recipient: "Avery", plan: "Basic", link: PLAN },
    {
      name: "purchase confirmation (#10)",
      subject: "Your membership is active",
      links: [PLAN],
      mustSay: ["Avery", "Basic"],
    },
  ),
];

const TRANSACTIONAL = SAMPLES.filter((item) => item.emailClass === "transactional");
const MARKETING = SAMPLES.filter((item) => item.emailClass === "marketing");

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

    it(`${item.name}: names the record's facts and only its own addresses`, () => {
      const { text } = item.render();
      for (const fact of item.mustSay) expect(text).toContain(fact);
      const links = text.match(/https?:\/\/\S+/g) ?? [];
      // The band's footer carries exactly the site line (`https://<brand.domain>`) on every
      // message — compare it whole, because on the AlignSynch brand the content link shares that
      // origin. Everything else is either a content link or the unsubscribe line.
      const siteLine = `https://${brand.domain}`;
      expect(links.filter((href) => href === siteLine)).toHaveLength(1);
      const contentLinks = links.filter(
        (href) => href !== siteLine && href !== item.unsubscribeUrl,
      );
      expect(contentLinks).toEqual(item.links);
    });

    it(`${item.name}: sets the preview text explicitly, never the first body line`, () => {
      const document = item.document();
      expect(document.preheader.trim()).not.toBe("");
      const firstBlock = document.blocks[0];
      expect(document.preheader.trim()).not.toBe(
        firstBlock !== undefined && "text" in firstBlock ? firstBlock.text.trim() : "",
      );
      // The band draws the preheader as the lead paragraph, so it is in the text too.
      expect(item.render().text).toContain(document.preheader.trim());
    });

    it(`${item.name}: keeps {{content_to_refine}} where the prose is not written`, () => {
      if (!item.marker) return;
      expect(item.render().text).toContain(CONTENT_TO_REFINE);
    });
  }
});

describe("the text is the source, and the HTML is derived from it", () => {
  it("keeps the reader's raw characters in the text and escapes them only in the HTML", () => {
    const document: EmailDocument = {
      subject: "Ink & paper",
      preheader: "A preheader.",
      blocks: [{ kind: "paragraph", text: "One < two & three > zero." }],
    };
    const { text, html } = renderEmail(document, { emailClass: "transactional" });
    // The master copy: what the writer typed. A text half derived from the HTML would carry the
    // entities instead and lose the characters the reader is meant to see.
    expect(text).toContain("One < two & three > zero.");
    expect(text).not.toContain("&lt;");
    expect(text).not.toContain("&amp;");
    // The derived half: the same sentence, escaped for a client that parses markup.
    expect(html).toContain("One &lt; two &amp; three &gt; zero.");
    expect(html).toBe(htmlFromText(text, { preheader: document.preheader }));
  });
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

  it("the marketing template (#9) carries one, and the band refuses to render it without", () => {
    expect(MARKETING.map((item) => item.id)).toEqual(["signup-confirmation"]);
    const item = MARKETING[0];
    const rendered = item.render();
    expect(rendered.text).toContain(`Unsubscribe: ${UNSUBSCRIBE}`);
    expect(rendered.html).toContain("Unsubscribe:");
    // The other direction: the class is what makes the line mandatory, so the same template with a
    // transactional class and no URL refuses instead of silently mailing a list with no way out.
    expect(() => renderEmail(item.document(), { emailClass: "marketing" })).toThrow(
      /needs an unsubscribe URL/,
    );
  });

  it("every transactional template carries none", () => {
    expect(TRANSACTIONAL).toHaveLength(9);
    for (const item of TRANSACTIONAL) {
      const rendered = item.render();
      expect(rendered.text).not.toContain("Unsubscribe");
      expect(rendered.html).not.toContain("Unsubscribe");
    }
  });

  it("the transactional templates refuse one", () => {
    for (const item of TRANSACTIONAL) {
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
  it("holds templates 1–10, in order, once each", () => {
    expect(EMAIL_TEMPLATES.map((template) => template.numeral)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    const ids = EMAIL_TEMPLATES.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Every case in this file is a registered template, and the register holds nothing else.
    expect([...ids].sort()).toEqual(SAMPLES.map((item) => item.id).sort());
  });

  it("is transactional for nine of them and marketing for the signup confirmation only", () => {
    for (const item of SAMPLES) {
      expect(templateById(item.id)?.emailClass).toBe(item.emailClass);
    }
    expect(
      EMAIL_TEMPLATES.filter((t) => t.emailClass === "marketing").map((t) => t.numeral),
    ).toEqual([9]);
  });

  it("exposes each template's own subject, and the text's title is that subject", () => {
    for (const item of SAMPLES) {
      expect(typeof templateById(item.id)?.subject).toBe("function");
      // The registered subject is the document's, so a sender cannot mail one subject and print
      // another as the text's title.
      expect(item.render().subject).toBe(item.document().subject);
      expect(item.render().text.split("\n")[0]).toBe(item.document().subject);
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
