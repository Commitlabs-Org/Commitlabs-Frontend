import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GlossaryTerm from '../GlossaryTerm';

describe('GlossaryTerm', () => {
  it('renders children even if term is unknown', () => {
    render(<GlossaryTerm termKey="unknown term">Some text</GlossaryTerm>);
    expect(screen.getByText('Some text')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders a trigger button for known terms', () => {
    render(<GlossaryTerm termKey="early exit">Early Exit Text</GlossaryTerm>);
    expect(screen.getByText('Early Exit Text')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view definition for early exit/i })).toBeInTheDocument();
  });

  it('shows tooltip on hover', async () => {
    const user = userEvent.setup();
    render(<GlossaryTerm termKey="early exit">Early Exit Text</GlossaryTerm>);
    
    const trigger = screen.getByRole('button');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    
    await user.hover(trigger);
    
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent(/Terminating a commitment before its scheduled duration completes/i);
    
    await user.unhover(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows tooltip on focus', async () => {
    const user = userEvent.setup();
    render(<GlossaryTerm termKey="early exit">Early Exit Text</GlossaryTerm>);
    
    const trigger = screen.getByRole('button');
    await user.tab();
    expect(trigger).toHaveFocus();
    
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    
    await user.tab(); // move focus away
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('toggles tooltip on click and closes on escape', async () => {
    const user = userEvent.setup();
    render(<GlossaryTerm termKey="attestation">Attestation Text</GlossaryTerm>);
    
    const trigger = screen.getByRole('button');
    
    // click to open
    await user.click(trigger);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    
    // click to close
    await user.click(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    // click to open again
    await user.click(trigger);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    // escape to close
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
  
  it('supports multiple tooltips on a page without interference', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <GlossaryTerm termKey="early exit">Term 1</GlossaryTerm>
        <GlossaryTerm termKey="attestation">Term 2</GlossaryTerm>
      </div>
    );
    
    const triggers = screen.getAllByRole('button');
    
    await user.click(triggers[0]);
    expect(screen.getAllByRole('tooltip')).toHaveLength(1);
    expect(screen.getByRole('tooltip')).toHaveTextContent(/Terminating a commitment/i);
    
    // clicking second should open second (first stays open if we don't click outside, but logic currently closes on outside click)
    await user.click(triggers[1]);
    // since we use standard react state, they operate independently, but the global click handler closes the first one
    // wait, the global click handler triggers when we click the second trigger (which is outside the first trigger)
    expect(screen.getAllByRole('tooltip')).toHaveLength(1);
    expect(screen.getByRole('tooltip')).toHaveTextContent(/cryptographically signed/i);
  });
});
