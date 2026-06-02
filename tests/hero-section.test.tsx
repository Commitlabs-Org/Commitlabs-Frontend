import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { HeroSection } from '@/src/components/landing-page/sections/HeroSection';

describe('HeroSection CTA hierarchy', () => {
  it('renders primary and secondary CTA buttons with correct links', () => {
    render(<HeroSection />);
    const primaryBtn = screen.getByRole('link', { name: /create commitment/i });
    const secondaryBtn = screen.getByRole('link', { name: /explore marketplace/i });
    expect(primaryBtn).toBeInTheDocument();
    expect(primaryBtn).toHaveAttribute('href', '/create');
    expect(secondaryBtn).toBeInTheDocument();
    expect(secondaryBtn).toHaveAttribute('href', '/marketplace');
  });
});
