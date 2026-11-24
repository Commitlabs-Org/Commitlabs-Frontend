import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from '@/test/axe';
import NotFound from './not-found';

describe('NotFound page accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = render(
      <main id="main-content">
        <NotFound />
      </main>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
