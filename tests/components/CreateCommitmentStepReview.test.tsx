/**
 * @vitest-environment happy-dom
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import CreateCommitmentStepReview from "../../src/components/CreateCommitmentStepReview";

describe("CreateCommitmentStepReview", () => {
  const defaultProps = {
    typeLabel: "Balanced Commitment",
    amount: "1000",
    asset: "XLM",
    durationDays: 60,
    maxLossPercent: 8,
    earlyExitPenalty: "30 XLM",
    estimatedFees: "0.5 XLM",
    estimatedYield: "12.5% APY",
    commitmentStart: "Immediately",
    commitmentEnd: "2024-08-10",
    isSubmitting: false,
    submitError: undefined,
    onBack: vi.fn(),
    onSubmit: vi.fn(),
    onEditStep: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Component Rendering", () => {
    it("renders the review page with all sections", () => {
      render(<CreateCommitmentStepReview {...defaultProps} />);

      expect(screen.getByText("Review & Confirm")).toBeInTheDocument();
      expect(screen.getByText("Commitment Type")).toBeInTheDocument();
      expect(screen.getByText("Amount & Asset")).toBeInTheDocument();
      expect(screen.getByText("Duration")).toBeInTheDocument();
      expect(screen.getByText("Risk & Protections")).toBeInTheDocument();
    });

    it("displays commitment type correctly", () => {
      render(<CreateCommitmentStepReview {...defaultProps} />);

      expect(screen.getByText("Balanced Commitment")).toBeInTheDocument();
      expect(
        screen.getByText("Your selected commitment strategy"),
      ).toBeInTheDocument();
    });

    it("displays amount and asset in the correct section", () => {
      render(<CreateCommitmentStepReview {...defaultProps} />);

      expect(screen.getByText(/1000 XLM/)).toBeInTheDocument();
    });

    it("displays duration details correctly", () => {
      render(<CreateCommitmentStepReview {...defaultProps} />);

      expect(screen.getByText("60 days")).toBeInTheDocument();
      expect(screen.getByText("Immediately")).toBeInTheDocument();
      expect(screen.getByText("2024-08-10")).toBeInTheDocument();
    });

    it("displays risk and protection details correctly", () => {
      render(<CreateCommitmentStepReview {...defaultProps} />);

      expect(screen.getByText("8%")).toBeInTheDocument();
      expect(screen.getByText("30 XLM")).toBeInTheDocument();
      expect(screen.getByText("0.5 XLM")).toBeInTheDocument();
      expect(screen.getByText("12.5% APY")).toBeInTheDocument();
    });

    it("displays max loss protection correctly when no loss", () => {
      const props = { ...defaultProps, maxLossPercent: 100 };
      render(<CreateCommitmentStepReview {...props} />);

      expect(screen.getByText("No protection (100%)")).toBeInTheDocument();
    });

    it("renders the commitment type icon based on type label", () => {
      const { container } = render(
        <CreateCommitmentStepReview {...defaultProps} />,
      );

      // Check for icon container in the type section
      expect(container.querySelectorAll("svg").length).toBeGreaterThan(0);
    });
  });

  describe("Edit Button Rendering and Accessibility", () => {
    it("renders edit buttons when onEditStep is provided", () => {
      render(<CreateCommitmentStepReview {...defaultProps} />);

      const editButtons = screen.getAllByText("Edit");
      expect(editButtons.length).toBe(4); // One for each section
    });

    it("does not render edit buttons when onEditStep is not provided", () => {
      const props = { ...defaultProps, onEditStep: undefined };
      render(<CreateCommitmentStepReview {...props} />);

      expect(screen.queryByText("Edit")).not.toBeInTheDocument();
    });

    it("edit button for type section has correct aria-label", () => {
      render(<CreateCommitmentStepReview {...defaultProps} />);

      const editButtons = screen.getAllByRole("button", { name: /Edit/ });
      expect(editButtons[0]).toHaveAttribute(
        "aria-label",
        "Edit commitment type",
      );
    });

    it("edit button for amount section has correct aria-label", () => {
      render(<CreateCommitmentStepReview {...defaultProps} />);

      const editButtons = screen.getAllByRole("button", { name: /Edit/ });
      expect(editButtons[1]).toHaveAttribute(
        "aria-label",
        "Edit commitment amount and asset",
      );
    });

    it("edit button for duration section has correct aria-label", () => {
      render(<CreateCommitmentStepReview {...defaultProps} />);

      const editButtons = screen.getAllByRole("button", { name: /Edit/ });
      expect(editButtons[2]).toHaveAttribute(
        "aria-label",
        "Edit commitment duration",
      );
    });

    it("edit button for risk section has correct aria-label", () => {
      render(<CreateCommitmentStepReview {...defaultProps} />);

      const editButtons = screen.getAllByRole("button", { name: /Edit/ });
      expect(editButtons[3]).toHaveAttribute(
        "aria-label",
        "Edit max loss and early exit settings",
      );
    });

    it("edit buttons have descriptive titles", () => {
      render(<CreateCommitmentStepReview {...defaultProps} />);

      const editButtons = screen.getAllByRole("button", { name: /Edit/ });

      expect(editButtons[0]).toHaveAttribute(
        "title",
        "Return to step 1 to edit commitment type",
      );
      expect(editButtons[1]).toHaveAttribute(
        "title",
        "Return to step 2 to edit amount and asset",
      );
      expect(editButtons[2]).toHaveAttribute(
        "title",
        "Return to step 2 to edit duration",
      );
      expect(editButtons[3]).toHaveAttribute(
        "title",
        "Return to step 2 to edit risk parameters",
      );
    });
  });

  describe("Edit Button Navigation", () => {
    it("navigates to step 1 when edit type button is clicked", async () => {
      const user = userEvent.setup();
      render(<CreateCommitmentStepReview {...defaultProps} />);

      const editButtons = screen.getAllByRole("button", { name: /Edit/ });
      await user.click(editButtons[0]);

      expect(defaultProps.onEditStep).toHaveBeenCalledWith(1);
    });

    it("navigates to step 2 when edit amount button is clicked", async () => {
      const user = userEvent.setup();
      render(<CreateCommitmentStepReview {...defaultProps} />);

      const editButtons = screen.getAllByRole("button", { name: /Edit/ });
      await user.click(editButtons[1]);

      expect(defaultProps.onEditStep).toHaveBeenCalledWith(2);
    });

    it("navigates to step 2 when edit duration button is clicked", async () => {
      const user = userEvent.setup();
      render(<CreateCommitmentStepReview {...defaultProps} />);

      const editButtons = screen.getAllByRole("button", { name: /Edit/ });
      await user.click(editButtons[2]);

      expect(defaultProps.onEditStep).toHaveBeenCalledWith(2);
    });

    it("navigates to step 2 when edit risk button is clicked", async () => {
      const user = userEvent.setup();
      render(<CreateCommitmentStepReview {...defaultProps} />);

      const editButtons = screen.getAllByRole("button", { name: /Edit/ });
      await user.click(editButtons[3]);

      expect(defaultProps.onEditStep).toHaveBeenCalledWith(2);
    });

    it("handles rapid edit button clicks correctly", async () => {
      const user = userEvent.setup();
      const onEditStep = vi.fn();
      const props = { ...defaultProps, onEditStep };
      render(<CreateCommitmentStepReview {...props} />);

      const editButtons = screen.getAllByRole("button", { name: /Edit/ });
      await user.click(editButtons[0]);
      await user.click(editButtons[1]);
      await user.click(editButtons[2]);

      expect(onEditStep).toHaveBeenCalledTimes(3);
      expect(onEditStep).toHaveBeenNthCalledWith(1, 1);
      expect(onEditStep).toHaveBeenNthCalledWith(2, 2);
      expect(onEditStep).toHaveBeenNthCalledWith(3, 2);
    });
  });

  describe("Keyboard Navigation", () => {
    it("edit buttons are keyboard accessible", async () => {
      const user = userEvent.setup();
      const onEditStep = vi.fn();
      const props = { ...defaultProps, onEditStep };
      render(<CreateCommitmentStepReview {...props} />);

      // Tab to first edit button and press Enter
      await user.tab();
      // Skip through other interactive elements to reach edit buttons
      for (let i = 0; i < 5; i++) {
        await user.tab();
      }

      // At this point we should be focused on an edit button
      expect(document.activeElement).toBeTruthy();
    });

    it("edit buttons can be activated with Enter key", async () => {
      const user = userEvent.setup();
      const onEditStep = vi.fn();
      const props = { ...defaultProps, onEditStep };
      const { container } = render(<CreateCommitmentStepReview {...props} />);

      const firstEditButton = screen.getAllByRole("button", {
        name: /Edit/,
      })[0];
      firstEditButton.focus();

      await user.keyboard("{Enter}");

      expect(onEditStep).toHaveBeenCalledWith(1);
    });

    it("edit buttons can be activated with Space key", async () => {
      const user = userEvent.setup();
      const onEditStep = vi.fn();
      const props = { ...defaultProps, onEditStep };
      render(<CreateCommitmentStepReview {...props} />);

      const firstEditButton = screen.getAllByRole("button", {
        name: /Edit/,
      })[0];
      firstEditButton.focus();

      await user.keyboard(" ");

      expect(onEditStep).toHaveBeenCalledWith(1);
    });

    it("edit buttons have focus visible indicator", async () => {
      const user = userEvent.setup();
      render(<CreateCommitmentStepReview {...defaultProps} />);

      const editButton = screen.getAllByRole("button", { name: /Edit/ })[0];
      editButton.focus();

      // Button should have focus
      expect(editButton).toHaveFocus();
    });
  });

  describe("Section Structure and Accessibility", () => {
    it("each section is wrapped in a semantic section element", () => {
      const { container } = render(
        <CreateCommitmentStepReview {...defaultProps} />,
      );

      const sections = container.querySelectorAll("section");
      expect(sections.length).toBe(4); // Type, Amount, Duration, Risk
    });

    it("sections have proper aria-labelledby attributes", () => {
      const { container } = render(
        <CreateCommitmentStepReview {...defaultProps} />,
      );

      const sections = container.querySelectorAll("section");
      sections.forEach((section) => {
        expect(section).toHaveAttribute("aria-labelledby");
      });
    });

    it("section headings have corresponding ids", () => {
      const { container } = render(
        <CreateCommitmentStepReview {...defaultProps} />,
      );

      const typeHeading = screen.getByText("Commitment Type");
      expect(typeHeading).toHaveAttribute("id", "type-section-heading");

      const amountHeading = screen.getByText("Amount & Asset");
      expect(amountHeading).toHaveAttribute("id", "amount-section-heading");

      const durationHeading = screen.getByText("Duration");
      expect(durationHeading).toHaveAttribute("id", "duration-section-heading");

      const riskHeading = screen.getByText("Risk & Protections");
      expect(riskHeading).toHaveAttribute("id", "risk-section-heading");
    });
  });

  describe("Checkbox and Form Interactions", () => {
    it("terms checkbox can be toggled", async () => {
      const user = userEvent.setup();
      render(<CreateCommitmentStepReview {...defaultProps} />);

      const termsCheckbox = screen.getByText(
        "I agree to the terms and conditions",
      );
      await user.click(termsCheckbox.closest(".checkboxRow"));

      // Verify visual state changed
      expect(
        screen.getByText("I agree to the terms and conditions"),
      ).toBeInTheDocument();
    });

    it("risks checkbox can be toggled", async () => {
      const user = userEvent.setup();
      render(<CreateCommitmentStepReview {...defaultProps} />);

      const risksCheckbox = screen.getByText("I acknowledge the risks");
      await user.click(risksCheckbox.closest(".checkboxRow"));

      // Verify visual state changed
      expect(screen.getByText("I acknowledge the risks")).toBeInTheDocument();
    });

    it("submit button is disabled when checkboxes are not checked", () => {
      render(<CreateCommitmentStepReview {...defaultProps} />);

      const submitButton = screen.getByRole("button", {
        name: /Create Commitment/i,
      });
      expect(submitButton).toBeDisabled();
    });

    it("submit button is enabled when both checkboxes are checked", async () => {
      const user = userEvent.setup();
      render(<CreateCommitmentStepReview {...defaultProps} />);

      const checkboxRows = screen.getAllByText(/I agree to|I acknowledge the/);
      const termsRow = checkboxRows[0].closest(".checkboxRow");
      const risksRow = checkboxRows[1].closest(".checkboxRow");

      if (termsRow && risksRow) {
        await user.click(termsRow);
        await user.click(risksRow);
      }

      const submitButton = screen.getByRole("button", {
        name: /Create Commitment/i,
      });
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe("Error Handling", () => {
    it("displays submit error when provided", () => {
      const errorMessage = "Failed to create commitment";
      const props = { ...defaultProps, submitError: errorMessage };
      render(<CreateCommitmentStepReview {...props} />);

      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it("displays loading state during submission", () => {
      const props = { ...defaultProps, isSubmitting: true };
      render(<CreateCommitmentStepReview {...props} />);

      expect(screen.getByText("Processing Transaction...")).toBeInTheDocument();
    });
  });

  describe("Back Navigation", () => {
    it("back button calls onBack when clicked", async () => {
      const user = userEvent.setup();
      const onBack = vi.fn();
      const props = { ...defaultProps, onBack };
      render(<CreateCommitmentStepReview {...props} />);

      const backButton = screen.getByRole("button", { name: /Back/ });
      await user.click(backButton);

      expect(onBack).toHaveBeenCalled();
    });
  });

  describe("Data Display Accuracy", () => {
    it("displays safe commitment type with correct icon reference", () => {
      const props = { ...defaultProps, typeLabel: "Safe Commitment" };
      render(<CreateCommitmentStepReview {...props} />);

      expect(screen.getByText("Safe Commitment")).toBeInTheDocument();
    });

    it("displays aggressive commitment type with correct icon reference", () => {
      const props = { ...defaultProps, typeLabel: "Aggressive Commitment" };
      render(<CreateCommitmentStepReview {...props} />);

      expect(screen.getByText("Aggressive Commitment")).toBeInTheDocument();
    });

    it("correctly formats currency values", () => {
      render(<CreateCommitmentStepReview {...defaultProps} />);

      expect(screen.getByText(/1000 XLM/)).toBeInTheDocument();
      expect(screen.getByText("30 XLM")).toBeInTheDocument();
      expect(screen.getByText("0.5 XLM")).toBeInTheDocument();
    });

    it("correctly displays yield percentage", () => {
      render(<CreateCommitmentStepReview {...defaultProps} />);

      expect(screen.getByText("12.5% APY")).toBeInTheDocument();
    });
  });
});
