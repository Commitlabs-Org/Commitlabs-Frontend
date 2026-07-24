/**
 * @vitest-environment happy-dom
 */

import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import WizardStepper from "../../src/components/WizardStepper";

const PROGRESS_LABEL = "Wizard progress";
const STEP_LABELS = ["Select Type", "Configure", "Review"] as const;

function getProgressNav(): HTMLElement {
  return screen.getByRole("navigation", { name: PROGRESS_LABEL });
}

function getStepLabels(): HTMLElement[] {
  const progress = getProgressNav();
  return STEP_LABELS.map((label) => within(progress).getByText(label));
}

/**
 * Each step renders an indicator circle. When the step is the current step, the
 * circle carries `aria-current="step"`. When the step is completed, the number
 * text is replaced by an SVG check icon, so `getByText` on the step number
 * would not find an element in completed steps. These helpers navigate the
 * DOM structurally so the assertions are robust to text-vs-icon rendering.
 */
function getActiveCircle(): HTMLElement | null {
  return getProgressNav().querySelector<HTMLElement>('[aria-current="step"]');
}

function countCompletedSteps(): number {
  // Each completed step renders a single <svg> check icon.
  return getProgressNav().querySelectorAll("svg").length;
}

function getStepCircleByLabel(label: string): HTMLElement {
  const progress = getProgressNav();
  const labelEl = within(progress).getByText(label);
  // Each step label sits next to its circle inside a `.step` group.
  return labelEl.parentElement!.querySelector(
    '[class*="circle"]',
  ) as HTMLElement;
}

