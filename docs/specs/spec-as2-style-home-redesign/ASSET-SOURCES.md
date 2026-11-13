# Image asset sources

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Product** › AS2 redesign — asset sources and credits · prev [AS2 home redesign — implementation brief](IMPLEMENTATION-PROMPT.md) · next [V2 home and brand package (handoff)](../spec-design-page-rel-templates-v2/README.md)

<!-- docs-nav:end -->

The static prototype uses local files so the preview does not depend on third-party image hosts. These records preserve the original source URLs for design review and any later asset replacement.

| Local file                      | Use in page                                           | Source                                                                                                                                                                                                                                                          |
| ------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `images/alignsynch-logo.png`    | Full AlignSynch logo in the preview header and footer | The app's canonical brand lockup is `public/brand/as2-logo_v2_cl.png`.                                                                                                                                                                                          |
| `images/personal-life.avif`     | Personal Life hero card                               | [Unsplash image endpoint](https://images.unsplash.com/photo-1758523416144-d100288c5451?auto=format&fit=crop&w=1400&q=82)                                                                                                                                        |
| `images/business-life.avif`     | Business Life hero card                               | [Pexels image endpoint](https://images.pexels.com/photos/4962981/pexels-photo-4962981.jpeg?auto=compress&cs=tinysrgb&w=1400) · [Pexels photo page](https://www.pexels.com/photo/people-discussing-business-while-sitting-outside-with-a-cup-of-coffee-4962981/) |
| `images/relationship-gaps.avif` | The Bread / four-gap explainer                        | [Unsplash image endpoint](https://images.unsplash.com/photo-1713942590288-cd74f53b42d1?auto=format&fit=crop&w=1200&q=84)                                                                                                                                        |
| `images/opinions-scale.avif`    | The Butter / opinion-scale explainer                  | [Unsplash image endpoint](https://images.unsplash.com/photo-1764173039891-b88c697ef093?auto=format&fit=crop&w=1200&q=84)                                                                                                                                        |

The supplied screenshot is at `reference/alignsynch_home.jpg`. The photo files are bundled as AVIF; keep the `.avif` extension and serve them with the matching image MIME type. Before production deployment, confirm each photo's usage terms and any attribution requirements against its source page.

## Resolution — authors and licences (added when the credits landed)

Attribution is **not** required by either licence. It is published anyway, at `/terms`, section
"Photography credits", for the reason a licence can change and a reader deserves to know where a
picture came from.

| Local file                      | Platform | Photographer                        | Licence                                                         |
| ------------------------------- | -------- | ----------------------------------- | --------------------------------------------------------------- |
| `images/personal-life.avif`     | Unsplash | **not recorded** in this asset list | Unsplash License — free commercial use, no attribution required |
| `images/business-life.avif`     | Pexels   | **Ketut Subiyanto**                 | Pexels License — free commercial use, no attribution required   |
| `images/relationship-gaps.avif` | Unsplash | **not recorded** in this asset list | Unsplash License                                                |
| `images/opinions-scale.avif`    | Unsplash | **not recorded** in this asset list | Unsplash License                                                |

**Why three names are missing, and how to fill them.** The Unsplash entries above are CDN
endpoints (`images.unsplash.com/photo-…`), not photo pages. A photographer name lives on the photo
page (`unsplash.com/photos/<id>`), and the CDN filename does not carry that id — `oembed` on a CDN
URL returns nothing, and the AVIF files contain no XMP author block (their only metadata is the
sRGB ICC profile). So the record says what is true instead of inventing a name.

To fill them: supply the four photo page URLs (or an Unsplash API access key), and each row gains a
name. The credits section in `data/pages/legal.ts` changes with it — the two are updated together.

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Product** › AS2 redesign — asset sources and credits · prev [AS2 home redesign — implementation brief](IMPLEMENTATION-PROMPT.md) · next [V2 home and brand package (handoff)](../spec-design-page-rel-templates-v2/README.md)

<!-- docs-nav:end -->
