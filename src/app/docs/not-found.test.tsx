import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import NotFound from '@/app/not-found';

describe('NotFound', () => {
  it('renders the not-found heading and message', () => {
    render(<NotFound />);

    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeDefined();
    expect(screen.getByText('The page you are looking for does not exist.')).toBeDefined();
  });

  it('links back home', () => {
    render(<NotFound />);

    expect(screen.getByRole('link', { name: 'Back home' }).getAttribute('href')).toBe('/');
  });
});
