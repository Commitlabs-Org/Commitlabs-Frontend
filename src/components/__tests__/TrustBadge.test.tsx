// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TrustBadge, type TrustLevel } from "@/components/TrustBadge";

const TRUST_LEVELS: Array<{
  level: TrustLevel;
  label: string;
  description: string;
  colorClass: string;
}> = [
  {
    level: "verified",
    label: "Verified Seller",
    description:
      "Identity and historical performance have been verified by Commitlabs.",
    colorClass: "text-[#00C950]",
  },
  {
    level: "reputable",
    label: "Top Reputation",
    description:
      "Seller has a high successful commitment rate and positive community feedback.",
    colorClass: "text-[#51A2FF]",
  },
  {
    level: "unverified",
    label: "Self-Reported",
    description:
      "This seller has not yet completed the verification process. Exercise caution.",
    colorClass: "text-white/40",
  },
];

describe("TrustBadge", () => {
  it.each(TRUST_LEVELS)(
    "renders the $level label, icon, and color class",
    ({ level, label, colorClass }) => {
      render(<TrustBadge level={level} />);

      const badge = screen.getByRole("status", { name: label });
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent(label);
      expect(badge.className).toContain(colorClass);
      expect(badge.querySelector("svg")).toBeInTheDocument();
    },
  );

  it.each(TRUST_LEVELS)(
    "exposes accessible labelling for the $level badge",
    ({ level, label, description }) => {
      render(<TrustBadge level={level} showTooltip />);

      const badge = screen.getByRole("status", { name: label });
      expect(badge).toHaveAttribute("aria-label", label);
      expect(badge).toHaveAttribute(
        "aria-describedby",
        `trust-badge-tooltip-${level}`,
      );

      const tooltip = screen.getByRole("tooltip");
      expect(tooltip).toHaveAttribute("id", `trust-badge-tooltip-${level}`);
      expect(tooltip).toHaveTextContent(description);
      expect(tooltip).toHaveTextContent("Learn about trust levels");
    },
  );

  it("does not render tooltip content when showTooltip is false", () => {
    render(<TrustBadge level="verified" showTooltip={false} />);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Verified Seller" }),
    ).not.toHaveAttribute("aria-describedby");
  });

  it("merges custom className with default badge styles", () => {
    render(
      <TrustBadge
        level="verified"
        className="custom-trust-badge"
        showTooltip={false}
      />,
    );

    const badge = screen.getByRole("status", { name: "Verified Seller" });
    expect(badge.className).toContain("custom-trust-badge");
    expect(badge.className).toContain("text-[#00C950]");
  });

  it("uses visible text labels so color is not the sole trust signal", () => {
    render(<TrustBadge level="verified" showTooltip={false} />);

    const badge = screen.getByRole("status", { name: "Verified Seller" });
    expect(badge).toHaveAccessibleName("Verified Seller");
    expect(screen.getByText("Verified Seller")).toBeVisible();
  });

  it("falls back to unverified config for unknown trust levels", () => {
    render(
      <TrustBadge
        level={"unknown" as TrustLevel}
        showTooltip={false}
      />,
    );

    const badge = screen.getByRole("status", { name: "Self-Reported" });
    expect(badge).toHaveTextContent("Self-Reported");
    expect(badge.className).toContain("text-white/40");
  });

  it("handles empty className without breaking layout classes", () => {
    render(<TrustBadge level="reputable" className="" showTooltip={false} />);

    const badge = screen.getByRole("status", { name: "Top Reputation" });
    expect(badge.className).toContain("text-[#51A2FF]");
    expect(badge.className).toContain("rounded-full");
  });
});
