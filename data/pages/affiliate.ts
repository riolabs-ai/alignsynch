/**
 * `/affiliate` — the affiliate marketing page's copy (WU-9).
 *
 * Every visible string `components/affiliate/**` renders lives here: the hero (its eyebrow,
 * heading and subtitle are page-level, the dashboard card's heading/body and the labels inside
 * both columns are `affiliate-hero` items), the five step cards, the calculator's labels and
 * captions, the nine program features, the about band, the why-partner band with its comparison
 * table, the eight FAQ pairs, the stories band's badge and the closing call to action.
 * `app/(mainlayout)/affiliate/page.tsx` parses this module at import and passes one section down
 * per component, so editing a line here changes `/affiliate` with no `.tsx` edit.
 *
 * Conventions this fixture follows, and the traps it inherits from the original JSX:
 *
 *  - Every button on the page is a control: none of them had an `href` (the two `Link`s the page
 *    renders are lucide icons carrying `href="#"`), so their labels are `items`, not `cta`. No
 *    destination was invented to satisfy the schema.
 *  - `{percent}` / `{step}` / `{earnings}` are filled at render (`fillLabel`) from what the
 *    component already computes — `formatPercentValue(affiliate.maxCommission)`, the step index,
 *    the story's `earnings`. No number is spelled into the copy here.
 *  - JSX collapses a source line break to one space, so the strings below carry the spaces that
 *    were explicit in the JSX and would otherwise be lost: `About ${brand} ` (trailing space on the
 *    heading), `promoting ${brand} ` (the `{" "}` in why-partner's body), `on ${brand} ` (the
 *    calculator's average-value caption), `Already an affiliate? ` (how-to-start) and
 *    `Contact our affiliate team at ` (the closing CTA). Keep them.
 *  - `affiliate-hero`'s `heading` is spelled with a `\n` not for a line break but because the
 *    original heading renders its second line in the accent span: the view takes `headingLines()`
 *    and styles the second line instead of inserting a `<br />`. The rendered text is
 *    `Turn Your Audience Into Revenue` in one flowing line, exactly as before.
 *
 * Not here: the testimonial records (success-stories' `stories`, why-partner's `testimonials` —
 * quote/author/role/earnings/rating/avatar) and the `alt` text. A repeated row that is really a
 * record has no schema in P2; those arrays stay in their components and are left for a later
 * fixture (the `Testimonial` row named in `docs/P2-INVENTORY.md`).
 */
import { brand } from "../brand";
import { zPageCopy, type PageCopy } from "../../content/pages";

