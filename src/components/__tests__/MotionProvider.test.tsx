/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MotionProvider } from '../MotionProvider'
import React from 'react'
import '@testing-library/jest-dom'

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>()
  return {
    ...actual,
    MotionConfig: vi.fn(({ children, reducedMotion }) => (
      <div data-testid="motion-config" data-reduced-motion={reducedMotion}>
        {children}
      </div>
    )),
  }
})

describe('MotionProvider', () => {
  it('renders children and wraps them in MotionConfig with reducedMotion="user"', () => {
    const { getByTestId, getByText } = render(
      <MotionProvider>
        <div>Test Child</div>
      </MotionProvider>
    )

    const child = getByText('Test Child')
    expect(child).toBeInTheDocument()

    const wrapper = getByTestId('motion-config')
    expect(wrapper).toBeInTheDocument()
    expect(wrapper.getAttribute('data-reduced-motion')).toBe('user')
  })
})