describe("WizardStepper", () => {
  describe("ARIA semantics", () => {
    it("exposes a navigation landmark with an aria-label", () => {
      render(<WizardStepper currentStep={1} />);

      const progress = getProgressNav();
      expect(progress.tagName).toBe("NAV");
      expect(progress).toHaveAttribute("aria-label", PROGRESS_LABEL);
    });

    it("marks exactly one step as the current step for each progress value", () => {
      for (const currentStep of [1, 2, 3] as const) {
        const { unmount } = render(<WizardStepper currentStep={currentStep} />);
        const active = getActiveCircle();
        expect(active).not.toBeNull();
        expect(active!.textContent).toBe(String(currentStep));
        expect(
          getProgressNav().querySelectorAll('[aria-current="step"]'),
        ).toHaveLength(1);
        unmount();
      }
    });

    it("does not set aria-current on inactive or completed steps", () => {
      render(<WizardStepper currentStep={2} />);

      const progress = getProgressNav();
      // Step 2 is the only aria-current step.
      expect(getActiveCircle()?.textContent).toBe("2");
      // Step 1 (completed) and Step 3 (upcoming) circles must not have aria-current.
      expect(getStepCircleByLabel("Select Type")).not.toHaveAttribute(
        "aria-current",
      );
      expect(getStepCircleByLabel("Review")).not.toHaveAttribute(
        "aria-current",
      );
      expect(progress.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
    });
  });

  describe("step rendering for each progress value", () => {
    it("renders step 1 only as the active step with no completed SVG markers (currentStep=1)", () => {
      render(<WizardStepper currentStep={1} />);

      // No completed steps yet, so no check icons are rendered.
      expect(countCompletedSteps()).toBe(0);
      // The active circle shows the number "1".
      expect(getActiveCircle()?.textContent).toBe("1");
      // Upcoming steps still render their number text inside the circle.
      expect(getStepCircleByLabel("Configure").textContent).toBe("2");
      expect(getStepCircleByLabel("Review").textContent).toBe("3");
    });

    it("renders step 2 with exactly one completed step (1) and one upcoming step (3)", () => {
      render(<WizardStepper currentStep={2} />);

      // Step 1 is completed => its number text is replaced by a check icon SVG.
      expect(countCompletedSteps()).toBe(1);
      expect(getActiveCircle()?.textContent).toBe("2");
      // Step 1's circle is now an SVG with no text content.
      expect(getStepCircleByLabel("Select Type").textContent).toBe("");
      expect(
        getStepCircleByLabel("Select Type").querySelector("svg"),
      ).not.toBeNull();
      // Upcoming step 3 still renders its number text.
      expect(getStepCircleByLabel("Review").textContent).toBe("3");
    });

    it("renders step 3 with two completed steps (1, 2) and only step 3's number visible", () => {
      render(<WizardStepper currentStep={3} />);

      // Steps 1 and 2 are completed => two SVG check icons.
      expect(countCompletedSteps()).toBe(2);
      expect(getActiveCircle()?.textContent).toBe("3");
      expect(getStepCircleByLabel("Select Type").textContent).toBe("");
      expect(getStepCircleByLabel("Configure").textContent).toBe("");
      expect(
        getStepCircleByLabel("Select Type").querySelector("svg"),
      ).not.toBeNull();
      expect(
        getStepCircleByLabel("Configure").querySelector("svg"),
      ).not.toBeNull();
    });
  });

  describe("visual state styling", () => {
    it("applies active styling to the current step label and circle", () => {
      render(<WizardStepper currentStep={2} />);

      const progress = getProgressNav();
      const activeLabel = within(progress).getByText("Configure");
      expect(activeLabel.className).toMatch(/labelActive/);

      const activeCircle = getStepCircleByLabel("Configure");
      expect(activeCircle.className).toMatch(/active/);
    });

    it("applies completed styling to prior step labels", () => {
      render(<WizardStepper currentStep={3} />);

      const progress = getProgressNav();
      const completedLabels = ["Select Type", "Configure"] as const;
      for (const label of completedLabels) {
        expect(within(progress).getByText(label).className).toMatch(
          /labelCompleted/,
        );
      }
    });

    it("applies the connector-completed style between completed step pairs", () => {
      const { container } = render(<WizardStepper currentStep={3} />);

      const connectors = container.querySelectorAll("[class*=connector]");
      expect(connectors.length).toBeGreaterThan(0);
      // With currentStep=3, both connectors (between 1↔2 and 2↔3) are completed.
      const completedConnectors = container.querySelectorAll(
        "[class*=connectorCompleted]",
      );
      expect(completedConnectors.length).toBe(2);
    });

    it("applies zero connector-completed when currentStep is 1", () => {
      const { container } = render(<WizardStepper currentStep={1} />);

      expect(
        container.querySelectorAll("[class*=connectorCompleted]").length,
      ).toBe(0);
    });

    it("applies one connector-completed when currentStep is 2", () => {
      const { container } = render(<WizardStepper currentStep={2} />);

      expect(
        container.querySelectorAll("[class*=connectorCompleted]").length,
      ).toBe(1);
    });
  });

  describe("step labels and ordering", () => {
    it("renders the three wizard step labels in the canonical order", () => {
      render(<WizardStepper currentStep={2} />);

      const labelsInDom = getStepLabels().map((el) => el.textContent);
      expect(labelsInDom).toEqual([...STEP_LABELS]);
    });

    it("keeps the canonical label order across every progress value", () => {
      for (const currentStep of [1, 2, 3] as const) {
        const { unmount } = render(<WizardStepper currentStep={currentStep} />);
        expect(getStepLabels().map((el) => el.textContent)).toEqual([
          ...STEP_LABELS,
        ]);
        unmount();
      }
    });
  });

  describe("back-navigation (regression in currentStep)", () => {
    it("removes the check icons when navigating back from 3 to 1", () => {
      const { rerender } = render(<WizardStepper currentStep={3} />);
      expect(countCompletedSteps()).toBe(2);

      rerender(<WizardStepper currentStep={1} />);

      expect(countCompletedSteps()).toBe(0);
      expect(getActiveCircle()?.textContent).toBe("1");
      expect(getStepCircleByLabel("Configure").textContent).toBe("2");
      expect(getStepCircleByLabel("Review").textContent).toBe("3");
    });

    it("updates the active marker when stepping from 3 to 2", () => {
      const { rerender } = render(<WizardStepper currentStep={3} />);
      expect(getActiveCircle()?.textContent).toBe("3");

      rerender(<WizardStepper currentStep={2} />);

      expect(getActiveCircle()?.textContent).toBe("2");
      expect(getStepCircleByLabel("Review")).not.toHaveAttribute(
        "aria-current",
      );
    });

    it("updates the active marker when stepping from 2 to 1", () => {
      const { rerender } = render(<WizardStepper currentStep={2} />);
      expect(getActiveCircle()?.textContent).toBe("2");

      rerender(<WizardStepper currentStep={1} />);

      expect(getActiveCircle()?.textContent).toBe("1");
      expect(getStepCircleByLabel("Configure")).not.toHaveAttribute(
        "aria-current",
      );
    });

    it("renders fewer SVG check icons after navigating back from 3 to 1", () => {
      const { rerender } = render(<WizardStepper currentStep={3} />);
      expect(countCompletedSteps()).toBe(2);

      rerender(<WizardStepper currentStep={1} />);
      expect(countCompletedSteps()).toBe(0);
    });
  });
});
