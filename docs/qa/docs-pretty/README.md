# The docs, before and after the #937 pass

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Records & QA** › The docs before and after formatting, #937 · prev [Contact landing](../contact-land/README.md) · next [Six flow stages](../flow-stages/README.md)

<!-- docs-nav:end -->

Six stills of `/admin/docs` on the tree that adopted the markdown formatter, captured at 1440 and
390 CSS pixels. They are the "after" half of #937's evidence; the "before" half is held outside the
tree (`~/.hermes/profiles/alignsynch/artifacts/docs-pretty/`) rather than committed, because the raw
captures are 0.4–5 MB each and a repository is not a screenshot store.

What changed for a reader: the hub is unchanged by design (it lists filenames), and an article page
now renders the markdown it is written in — tables as tables, `> [!NOTE]` as a callout — because
`react-markdown` reaches the page through `remark-gfm` and `remark-github-blockquote-alert`
(`components/admin/docs/doc-article.tsx`, added in its own commit so it can be reverted alone).

| still                                        | surface                                          |
| -------------------------------------------- | ------------------------------------------------ |
| [`docs-hub-1440.png`](docs-hub-1440.png)     | the `/admin/docs` hub, desktop                   |
| [`docs-hub-390.png`](docs-hub-390.png)       | the same hub, mobile                             |
| [`docs-table-1440.png`](docs-table-1440.png) | an article whose content tables now render, wide |
| [`docs-table-390.png`](docs-table-390.png)   | the same article, mobile                         |
| [`docs-alert-1440.png`](docs-alert-1440.png) | an article carrying a GitHub alert, desktop      |
| [`docs-alert-390.png`](docs-alert-390.png)   | the same article, mobile                         |

## How they were taken

Headless Chrome over CDP (`--remote-debugging-port=9333`) against the local server on port 3411,
signed in through the demo door at `/login` — the **Admin** role, `DEMO_PIN` supplied through
`withenv.sh` and never printed — then `/admin/docs` and the two article pages it links, at 1440 wide
and again with `Emulation.setDeviceMetricsOverride` at 390. Each capture is a full-page PNG, re-encoded
down to well under 200 KB so the set stays inside the bar that keeps a `docs/` binary from becoming a
repository-sized problem; no page was cropped to get there.

## What the pass did not change

Not one word. `tests/md-normalised.test.ts` normalises every page (fences, table pipes, list markers,
alert syntax and whitespace stripped) and requires the remaining word sequence to equal the
pre-format tree's, page by page. Formatting only — the headings, the prose and the links are the same
bytes a reader saw before, and `pnpm md:check` is what keeps them that way.

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Records & QA** › The docs before and after formatting, #937 · prev [Contact landing](../contact-land/README.md) · next [Six flow stages](../flow-stages/README.md)

<!-- docs-nav:end -->
