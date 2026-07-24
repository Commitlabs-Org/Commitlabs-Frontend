// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { OnboardingChecklist } from "../OnboardingChecklist";
import { useWallet } from "@/hooks/useWallet";

vi.mock("@/hooks/useWallet", () => ({
  useWallet: vi.fn(),
}));

const mockUseWallet = vi.mocked(useWallet);

describe("OnboardingChecklist", () => {
  const mockConnect = vi.fn();

  beforeEach(() => {
    mockConnect.mockReset();
    if (typeof window !== "undefined") {
      localStorage.clear();
    }
    mockUseWallet.mockReturnValue({
      connected: false,
      connect: mockConnect,
      disconnect: vi.fn(),
      error: null,
      connecting: false,
      sessionToken: null,
      authenticated: false,
      authenticating: false,
      authError: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      walletNetwork: null,
    });
  });

  it("renders when not dismissed and shows milestones status", async () => {
    render(<OnboardingChecklist />);

    expect(screen.getByTestId("onboarding-checklist")).toBeInTheDocument();
    expect(screen.getByText("Getting Started")).toBeInTheDocument();
    expect(screen.getByText("0 of 4 completed")).toBeInTheDocument();
  });

  it("updates milestone status when wallet is connected", async () => {
    mockUseWallet.mockReturnValue({
      connected: true,
      connect: mockConnect,
      disconnect: vi.fn(),
      error: null,
      connecting: false,
      sessionToken: null,
      authenticated: false,
      authenticating: false,
      authError: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      walletNetwork: null,
    });

    render(<OnboardingChecklist />);

    expect(screen.getByText("1 of 4 completed")).toBeInTheDocument();
  });

  it("triggers wallet connection when connect button is clicked", async () => {
    render(<OnboardingChecklist />);

    const connectBtn = screen.getByRole("button", { name: /connect wallet/i });
    fireEvent.click(connectBtn);

    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  it("is dismissed when close button is clicked", async () => {
    render(<OnboardingChecklist />);

    expect(screen.getByTestId("onboarding-checklist")).toBeInTheDocument();

    const closeBtn = screen.getByRole("button", { name: /dismiss onboarding checklist/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByTestId("onboarding-checklist")).not.toBeInTheDocument();
    expect(localStorage.getItem("commitlabs:onboarding-checklist-dismissed")).toBe("true");
  });

  it("automatically completes milestones from local storage and calls onAllComplete", async () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("commitlabs:visited-marketplace", "true");
      localStorage.setItem("commitlabs:created-commitment", "true");
      localStorage.setItem("commitlabs:seen-wizard-tour", "true");
    }

    mockUseWallet.mockReturnValue({
      connected: true,
      connect: mockConnect,
      disconnect: vi.fn(),
      error: null,
      connecting: false,
      sessionToken: null,
      authenticated: false,
      authenticating: false,
      authError: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      walletNetwork: null,
    });

    const mockOnAllComplete = vi.fn();
    render(<OnboardingChecklist onAllComplete={mockOnAllComplete} />);

    expect(screen.getByText("All steps complete!")).toBeInTheDocument();
    expect(mockOnAllComplete).toHaveBeenCalledTimes(1);
  });
});
