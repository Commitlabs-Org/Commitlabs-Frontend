// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TrustBadge, type TrustLevel } from "../TrustBadge";

const trustLevels: Array<{
  level: TrustLevel;
  label: string;
  description: string;
}> = [
  {
    level: "verified",
    label: "Verified Seller",
    description:
      "Identity and historical performance have been verified by Commitlabs.",
  },
  {
    level: "reputable",
    label: "Top Reputation",
    description:
      "Seller has a high successful commitment rate and positive community feedback.",
  },
  {
    level: "unverified",
    label: "Self-Reported",
    description:
      "This seller has not yet completed the verification process. Exercise caution.",
  },
];

describe("TrustBadge", () => {
  it.each(trustLevels)(
    "renders a visible and accessible label for the $level trust level",
    ({ level, label }) => {
      render(<TrustBadge level={level} showTooltip={false} />);

      const badge = screen.getByRole("status", { name: label });

      expect(badge).toHaveTextContent(label);
      expect(badge.querySelector("svg")).toBeInTheDocument();
    },
  );

  it.each(trustLevels)(
    "links the $level tooltip to the badge when tooltips are enabled",
    ({ level, label, description }) => {
      render(<TrustBadge level={level} showTooltip />);

      const badge = screen.getByRole("status", { name: label });
      const tooltip = screen.getByRole("tooltip");

      expect(tooltip).toHaveTextContent(description);
      expect(tooltip).toHaveTextContent("Learn about trust levels");
      expect(badge).toHaveAccessibleDescription(description);
    },
  );

  it("does not render or describe a tooltip when showTooltip is false", () => {
    render(<TrustBadge level="verified" showTooltip={false} />);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Verified Seller" }),
    ).not.toHaveAccessibleDescription();
  });

  it("merges custom className values without removing the trust level styling", () => {
    render(
      <TrustBadge
        level="reputable"
        className="marketplace-row-badge"
        showTooltip={false}
      />,
    );

    const badge = screen.getByRole("status", { name: "Top Reputation" });

    expect(badge).toHaveClass("marketplace-row-badge");
    expect(badge.className).toContain("text-[#51A2FF]");
  });

  it("falls back to the unverified badge for unknown trust levels", () => {
    render(<TrustBadge level={"unknown" as TrustLevel} showTooltip={false} />);

    expect(
      screen.getByRole("status", { name: "Self-Reported" }),
    ).toHaveTextContent("Self-Reported");
  });
});
