# Contact landing — the pages, looked at

Six screenshots from the AlignSynch build (`BRAND=alignsynch pnpm build`, `next start` on
`:3131`), captured at 1440×900 and 390×844 through Chrome's device emulation. They exist because
a text assertion cannot prove a page: the markup can be right and the band can still be off the
bottom, the wrong width or behind the footer.

| file                 | what it is                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| `help-1440.png`      | `/help`, top of the page, desktop                                                                     |
| `help-390.png`       | `/help`, top of the page, phone                                                                       |
| `help-form-1440.png` | `/help` scrolled to `#contact` — the form and the footer's contact band, desktop                      |
| `help-form-390.png`  | the same band at phone width — every field and the submit are inside the card, no horizontal overflow |
| `support-1440.png`   | `/support`'s account page, desktop                                                                    |
| `support-390.png`    | the same page at phone width — the narrow icon rail, no horizontal overflow                           |

**`/support` needs a session, and these shots do not enter one.** The route answers `307` to
`/help` for any request without a session (`app/(mainlayout)/support/page.tsx`), which is the
correct answer for a visitor and the wrong one for a screenshot of the account page. The two
`support-*.png` shots are therefore the **same component the route mounts**
(`AccountSupportPage` with `supportPageCopy`) inside the **same `(mainlayout)` chrome**, rendered
from a throwaway `/preview/support` route that was deleted before the commit — no demo PIN, no
seeded account and no credential was typed to manufacture a session. What that proves is the
layout: the band shows one button pointing at the form, and no form and no address. What it does
not prove is the signed-in header (name, avatar) — the chrome renders signed out, which is why
the header disc is neutral.
