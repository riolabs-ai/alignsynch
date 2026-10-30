# Glossary

The domain's terms, defined by the schema comments in `content/`. This page is generated: do not edit it. Change the comment in the schema, then run `pnpm glossary`; the gate fails while the committed page is stale.

Each entry names the file its prose came from.

## Record

id, slug, type, status, date — the post.

Source: [content/record.ts](../content/record.ts).

## Item

a row inside a record: a question, an Aspect.

Source: [content/record.ts](../content/record.ts).

## Template

A template — a record that holds items and has no parties.

There is no `parties` key to omit: `strict()` rejects one. That is the whole difference between a template and an instance, and it is structural rather than a rule someone has to remember.

Source: [content/record.ts](../content/record.ts) — `zTemplate`.

## Instance

a template copied and given parties.

Source: [content/record.ts](../content/record.ts).

## Aspect

An Aspect — an Item in an assessment: `content/record.ts`'s item, with the fixed 1..5 band as its scale and the two Values naming that band's ends.

`leftValue` is notch 1 and `rightValue` is notch 5, exactly as the glossary defines them ("low, left, min" / "high, right, max"), so a score's direction is never ambiguous: 1 is the Left Value, 5 is the Right Value, 3 is the middle.

Source: [content/assessment.ts](../content/assessment.ts) — `zAspect`.

## Opinion

One party's opinions for one Aspect: two to four, each a score 1..5.

Feel and Wish are required because Basic is the floor — every instance that was ever played has them. Think and Guess are optional and come together. Modelling the four as four named fields rather than a tag/value list is what makes "two to four" and "no duplicates" unrepresentable-otherwise instead of invariants to check.

Source: [content/assessment.ts](../content/assessment.ts) — `zOpinionsObject`.

## Gap

The Gap: a difference of Opinion.

It is a function and never a stored field. The value is arithmetic on two scores, so a copy in the record could only ever drift from the pair it was computed from — and there is no rule that could catch it, because two authored values cannot be compared by a schema. `gapOf(2, 5) === 3`; `gapOf(4, 4) === 0` is In Synch.

The eight gap _types_ the glossary names (Feel Gap, Wish Gap, Initiator Gap, …) are not this function's business: each of them is one call over one pair of opinions, and none of them is implemented here.

Source: [content/record.ts](../content/record.ts) — `gapOf`.
