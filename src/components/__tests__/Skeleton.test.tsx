import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Skeleton } from '../Skeleton';

describe('Skeleton', () => {
  it('renders an aria-hidden placeholder with its sizing props', () => {
    render(
      <Skeleton
        data-testid="skeleton"
        className="custom"
        width={120}
        height={18}
        borderRadius={4}
      />,
    );

    const placeholder = screen.getByTestId('skeleton');
    expect(placeholder.getAttribute('aria-hidden')).toBe('true');
    expect(placeholder.className).toContain('skeleton');
    expect(placeholder.className).toContain('custom');
    expect(placeholder.style.width).toBe('120px');
    expect(placeholder.style.height).toBe('18px');
    expect(placeholder.style.borderRadius).toBe('4px');
  });

  it('does not expose the placeholder as an accessible element', () => {
    render(<Skeleton data-testid="hidden-placeholder" />);

    const placeholder = screen.getByTestId('hidden-placeholder');
    expect(placeholder.getAttribute('aria-hidden')).toBe('true');
    expect(placeholder.textContent).toBe('');
  });
});
