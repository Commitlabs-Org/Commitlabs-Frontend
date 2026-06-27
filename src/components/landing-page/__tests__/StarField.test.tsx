// @vitest-environment happy-dom
import { render } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { StarField } from "../ui/StarField";

function mockMatchMedia(prefersReducedMotion: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn((query: string) => ({
      matches: query.includes("reduce") ? prefersReducedMotion : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe("StarField", () => {
  beforeEach(() => {
    mockMatchMedia(false);
  });

  it("is hidden from assistive technology", () => {
    const { container } = render(<StarField />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("aria-hidden")).toBe("true");
  });

  it("does not intercept pointer events", () => {
    const { container } = render(<StarField />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("pointer-events-none");
  });

  it("renders stars using CSS animation class (motion-safe) for default-motion users", () => {
    const { container } = render(<StarField />);
    const stars = container.querySelectorAll(".motion-safe\\:animate-pulse");
    expect(stars.length).toBeGreaterThan(0);
  });

  it("renders all 50 star elements", () => {
    const { container } = render(<StarField />);
    // root div + 50 star divs
    const starDivs = container.querySelectorAll(".rounded-full");
    expect(starDivs).toHaveLength(50);
  });

  it("positions stars with percentage-based inline styles", () => {
    const { container } = render(<StarField />);
    const first = container.querySelector(".rounded-full") as HTMLElement;
    expect(first.style.left).toMatch(/%$/);
    expect(first.style.top).toMatch(/%$/);
  });

  it("renders without window (SSR-safe: no matchMedia access at render time)", () => {
    // StarField is a pure CSS component — no useEffect / matchMedia calls.
    // Removing window.matchMedia should not throw.
    const original = window.matchMedia;
    // @ts-expect-error intentionally deleting for SSR simulation
    delete window.matchMedia;
    expect(() => render(<StarField />)).not.toThrow();
    window.matchMedia = original;
  });

  it("reduced-motion: animation class is scoped to motion-safe (CSS handles suppression)", () => {
    // Confirm the class used is motion-safe:animate-pulse, which Tailwind
    // suppresses under prefers-reduced-motion:reduce via CSS @media query.
    // No JS is needed — this is a static render assertion.
    mockMatchMedia(true);
    const { container } = render(<StarField />);
    const stars = container.querySelectorAll(".motion-safe\\:animate-pulse");
    // The class is always present in the DOM; CSS media query disables it.
    expect(stars.length).toBeGreaterThan(0);
  });
});
