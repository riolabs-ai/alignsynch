import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          // The pressed shade of an accent *surface* (`content/brand.ts` `accentPress`). Not an
          // ink: on AlignSynch white on the cyan is 2.64:1, so the accent never carries white
          // text and `text-accent` is banned by `scripts/lint-brand-classes.mjs`.
          press: "var(--accent-press)",
        },
        // The brand's interactive colour (#187): `--primary` is the template's ink and
        // `--accent` is shadcn's subtle hover surface, so a CTA had no token to name and was
        // typed as `bg-purple-600` in every feature. `tailwindcss/plugin` is not involved:
        // `bg-action`, `text-action`, `bg-action/90` and `bg-nav-active` are ordinary
        // colours, resolved out of the two custom properties `lib/brand-theme.ts` paints.
        action: {
          DEFAULT: "hsl(var(--action))",
          foreground: "hsl(var(--action-foreground))",
          // A pressed button, as a token rather than a 90 % fade: `var(--action-hover)` is the
          // record's shade when it names one, and `hsl(var(--action) / 0.9)` from `:root` when it
          // does not — so QuizHub's computed hover is exactly what it was.
          hover: "var(--action-hover)",
        },
        "nav-active": "hsl(var(--nav-active))",
        /**
         * The AS2 home page's surface roles (#853) — `paper`, `mist`, `sand`, `line`, `pale`,
         * `mark`, `deep`. Resolved from the custom properties `lib/brand-theme.ts`'s
         * `brandSurfaceVars()` paints **on the page that uses them**, not on `<html>`: a role
         * added to the global set moves six unrelated parity renders for zero visual change.
         *
         * They are brand roles, not palette steps, and three of them are surfaces only — `paper`,
         * `mist`, `sand`, `line`, `pale` and `mark` are not legible as text on white, so a
         * `text-mark` in a component is a contrast defect the reviewer should catch. `deep` is the
         * one ink the page needed (a deep teal, 5.7:1) and it exists because the cyan `accent` is a
         * *surface* on this brand: `text-accent` is banned by `scripts/lint-brand-classes.mjs`.
         */
        paper: "hsl(var(--paper))",
        mist: "hsl(var(--mist))",
        sand: "hsl(var(--sand))",
        line: "hsl(var(--line))",
        pale: "hsl(var(--pale))",
        mark: "hsl(var(--mark))",
        deep: "hsl(var(--deep))",
        /**
         * The v2.0 product roles (#1120) — ported 1:1 from
         * `docs/specs/v2-bundles/09-spec-design-system-tokens-v2/js/tw-config.js`, whose values
         * are the `:root` block in `app/globals.css`. `deep` above stays the brand record's
         * `#156898`; `deep-calm` is the prototype's `--deep` and a separate token.
         *
         * They carry no surface yet (that is each surface card's diff), so every one of them is
         * unused by the tree today — exposed here so a card that draws a party tint, a status
         * chip or a scale step has a class to name and no reason to type a hex.
         */
        "deep-calm": "hsl(var(--deep-calm))",
        initiator: {
          DEFAULT: "hsl(var(--initiator))",
          ink: "hsl(var(--initiator-ink))",
          solid: "hsl(var(--initiator-solid))",
          tint: "hsl(var(--initiator-tint))",
          line: "hsl(var(--initiator-line))",
        },
        counterparty: {
          DEFAULT: "hsl(var(--counterparty))",
          ink: "hsl(var(--counterparty-ink))",
          solid: "hsl(var(--counterparty-solid))",
          tint: "hsl(var(--counterparty-tint))",
          line: "hsl(var(--counterparty-line))",
        },
        /** Purpose surfaces: progress (`status`) and payment/membership (`billing`). */
        status: {
          DEFAULT: "hsl(var(--status))",
          line: "hsl(var(--status-line))",
          chip: "hsl(var(--status-chip))",
        },
        billing: {
          DEFAULT: "hsl(var(--billing))",
          line: "hsl(var(--billing-line))",
          chip: "hsl(var(--billing-chip))",
          ink: "hsl(var(--billing-ink))",
        },
        /** The three Gap statuses — `-mark` draws the vivid bar/dot/edge, DEFAULT is the ink. */
        synch: {
          DEFAULT: "hsl(var(--synch))",
          tint: "hsl(var(--synch-tint))",
          mark: "hsl(var(--synch-mark))",
        },
        "small-gap": {
          DEFAULT: "hsl(var(--small-gap))",
          tint: "hsl(var(--small-gap-tint))",
          mark: "hsl(var(--small-gap-mark))",
        },
        gap: {
          DEFAULT: "hsl(var(--gap))",
          tint: "hsl(var(--gap-tint))",
          mark: "hsl(var(--gap-mark))",
        },
        /** The locked 1–5 answer scale: 1 warm apricot → 5 sage. Track only. */
        scale: {
          "1": "hsl(var(--scale-1))",
          "2": "hsl(var(--scale-2))",
          "3": "hsl(var(--scale-3))",
          "4": "hsl(var(--scale-4))",
          "5": "hsl(var(--scale-5))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      /**
       * The v2 layout measures (#1120, from the same `tw-config.js`): the content cap the design
       * system draws every page inside is 1440px, and the four grids the shared surfaces use —
       * the two-column shell, the detail page's aside, the five answer-scale cells and the
       * answer-row. Additive: nothing in the tree names them yet.
       */
      maxWidth: { content: "90rem" },
      gridTemplateColumns: {
        shell: "20rem minmax(0, 1fr)",
        detail: "minmax(0, 1fr) 20rem",
        scale: "repeat(5, minmax(0, 1fr))",
        answer: "7rem minmax(0, 1fr) auto",
        "answer-sm": "minmax(0, 1fr) auto",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      screens: {
        sm: "576px",
        md: "768px",
        lg: "992px",
        xl: "1280px",
        xxl: "1400px",
        "3xl": "1600px",
        "4xl": "1800px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
