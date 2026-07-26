import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelpDrawer } from '@/components/help/HelpDrawer';

describe('HelpDrawer', () => {
  it('opens and closes the drawer and shows no-results feedback for a search', async () => {
    const user = userEvent.setup();
    render(<HelpDrawer />);

    await user.click(screen.getByRole('button', { name: /open help and faq/i }));

    expect(screen.getByRole('dialog', { name: /help & faq/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/search help articles/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/search help articles/i), 'refund');

    expect(screen.getByText(/no matching questions found/i)).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps keyboard focus trapped inside the drawer while it is open', async () => {
    const user = userEvent.setup();
    render(<HelpDrawer />);

    await user.click(screen.getByRole('button', { name: /open help and faq/i }));

    const searchInput = screen.getByLabelText(/search help articles/i);
    const closeButton = screen.getByRole('button', { name: /close help drawer/i });

    closeButton.focus();
    fireEvent.keyDown(document, { key: 'Tab' });

    expect(searchInput).toHaveFocus();
  });
});
