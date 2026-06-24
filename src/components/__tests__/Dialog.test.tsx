// @vitest-environment happy-dom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import Dialog from "@/components/ui/Dialog";

function DialogHarness({
  onClose = vi.fn(),
  showTrigger = true,
}: {
  onClose?: () => void;
  showTrigger?: boolean;
}) {
  return (
    <div>
      {showTrigger ? <button>Open dialog</button> : null}
      <Dialog isOpen onClose={onClose} title="Test dialog" description="Dialog description">
        <button>First action</button>
        <button>Last action</button>
      </Dialog>
    </div>
  );
}

function StatefulDialogHarness() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button onClick={() => setIsOpen(true)}>Open dialog</button>
      <Dialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Test dialog"
        description="Dialog description"
      >
        <button>First action</button>
        <button>Last action</button>
      </Dialog>
    </div>
  );
}

describe("Dialog", () => {
  it("moves focus into the dialog and restores focus to the trigger on close", async () => {
    render(<StatefulDialogHarness />);

    const trigger = screen.getByRole("button", { name: /open dialog/i });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: /test dialog/i });
    expect(dialog).toHaveAttribute("aria-modal", "true");

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /close test dialog/i })).toHaveFocus(),
    );

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("traps Tab and Shift+Tab focus inside the dialog", async () => {
    render(<DialogHarness />);

    const closeButton = await screen.findByRole("button", {
      name: /close test dialog/i,
    });
    const lastAction = screen.getByRole("button", { name: /last action/i });

    closeButton.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(lastAction).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab" });
    expect(closeButton).toHaveFocus();
  });

  it("supports backdrop close and handles a removed trigger without throwing", async () => {
    const onClose = vi.fn();
    render(<DialogHarness onClose={onClose} showTrigger={false} />);

    const dialog = screen.getByRole("dialog", { name: /test dialog/i });
    fireEvent.click(dialog.parentElement as HTMLElement);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps body scroll locked until stacked dialogs are both closed", () => {
    const { rerender } = render(
      <>
        <Dialog isOpen onClose={vi.fn()} title="First dialog">
          <button>First close</button>
        </Dialog>
        <Dialog isOpen onClose={vi.fn()} title="Second dialog">
          <button>Second close</button>
        </Dialog>
      </>,
    );

    expect(document.body.style.overflow).toBe("hidden");

    rerender(
      <Dialog isOpen onClose={vi.fn()} title="First dialog">
        <button>First close</button>
      </Dialog>,
    );

    expect(document.body.style.overflow).toBe("hidden");

    rerender(<></>);

    expect(document.body.style.overflow).toBe("");
  });
});
