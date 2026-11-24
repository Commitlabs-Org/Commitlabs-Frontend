import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from '@/test/axe';
import RouteError from './error';

describe('RouteError page accessibility', () => {
  it('has no axe violations', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(
      <main id="main-content">
        <RouteError error={Object.assign(new Error('Boom'), { digest: 'abc123' })} reset={vi.fn()} />
      </main>,
    );
    expect(await axe(container)).toHaveNoViolations();
    errSpy.mockRestore();
  });
});
