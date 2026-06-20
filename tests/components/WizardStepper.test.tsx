/**
 * @vitest-environment happy-dom
 */

import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import WizardStepper from "../../src/components/WizardStepper";

describe("WizardStepper", () => {
  it("renders the three wizard steps in order", () => {
    render(<WizardStepper currentStep={1} />);

    const progress = screen.getByRole("navigation", { name: "Wizard progress" });
    const labels = within(progress)
      .getAllByText(/Select Type|Configure|Review/)
      .map((label) => label.textContent);

    expect(labels).toEqual(["Select Type", "Configure", "Review"]);
  });

  it("marks the first step as the current step before configuration", () => {
    render(<WizardStepper currentStep={1} />);

    const current = screen.getByText("1");
    expect(current).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("Select Type")).toBeInTheDocument();
  });

  it("shows prior steps as completed when advancing", () => {
    const { container } = render(<WizardStepper currentStep={3} />);

    expect(screen.getByText("3")).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(container.querySelectorAll("svg")).toHaveLength(2);
    expect(screen.queryByText("1")).not.toBeInTheDocument();
    expect(screen.queryByText("2")).not.toBeInTheDocument();
  });

  it("updates the active marker when moving backward", () => {
    const { rerender } = render(<WizardStepper currentStep={3} />);
    expect(screen.getByText("3")).toHaveAttribute("aria-current", "step");

    rerender(<WizardStepper currentStep={2} />);

    expect(screen.getByText("2")).toHaveAttribute("aria-current", "step");
    expect(screen.queryByText("3")).not.toHaveAttribute("aria-current", "step");
  });
});
