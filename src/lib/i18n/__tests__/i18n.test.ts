// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { t, useTranslations } from "../index";
import { messages } from "../messages";

describe("t()", () => {
  it("resolves a top-level namespace key", () => {
    expect(t("landing.hero.brand_name")).toBe("CommitLabs");
  });

  it("resolves all hero keys for the 'en' locale", () => {
    const hero = messages.en.landing.hero;
    (Object.keys(hero) as Array<keyof typeof hero>).forEach((k) => {
      expect(t(`landing.hero.${k}` as Parameters<typeof t>[0])).toBe(hero[k]);
    });
  });

  it("defaults to 'en' locale when none is provided", () => {
    expect(t("landing.hero.cta_create")).toBe("Create commitment");
  });

  it("returns the key as fallback when the key does not exist", () => {
    // @ts-expect-error – intentionally testing unknown key
    expect(t("landing.hero.nonexistent_key")).toBe("landing.hero.nonexistent_key");
  });

  it("returns the key as fallback for a partially valid path", () => {
    // @ts-expect-error – intentionally testing partial path
    expect(t("landing.hero")).toBe("landing.hero");
  });

  it("returns the key as fallback when an intermediate segment is missing", () => {
    // @ts-expect-error – intentionally testing unknown namespace
    expect(t("missing.namespace.key")).toBe("missing.namespace.key");
  });

  it("resolves keys correctly when locale is explicitly 'en'", () => {
    expect(t("landing.hero.heading_line1", "en")).toBe("Liquidity as a");
    expect(t("landing.hero.heading_line2", "en")).toBe("commitment,");
    expect(t("landing.hero.heading_line3", "en")).toBe("not a guess.");
  });

  it("resolves description key", () => {
    expect(t("landing.hero.description")).toContain("DeFi infrastructure");
  });

  it("resolves cta_explore key", () => {
    expect(t("landing.hero.cta_explore")).toBe("Explore marketplace");
  });

  it("resolves brand_letter key", () => {
    expect(t("landing.hero.brand_letter")).toBe("C");
  });
});

describe("multi-locale support", () => {
  it("resolves 'es' locale hero keys", () => {
    expect(t("landing.hero.heading_line1", "es")).toBe("Liquidez como");
    expect(t("landing.hero.heading_line2", "es")).toBe("compromiso,");
    expect(t("landing.hero.heading_line3", "es")).toBe("no como suposición.");
  });

  it("resolves 'es' locale CTA keys", () => {
    expect(t("landing.hero.cta_create", "es")).toBe("Crear compromiso");
    expect(t("landing.hero.cta_explore", "es")).toBe("Explorar mercado");
  });

  it("falls back to 'en' when locale is unknown", () => {
    // @ts-expect-error – intentionally testing unknown locale
    expect(t("landing.hero.brand_name", "fr")).toBe("CommitLabs");
  });

  it("all locales share the same key structure", () => {
    const enKeys = Object.keys(messages.en);
    const esKeys = Object.keys(messages.es);
    expect(esKeys).toEqual(enKeys);

    for (const ns of enKeys) {
      const enNs = messages.en[ns as keyof typeof messages.en];
      const esNs = messages.es[ns as keyof typeof messages.es];
      expect(Object.keys(esNs)).toEqual(Object.keys(enNs));
    }
  });
});

describe("second namespace (common.nav)", () => {
  it("resolves 'en' common.nav keys", () => {
    expect(t("common.nav.home")).toBe("Home");
    expect(t("common.nav.marketplace")).toBe("Marketplace");
    expect(t("common.nav.docs")).toBe("Docs");
  });

  it("resolves 'es' common.nav keys", () => {
    expect(t("common.nav.home", "es")).toBe("Inicio");
    expect(t("common.nav.marketplace", "es")).toBe("Mercado");
    expect(t("common.nav.docs", "es")).toBe("Documentación");
  });
});

describe("useTranslations()", () => {
  it("returns a translate function", () => {
    const { result } = renderHook(() => useTranslations());
    expect(typeof result.current).toBe("function");
  });

  it("translates a known key via the returned function", () => {
    const { result } = renderHook(() => useTranslations("en"));
    expect(result.current("landing.hero.brand_name")).toBe("CommitLabs");
  });

  it("returns key as fallback for unknown keys", () => {
    const { result } = renderHook(() => useTranslations());
    // @ts-expect-error – intentionally testing unknown key
    expect(result.current("some.missing.key")).toBe("some.missing.key");
  });

  it("returns a stable function reference for the same locale", () => {
    const { result, rerender } = renderHook(() => useTranslations("en"));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it("updates the translate function when locale changes", () => {
    const locale = "en" as const;
    const { result, rerender } = renderHook(() => useTranslations(locale));
    const first = result.current;
    // locale stays the same – ref should remain stable
    rerender();
    expect(result.current).toBe(first);
  });

  it("resolves 'es' translations via useTranslations hook", () => {
    const { result } = renderHook(() => useTranslations("es"));
    expect(result.current("common.nav.home")).toBe("Inicio");
    expect(result.current("landing.hero.brand_name")).toBe("CommitLabs");
  });
});

describe("messages catalog shape", () => {
  it("has 'en' and 'es' locale entries", () => {
    expect(messages).toHaveProperty("en");
    expect(messages).toHaveProperty("es");
  });

  it("has a 'landing.hero' namespace with all expected keys", () => {
    const expectedKeys = [
      "brand_name",
      "brand_letter",
      "heading_line1",
      "heading_line2",
      "heading_line3",
      "description",
      "cta_create",
      "cta_explore",
    ];
    expectedKeys.forEach((k) => {
      expect(messages.en.landing.hero).toHaveProperty(k);
      expect(messages.es.landing.hero).toHaveProperty(k);
    });
  });

  it("has a 'common.nav' namespace with all expected keys", () => {
    const expectedKeys = ["home", "marketplace", "docs"];
    expectedKeys.forEach((k) => {
      expect(messages.en.common.nav).toHaveProperty(k);
      expect(messages.es.common.nav).toHaveProperty(k);
    });
  });

  it("all hero values are non-empty strings", () => {
    for (const locale of Object.keys(messages) as Array<keyof typeof messages>) {
      Object.values(messages[locale].landing.hero).forEach((v) => {
        expect(typeof v).toBe("string");
        expect(v.length).toBeGreaterThan(0);
      });
    }
  });

  it("all common.nav values are non-empty strings", () => {
    for (const locale of Object.keys(messages) as Array<keyof typeof messages>) {
      Object.values(messages[locale].common.nav).forEach((v) => {
        expect(typeof v).toBe("string");
        expect(v.length).toBeGreaterThan(0);
      });
    }
  });
});
