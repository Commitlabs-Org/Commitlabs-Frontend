/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';

import MarketplaceLoading from '@/app/marketplace/loading';
import CommitmentsLoading from '@/app/commitments/loading';
import CommitmentDetailLoading from '@/app/commitments/[id]/loading';
import CreateLoading from '@/app/create/loading';

afterEach(() => cleanup());

describe('route-level loading boundaries', () => {
  it('marketplace loading renders a skeleton status region', () => {
    const { container } = render(<MarketplaceLoading />);
    expect(container.querySelector('[role="status"]')).not.toBeNull();
  });

  it('commitments loading renders a skeleton status region', () => {
    const { container } = render(<CommitmentsLoading />);
    expect(container.querySelector('[role="status"]')).not.toBeNull();
  });

  it('commitment detail loading renders a skeleton status region', () => {
    const { container } = render(<CommitmentDetailLoading />);
    expect(container.querySelector('[role="status"]')).not.toBeNull();
  });

  it('create loading renders a skeleton status region', () => {
    const { container } = render(<CreateLoading />);
    expect(container.querySelector('[role="status"]')).not.toBeNull();
  });
});
