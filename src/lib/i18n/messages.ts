/**
 * Typed message catalog – English (en) baseline.
 *
 * Keys follow the pattern: <namespace>.<component>.<identifier>
 * e.g.  landing.hero.heading_line1
 */
export const messages = {
  en: {
    landing: {
      hero: {
        brand_name: "CommitLabs",
        brand_letter: "C",
        heading_line1: "Liquidity as a",
        heading_line2: "commitment,",
        heading_line3: "not a guess.",
        description:
          "Building core DeFi infrastructure that transforms passive liquidity into enforceable, attestable, and composable on-chain commitments.",
        cta_create: "Create commitment",
        cta_explore: "Explore marketplace",
      },
    },
  },
} as const;

export type Locale = keyof typeof messages;
export type Messages = typeof messages.en;
