/**
 * Typed message catalog.
 *
 * Keys follow the pattern: <namespace>.<component>.<identifier>
 * e.g.  landing.hero.heading_line1
 *
 * Each locale must mirror the same shape so that the generic Path type
 * can produce a union of dot-notation keys that works across all locales.
 */
export const messages = {
  en: {
    common: {
      nav: {
        home: "Home",
        marketplace: "Marketplace",
        docs: "Docs",
      },
    },
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
  es: {
    common: {
      nav: {
        home: "Inicio",
        marketplace: "Mercado",
        docs: "Documentación",
      },
    },
    landing: {
      hero: {
        brand_name: "CommitLabs",
        brand_letter: "C",
        heading_line1: "Liquidez como",
        heading_line2: "compromiso,",
        heading_line3: "no como suposición.",
        description:
          "Construyendo infraestructura DeFi central que transforma la liquidez pasiva en compromisos on-chain ejecutables, attestables y componibles.",
        cta_create: "Crear compromiso",
        cta_explore: "Explorar mercado",
      },
    },
  },
} as const;

export type Locale = keyof typeof messages;
export type Messages = typeof messages.en;