export const affiliatePageCopy: PageCopy = zPageCopy.parse({
  eyebrow: "Affiliate Program",
  heading: "Turn Your Audience Into\nRevenue",
  subtitle:
    "Join our affiliate program and earn up to {percent} commission on every referral. Share quality quiz content and get rewarded for every new user you bring.",
  sections: [
    {
      id: "affiliate-hero",
      // The card in the hero's right column; the page's own heading/subtitle are above.
      heading: "Affiliate Dashboard",
      body: "Track your performance and earnings in real-time",
      items: [
        {
          id: "benefit-earn-commission",
          label: "Earn {percent} commission on all referral purchases",
        },
        { id: "benefit-monthly-payout", label: "Get paid monthly with no minimum threshold" },
        { id: "benefit-analytics", label: "Access detailed analytics and performance tracking" },
        {
          id: "benefit-marketing",
          label: "Receive marketing materials and dedicated support",
        },
        { id: "become-affiliate", label: "Become an Affiliate" },
        { id: "learn-more", label: "Learn More" },
        { id: "stat-commission", label: "Commission" },
        { id: "stat-affiliates", label: "Affiliates" },
        { id: "stat-paid-out", label: "Paid Out" },
        { id: "this-month", label: "This Month" },
        { id: "monthly-goal-progress", label: "{percent} of monthly goal" },
        { id: "new-signups", label: "New Signups" },
        { id: "conversions", label: "Conversions" },
        { id: "commission-rate", label: "Commission Rate" },
      ],
    },
    {
      id: "how-to-start",
      heading: "How to Start Earning",
      body: `Getting started with our affiliate program is simple. Follow these steps and start earning passive income by sharing ${brand.name} with your audience.`,
      items: [
        { id: "step-label", label: "STEP {step}" },
        {
          id: "sign-up",
          label: "Sign Up",
          value:
            "Create your free affiliate account in less than 2 minutes with just a few simple steps.",
        },
        {
          id: "share-your-link",
          label: "Share Your Link",
          value:
            "Get your unique referral link and share it with your audience through social media, email, or your website.",
        },
        {
          id: "refer-users",
          label: "Refer Users",
          value:
            "Your audience signs up using your unique referral link. We track all referrals automatically.",
        },
        {
          id: "earn-commission",
          label: "Earn Commission",
          value:
            "Earn up to 30% commission on all referred user subscriptions for the lifetime of their account.",
        },
        {
          id: "track-performance",
          label: "Track Performance",
          value:
            "Monitor your earnings and optimize your strategy with our comprehensive analytics dashboard.",
        },
        { id: "become-affiliate", label: "Become an Affiliate" },
        { id: "already-an-affiliate", label: "Already an affiliate? " },
        { id: "sign-in", label: "Sign in to your dashboard" },
      ],
    },
    {
      id: "profit-calculator",
      heading: "Calculate Your Potential Earnings",
      body: `Use our calculator to estimate how much you could earn as a ${brand.name} affiliate. Adjust the sliders to match your audience and see your potential earnings.`,
      items: [
        { id: "monthly-referrals", label: "Monthly Referrals" },
        {
          id: "monthly-referrals-hint",
          label: `The number of people you refer to ${brand.name} each month`,
        },
        { id: "conversion-rate", label: "Conversion Rate" },
        {
          id: "conversion-rate-hint",
          label: "The percentage of referrals who become paying customers",
        },
        { id: "average-purchase-value", label: "Average Purchase Value" },
        {
          id: "average-purchase-value-hint",
          label: `The average amount your referrals spend on ${brand.name} `,
        },
        { id: "earnings-potential", label: "Your Earnings Potential" },
        {
          id: "commission-note",
          label: "Based on your audience and our {percent} commission rate",
        },
        { id: "summary-monthly-referrals", label: "Monthly Referrals" },
        { id: "summary-conversions", label: "Conversions" },
        { id: "monthly-earnings", label: "Monthly Earnings" },
        { id: "yearly-earnings", label: "Yearly Earnings" },
        {
          id: "disclaimer",
          label:
            "* These calculations are estimates and actual earnings may vary based on multiple factors.",
        },
      ],
    },
    {
      id: "program-features",
      heading: "Program Features",
      body: "Our affiliate program is designed to maximize your earnings while providing all the tools and support you need to succeed.",
      items: [
        {
          id: "high-commission-rates",
          label: "High Commission Rates",
          value: "Earn up to 30% commission on all referred user subscriptions for the first year.",
        },
        {
          id: "real-time-analytics",
          label: "Real-time Analytics",
          value: "Track your performance with detailed analytics and reporting tools.",
        },
        {
          id: "custom-referral-links",
          label: "Custom Referral Links",
          value: "Create and manage multiple custom referral links for different campaigns.",
        },
        {
          id: "90-day-cookie",
          label: "90-Day Cookie",
          value: "Our 90-day cookie duration ensures you get credit for delayed conversions.",
        },
        {
          id: "secure-payments",
          label: "Secure Payments",
          value: "Get paid reliably via PayPal, bank transfer, or cryptocurrency.",
        },
        {
          id: "dedicated-support",
          label: "Dedicated Support",
          value: "Access to a dedicated affiliate manager to help optimize your strategy.",
        },
        {
          id: "performance-bonuses",
          label: "Performance Bonuses",
          value: "Earn additional bonuses when you exceed your monthly targets.",
        },
        {
          id: "instant-approval",
          label: "Instant Approval",
          value: "Get started immediately with our instant approval process.",
        },
        {
          id: "global-program",
          label: "Global Program",
          value: "Our affiliate program is open to partners worldwide with no restrictions.",
        },
      ],
    },
    {
      id: "about-quizhub",
      // The original JSX was `<h2>About {brand}</h2>` — the trailing space is rendered copy.
      heading: `About ${brand.name} `,
      body: "The leading platform revolutionizing how people create, share, and experience quizzes worldwide",
      items: [
        { id: "our-story", label: "Our Story" },
        {
          id: "story-origin",
          label: `Founded in 2018, ${brand.name} began with a simple mission: to transform learning into an engaging, interactive experience. What started as a small project has grown into a global platform used by educators, businesses, and quiz enthusiasts in over 150 countries.`,
        },
        {
          id: "story-platform",
          label:
            "Our platform combines cutting-edge technology with user-friendly design to make quiz creation and participation accessible to everyone. With AI-powered tools and a vibrant community, we're redefining how knowledge is shared and tested online.",
        },
        { id: "our-mission", label: "Our Mission" },
        {
          id: "mission-statement",
          label:
            '"To empower people worldwide to create, share, and experience knowledge in the most engaging way possible, making learning fun, accessible, and rewarding for everyone."',
        },
        { id: "stat-active-users", label: "Active Users", value: "2M+" },
        { id: "stat-quizzes-taken", label: "Quizzes Taken", value: "10M+" },
        { id: "stat-countries", label: "Countries", value: "150+" },
        { id: "stat-quizzes-created", label: "Quizzes Created", value: "500K+" },
      ],
    },
    {
      id: "why-partner",
      heading: "Why Partner With Us?",
      // The original JSX ended the paragraph with `{brand}{" "}` — the trailing space is rendered.
      body: `Join thousands of successful affiliates who are earning substantial income by promoting ${brand.name} `,
      items: [
        {
          id: "high-commission-rates",
          label: "High Commission Rates",
          value:
            "Earn up to 30% commission on all referred subscriptions, with lifetime tracking for recurring revenue.",
        },
        {
          id: "strong-conversion-rates",
          label: "Strong Conversion Rates",
          value:
            "Our optimized landing pages and product quality ensure high conversion rates for your referrals.",
        },
        {
          id: "fast-payouts",
          label: "Fast Payouts",
          value:
            "Get paid reliably every month with low minimum thresholds and multiple payout options.",
        },
        {
          id: "dedicated-support",
          label: "Dedicated Support",
          value:
            "Access to a dedicated affiliate manager and priority support to help maximize your earnings.",
        },
        {
          id: "exclusive-promotions",
          label: "Exclusive Promotions",
          value:
            "Get access to special offers and promotional materials to boost your conversion rates.",
        },
        {
          id: "easy-integration",
          label: "Easy Integration",
          value:
            "Simple tracking links, API access, and ready-to-use marketing materials for seamless promotion.",
        },
        { id: "stories-heading", label: "Success Stories" },
        { id: "join-partners", label: "Join our successful partners today" },
        { id: "compare-heading", label: "How We Compare" },
        { id: "compare-feature-column", label: "Feature" },
        { id: "compare-quizhub-column", label: `${brand.name} Affiliate` },
        { id: "compare-others-column", label: "Other Programs" },
        { id: "row-commission-rate", label: "Commission Rate" },
        { id: "row-commission-quizhub", label: "Up to {percent}" },
        { id: "row-cookie-duration", label: "Cookie Duration" },
        { id: "row-minimum-payout", label: "Minimum Payout" },
        { id: "row-dedicated-support", label: "Dedicated Support" },
        { id: "row-marketing-materials", label: "Marketing Materials" },
        { id: "row-marketing-others", label: "Limited" },
      ],
    },
    {
      id: "affiliate-faq",
      heading: "Frequently Asked Questions",
      body: "Everything you need to know about our affiliate program. Can't find the answer you're looking for? Contact our affiliate support team.",
      items: [
        {
          id: "how-it-works",
          label: "How does the affiliate program work?",
          value: `Our affiliate program is simple: you refer users to ${brand.name} using your unique link, and you earn a 30% commission on all their subscription payments for as long as they remain a customer. We track all referrals automatically and pay out monthly.`,
        },
        {
          id: "who-can-join",
          label: "Who can join the affiliate program?",
          value:
            "Anyone can join our affiliate program! Whether you're a content creator, educator, influencer, or just someone with an audience interested in educational content, you're welcome to join. There are no minimum requirements to get started.",
        },
        {
          id: "how-much-can-i-earn",
          label: "How much can I earn?",
          value:
            "Earnings vary based on your audience and promotion efforts. With our 30% commission rate on all plans, affiliates earn between $5.99 and $14.99 per month for each referred user. Some of our top affiliates earn over $5,000 monthly with consistent promotion.",
        },
        {
          id: "when-paid",
          label: "When and how do I get paid?",
          value:
            "We process payments on the 1st of each month for the previous month's earnings. You can choose to be paid via PayPal, bank transfer, or cryptocurrency. The minimum payout threshold is $50, and payments typically arrive within 3-5 business days.",
        },
        {
          id: "cookie-duration",
          label: "How long does the referral cookie last?",
          value:
            "Our referral cookie lasts for 90 days. This means if someone clicks your affiliate link and signs up within 90 days, you'll receive credit for the referral and earn commission on their subscription.",
        },
        {
          id: "promotional-materials",
          label: "Do you provide promotional materials?",
          value:
            "Yes! We provide a variety of promotional materials including banners, email templates, social media posts, and product screenshots. You can access all these materials in your affiliate dashboard once you sign up.",
        },
        {
          id: "social-media",
          label: "Can I promote the affiliate program on social media?",
          value: `Social media is one of the best ways to promote ${brand.name}. You can share your affiliate link on platforms like Twitter, Facebook, Instagram, TikTok, and LinkedIn. We even provide platform-specific content templates in your dashboard.`,
        },
        {
          id: "referral-limit",
          label: "Is there a limit to how many people I can refer?",
          value:
            "There is no limit to the number of people you can refer or how much you can earn. The more people you refer who become paying customers, the more commission you'll earn.",
        },
        { id: "still-have-questions", label: "Still have questions?" },
        { id: "contact-support", label: "Contact our affiliate support team" },
      ],
    },
    {
      id: "success-stories",
      heading: "Success Stories",
      body: `Hear from our top-performing affiliates who are earning consistent income by promoting ${brand.name}.`,
      items: [
        // The badge around each story's `earnings` record field.
        { id: "earning-badge", label: "Earning {earnings}" },
      ],
    },
    {
      id: "affiliate-cta",
      heading: "Ready to Start Earning?",
      body: `Join thousands of successful affiliates who are earning passive income by sharing ${brand.name} with their audience. It only takes 2 minutes to get started.`,
      items: [
        { id: "join-now", label: "Join Now" },
        { id: "learn-more", label: "Learn More" },
        { id: "contact-prompt", label: "Have questions? Contact our affiliate team at " },
        { id: "contact-email", label: "affiliates@quizhub.com" },
      ],
    },
  ],
});
