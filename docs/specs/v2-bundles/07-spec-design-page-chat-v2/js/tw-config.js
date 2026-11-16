// Mirrors quizhub/tailwind.config.ts 1:1 (colors, radius, screens) + the v2 tokens.
// Port: copy `theme.extend` into tailwind.config.ts and the :root block of tokens.css into app/globals.css.
const v = (n) => `hsl(var(--${n}) / <alpha-value>)`;
tailwind.config = {
  theme: {
    extend: {
      colors: {
        background: v("background"), foreground: v("foreground"),
        card: { DEFAULT: v("card"), foreground: v("card-foreground") },
        popover: { DEFAULT: v("popover"), foreground: v("popover-foreground") },
        primary: { DEFAULT: v("primary"), foreground: v("primary-foreground") },
        secondary: { DEFAULT: v("secondary"), foreground: v("secondary-foreground") },
        muted: { DEFAULT: v("muted"), foreground: v("muted-foreground") },
        accent: { DEFAULT: v("accent"), foreground: v("accent-foreground"), press: "var(--accent-press)" },
        action: { DEFAULT: v("action"), foreground: v("action-foreground"), hover: "var(--action-hover)" },
        "nav-active": v("nav-active"),
        destructive: { DEFAULT: v("destructive"), foreground: v("destructive-foreground") },
        border: v("border"), input: v("input"), ring: v("ring"),
        paper: v("paper"), mist: v("mist"), sand: v("sand"), line: v("line"),
        pale: v("pale"), mark: v("mark"), deep: v("deep"),
        initiator: { DEFAULT: v("initiator"), ink: v("initiator-ink"), solid: v("initiator-solid"), tint: v("initiator-tint"), line: v("initiator-line") },
        counterparty: { DEFAULT: v("counterparty"), ink: v("counterparty-ink"), solid: v("counterparty-solid"), tint: v("counterparty-tint"), line: v("counterparty-line") },
        status: { DEFAULT: v("status"), line: v("status-line"), chip: v("status-chip") },
        billing: { DEFAULT: v("billing"), line: v("billing-line"), chip: v("billing-chip"), ink: v("billing-ink") },
        synch: { DEFAULT: v("synch"), tint: v("synch-tint"), mark: v("synch-mark") },
        "small-gap": { DEFAULT: v("small-gap"), tint: v("small-gap-tint"), mark: v("small-gap-mark") },
        gap: { DEFAULT: v("gap"), tint: v("gap-tint"), mark: v("gap-mark") },
        scale: { 1: v("scale-1"), 2: v("scale-2"), 3: v("scale-3"), 4: v("scale-4"), 5: v("scale-5") },
      },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
      maxWidth: { content: "90rem" },
      gridTemplateColumns: { shell: "20rem minmax(0, 1fr)", detail: "minmax(0, 1fr) 20rem", scale: "repeat(5, minmax(0, 1fr))", answer: "7rem minmax(0, 1fr) auto", "answer-sm": "minmax(0, 1fr) auto" },
      fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"] },
      screens: { sm: "576px", md: "768px", lg: "992px", xl: "1280px", xxl: "1400px", "3xl": "1600px", "4xl": "1800px" },
    },
  },
};
