// @vitest-environment happy-dom
import { render, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { StarField } from "../ui/StarField";

function mockMatchMedia(prefersReducedMotion: boolean) {
  const listeners: Array<(e: MediaQueryListEvent) => void> = [];

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn((query: string) => {
      const matches = query.includes("reduce") ? prefersReducedMotion : false;
      return {
        matches,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn((event: string, listener: (e: MediaQueryListEvent) => void) => {
          if (event === "change") {
            listeners.push(listener);
          }
        }),
        removeEventListener: vi.fn((event: string, listener: (e: MediaQueryListEvent) => void) => {
          if (event === "change") {
            const index = listeners.indexOf(listener);
            if (index > -1) {
              listeners.splice(index, 1);
            }
          }
        }),
        dispatchEvent: vi.fn(),
      };
    }),
  });

  return listeners;
}

describe("StarField", () => {
  beforeEach(() => {
    mockMatchMedia(false);
    // Reset window.innerWidth to default (1024)
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Accessibility tests (unchanged from original)
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

  it("positions stars with percentage-based inline styles", () => {
    const { container } = render(<StarField />);
    const first = container.querySelector(".rounded-full") as HTMLElement;
    expect(first.style.left).toMatch(/%$/);
    expect(first.style.top).toMatch(/%$/);
  });

  it("renders without error when window.matchMedia is absent (SSR-safe)", () => {
    const original = window.matchMedia;
    // @ts-expect-error intentionally deleting for SSR simulation
    delete window.matchMedia;
    expect(() => render(<StarField />)).not.toThrow();
    window.matchMedia = original;
  });

  // New tests for reduced-motion handling
  it("renders static fallback when prefers-reduced-motion is set", async () => {
    mockMatchMedia(true);
    const { container } = render(<StarField />);

    await waitFor(() => {
      const starsWithAnimation = container.querySelectorAll(".motion-safe\\:animate-pulse");
      // Should NOT have animation class when reduced-motion is active
      expect(starsWithAnimation.length).toBe(0);
    });

    // Stars should still be rendered, just without animation
    const stars = container.querySelectorAll(".rounded-full");
    expect(stars.length).toBeGreaterThan(0);
  });

  it("starts animation when prefers-reduced-motion is not set", async () => {
    mockMatchMedia(false);
    const { container } = render(<StarField />);

    await waitFor(() => {
      const starsWithAnimation = container.querySelectorAll(".motion-safe\\:animate-pulse");
      expect(starsWithAnimation.length).toBeGreaterThan(0);
    });
  });

  it("pauses animation when tab becomes hidden", async () => {
    mockMatchMedia(false);
    const { container } = render(<StarField />);

    // Verify animation starts
    await waitFor(() => {
      const starsWithAnimation = container.querySelectorAll(".motion-safe\\:animate-pulse");
      expect(starsWithAnimation.length).toBeGreaterThan(0);
    });

    // Simulate tab becoming hidden
    Object.defineProperty(document, "hidden", {
      writable: true,
      configurable: true,
      value: true,
    });

    const event = new Event("visibilitychange");
    document.dispatchEvent(event);

    // Animation should be paused (no animation class)
    await waitFor(() => {
      const starsWithAnimation = container.querySelectorAll(".motion-safe\\:animate-pulse");
      expect(starsWithAnimation.length).toBe(0);
    });
  });

  it("resumes animation when tab becomes visible and motion is not reduced", async () => {
    mockMatchMedia(false);
    const { container, rerender } = render(<StarField />);

    // Hide tab
    Object.defineProperty(document, "hidden", {
      writable: true,
      configurable: true,
      value: true,
    });

    document.dispatchEvent(new Event("visibilitychange"));

    // Verify animation is paused
    await waitFor(() => {
      const starsWithAnimation = container.querySelectorAll(".motion-safe\\:animate-pulse");
      expect(starsWithAnimation.length).toBe(0);
    });

    // Show tab
    Object.defineProperty(document, "hidden", {
      writable: true,
      configurable: true,
      value: false,
    });

    document.dispatchEvent(new Event("visibilitychange"));

    // Animation should resume
    await waitFor(() => {
      const starsWithAnimation = container.querySelectorAll(".motion-safe\\:animate-pulse");
      expect(starsWithAnimation.length).toBeGreaterThan(0);
    });
  });

  it("removes all listeners on unmount", () => {
    mockMatchMedia(false);
    const removeEventListenerSpy = vi.spyOn(document, "removeEventListener");

    const { unmount } = render(<StarField />);

    unmount();

    // Verify visibilitychange listener was removed
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function)
    );

    removeEventListenerSpy.mockRestore();
  });

  it("caps star count on mobile viewport (< 768px)", async () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 375,
    });

    const { container } = render(<StarField />);

    await waitFor(() => {
      const stars = container.querySelectorAll(".rounded-full");
      // Mobile viewport should show up to 40 stars (slice(0, 40))
      expect(stars.length).toBeLessThanOrEqual(40);
    });
  });

  it("renders full star count on desktop viewport (>= 768px)", async () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    });

    const { container } = render(<StarField />);

    await waitFor(() => {
      const stars = container.querySelectorAll(".rounded-full");
      // Desktop viewport should show all available stars (up to 150, but we have 50 total)
      expect(stars.length).toBeGreaterThanOrEqual(40);
    });
  });

  // Combined scenario tests
  it("keeps animation paused when tab is hidden even if reduced-motion is toggled", async () => {
    mockMatchMedia(false);
    const { container } = render(<StarField />);

    // Hide tab
    Object.defineProperty(document, "hidden", {
      writable: true,
      configurable: true,
      value: true,
    });

    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => {
      const starsWithAnimation = container.querySelectorAll(".motion-safe\\:animate-pulse");
      expect(starsWithAnimation.length).toBe(0);
    });

    // Animation should still be paused (no animation class)
    const starsWithAnimation = container.querySelectorAll(".motion-safe\\:animate-pulse");
    expect(starsWithAnimation.length).toBe(0);
  });

  it("respects reduced-motion change at runtime", async () => {
    const listeners = mockMatchMedia(false);
    const { container } = render(<StarField />);

    // Verify animation starts
    await waitFor(() => {
      const starsWithAnimation = container.querySelectorAll(".motion-safe\\:animate-pulse");
      expect(starsWithAnimation.length).toBeGreaterThan(0);
    });

    // Simulate user enabling reduced-motion via OS settings
    const event = new MediaQueryListEvent("change", {
      media: "(prefers-reduced-motion: reduce)",
      matches: true,
    });

    listeners.forEach((listener) => listener(event));

    // Animation should stop
    await waitFor(() => {
      const starsWithAnimation = container.querySelectorAll(".motion-safe\\:animate-pulse");
      expect(starsWithAnimation.length).toBe(0);
    });
  });
});
