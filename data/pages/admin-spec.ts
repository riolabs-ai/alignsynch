/**
 * `/admin/spec` — the project spec's R0 spine (#1252).
 *
 * **What this card builds, and what it does not.** The R0 spine is the *architecture* of the
 * surface: the `stakeholder` role, the `spec-read` capability, the three gated routes, the sign-in
 * landing and the rail row. The reader — the pinned Validation column, the submenu, the eleven story
 * pages and their counts — is the next card (t_f5458e3d), parented on this one, so the words here
 * describe the spine and promise the reader rather than inventing a layout the reader will replace.
 *
 * **What may never be here.** No agreement wording, no fees, no addresses and no phone numbers: the
 * spec is NDA material and this fixture is a copy surface, so `public/` and the client bundle see
 * none of it (AS-10). The confidential notice below is the one sentence that is allowed to say so.
 *
 * **One fixture, three routes.** `/admin/spec`, `/admin/spec/validation` and `/admin/spec/[group]`
 * are the same surface at three depths, as `/admin/docs` and its two derived views are one fixture
 * (`data/pages/index.ts` keys all three).
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const adminSpecPageCopy: PageCopy = zPageCopy.parse({
  heading: "Project Spec",
  subtitle:
    "The read-only spine of the project spec: what is agreed, what is delivered, and the evidence for each. Visible to stakeholders, admins and owners; everyone else is answered with the same 404 an unknown address returns.",
  cta: { label: "Open Validation", href: "/admin/spec/validation" },
  items: [
    {
      id: "confidential",
      label: "Confidential — do not circulate outside the people named above.",
    },
    { id: "read-only", label: "Read-only" },
    { id: "spine-heading", label: "The spine is in place" },
    {
      id: "spine-body",
      label:
        "The role, the capability, the gate and this rail row ship first, so the reader that follows is a set of pages behind a gate that already works — not a new surface with a new decision about who may see it.",
    },
    { id: "overview-heading", label: "Overview" },
    {
      id: "overview-body",
      label:
        "One page per group, plus the Validation matrix that counts them. The reader draws itself from the validation source at request time, so an edited source is live without a rebuild.",
    },
    { id: "validation-heading", label: "Validation" },
    {
      id: "validation-body",
      label:
        "The matrix is pinned, always expanded and never one click deeper: every row carries its definition of done and the release it is evidenced in.",
    },
    { id: "reader-next", label: "The reader itself lands in the next card." },
    { id: "group-heading", label: "Group" },
    // The `[group]` page asks for this one; a group id it does not know renders the same panel with
    // the id the address named, so a typo is visible instead of empty.
    {
      id: "group-body",
      label:
        "{group} — one group's story: what was agreed, what is true today, its status and its evidence.",
    },
  ],
});
