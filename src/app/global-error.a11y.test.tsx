import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from '@/test/axe';
import GlobalError from './global-error';

describe('GlobalError page accessibility', () => {
  it('has no axe violations', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(
      <GlobalError error={Object.assign(new Error('Critical failure'), { digest: 'xyz789' })} reset={vi.fn()} />,
    );
    expect(await axe(container)).toHaveNoViolations();
    errSpy.mockRestore();
  });
});
