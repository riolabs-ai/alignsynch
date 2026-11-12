/**
 * **One surface takes a card, and the tree cannot grow a second one (#912).**
 *
 * This file replaces `payment-capture-dialog.test.tsx`. That file asserted a *dialog*: a plan card,
 * an embedded frame and an in-place capture on the relationship screen. The card that wrote it is
 * the one #912 reverses — "the modal is the only way to pay" — so the assertions are now the
 * opposite, and they are written as a **sweep** rather than as a render, because the defect class
 * is "a fourth capture path the audit then finds", not "this one renders wrong".
 *
 * Three seams, and each answers a different question:
 *
 *   the file is gone     a capture-dialog module cannot be re-mounted by a later card, because it
 *                        does not exist. Asserted on disk, not by import, so a copy under another
 *                        name still fails the second check.
 *   one mount            `components/billing/stripe-frame.tsx` is the only module that can draw
 *                        Stripe's fields, so the set of files that *mention* it is the set of card
 *                        captures. Stage 5's walk is the one caller; the dashboard is not.
 *   the words            the fixture labels a person reads are checked for the vocabulary the card
 *                        retires, and `relationships.test`-style negative cases mean a new label
 *                        cannot reintroduce it quietly.
 *
 * Nothing here renders a Stripe form: the tree has no provider key in the gate and `loadStripe()`
 * would open a network connection from a unit test. The claim is about **where** the capture lives,
 * which is a property of the source, and that is what is measured.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const SOURCE_DIRS = ["components", "app", "lib"] as const;

/** Every `.ts`/`.tsx` file under a directory, recursively. */
function sourceFiles(dir: string): string[] {
  const absolute = join(ROOT, dir);
  if (!existsSync(absolute)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(absolute)) {
    const path = join(absolute, entry);
    if (statSync(path).isDirectory()) {
      found.push(...sourceFiles(relative(ROOT, path)));
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      found.push(path);
    }
  }
  return found;
}

/** Every source file in the app tree, relative to the repo root, with its text. */
const SOURCES = SOURCE_DIRS.flatMap((dir) =>
  sourceFiles(dir).map((path) => ({
    path: relative(ROOT, path).replaceAll("\\", "/"),
    text: readFileSync(path, "utf8"),
  })),
);

/** The one module allowed to mount a provider frame. */
const FRAME = "components/billing/stripe-frame.tsx";

/** The one component allowed to call it — stage 5's pay walk, the modal. */
const WALK = "components/assessment-flow/invite-walk.tsx";

describe("there is exactly one card capture in the app", () => {
  it("the capture dialog does not exist", () => {
    // #748 shipped a dialog on the relationship screen; #912 retires it rather than editing it,
    // because "becomes a route into the modal" and "stops capturing" are the same deliverable and a
    // deleted module cannot be re-mounted without a reviewer seeing the file come back.
    expect(existsSync(join(ROOT, "components/dashboard/payment-capture-dialog.tsx"))).toBe(false);
  });

  it("only stage 5's walk imports the provider frame", () => {
    /*
     * `StripeFrame` is the whole surface of "take a card": it calls `loadStripe()` and mounts the
     * provider's iframe. So the callers of that module *are* the card captures, and the assertion is
     * an exact set rather than a count — a new caller fails with its own filename in the message,
     * which is the thing a reviewer needs to read.
     */
    const callers = SOURCES.filter(
      (file) =>
        file.path !== FRAME && /from "@\/components\/billing\/stripe-frame"/.test(file.text),
    ).map((file) => file.path);
    expect(callers).toEqual([WALK]);
  });

  it("nothing else calls loadStripe, and no file names an add-method control", () => {
    // A second implementation would not have to import the frame — it could import Stripe directly,
    // or draw a button that asks a server action for a client secret. Both are the same defect, so
    // both are swept: the loader's name and the marker the retired dialog carried.
    //
    // **Comments are stripped first, and that is the point of the distinction.** A docstring that
    // explains why the frame is the only one (`lib/billing/adapters/stripe.ts` does, and so does the
    // frame itself) names `loadStripe()` without calling it; a module that *calls* it is a second
    // capture. Reading the code rather than the prose is what makes the sweep mean something.
    const stripped = (text: string) =>
      text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const offenders = SOURCES.filter(
      (file) =>
        file.path !== FRAME &&
        (/loadStripe\s*\(/.test(stripped(file.text)) ||
          /data-add-method/.test(stripped(file.text))),
    ).map((file) => file.path);
    expect(offenders).toEqual([]);
  });
});

describe("the words the card retires are on no payment surface", () => {
  /**
   * The vocabulary #912 bans, as a regular expression over the **fixtures** (what a reader sees) and
   * over the two components that draw a payment band. Prose in a docstring is allowed to name the
   * retired words — that is how this file documents them — so the sweep reads `data/pages/**` and
   * the two live surfaces, never the whole tree.
   */
  const BANNED = /add payment method|save payment method|\bpurchase\b|\bbuy\b/i;

  const PAYMENT_SURFACES = [
    "data/pages/dashboard-relationship-detail.ts",
    "data/pages/dashboard-relationships.ts",
    "data/pages/assessment-create.ts",
    "components/dashboard/relationship-detail.tsx",
    "components/dashboard/relationship-cards.tsx",
    "components/assessment-flow/invite-walk.tsx",
    "components/assessment-flow/create-relationship.tsx",
  ];

  it.each(PAYMENT_SURFACES)("%s carries none of them", (path) => {
    const text = readFileSync(join(ROOT, path), "utf8");
    // Comments are stripped first: a docstring explaining *why* a word was removed has to be able to
    // quote it, and the copy a person reads never comes from a comment (E23 counts the same split).
    const withoutComments = text
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    expect(withoutComments).not.toMatch(BANNED);
  });
});
