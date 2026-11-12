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
