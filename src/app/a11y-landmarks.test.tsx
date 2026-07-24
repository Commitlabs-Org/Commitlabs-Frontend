// @vitest-environment happy-dom
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import CreateCommitment from './create/page'
import SettingsPage from './settings/page'
import MarketplacePage from './marketplace/page'
import HomePage from './page'
import CommitmentsPage from './commitments/page'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('next/dynamic', () => ({
  default: () => () => <div data-testid="dynamic-component" />,
}))
vi.mock('@/hooks/useWallet', () => ({
  useWallet: () => ({ address: '0x123', isConnected: true }),
}))
vi.mock('@/hooks/useDraftPersistence', () => ({
  useDraftPersistence: () => ({ draft: null, saveDraft: vi.fn(), clearDraft: vi.fn() }),
}))
vi.mock('@/hooks/useGuidedTour', () => ({
  useGuidedTour: () => ({
    isActive: false, currentStepIndex: 0, currentStepConfig: {}, totalSteps: 3,
    nextStep: vi.fn(), prevStep: vi.fn(), skipTour: vi.fn(), startTour: vi.fn()
  }),
}))
vi.mock('@/hooks/useCompareListings', () => ({
  useCompareListings: () => ({ listings: [], isPinned: false, isFull: false, toggleListing: vi.fn(), removeListing: vi.fn(), clearAll: vi.fn() }),
}))
vi.mock('@/hooks/useRecentlyViewed', () => ({
  useRecentlyViewed: () => ({ recentIds: [], addView: vi.fn(), clearAll: vi.fn() }),
}))
vi.mock('@/components/shell/AppShellLayout', () => ({
  AppShellLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}))
vi.mock('@/hooks/useUnsavedChangesGuard', () => ({
  useUnsavedChangesGuard: () => ({ isDirty: false, resetBaseline: vi.fn() }),
}))
vi.mock('@/components/toast/ToastProvider', () => ({
  useToast: () => ({ addToast: vi.fn(), removeToast: vi.fn(), toasts: [] }),
}))
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ addToast: vi.fn(), removeToast: vi.fn(), toasts: [] }),
}))
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: vi.fn(), dismiss: vi.fn() }),
}))

describe('A11y Landmarks and Headings', () => {
  const pages = [
    { name: 'Home', component: HomePage },
    { name: 'Create', component: CreateCommitment },
    { name: 'Settings', component: SettingsPage },
    { name: 'Marketplace', component: MarketplacePage },
    { name: 'Commitments', component: CommitmentsPage },
  ]

  pages.forEach(({ name, component: Page }) => {
    it(`${name} page has exactly one main#main-content and exactly one h1`, () => {
      const { container } = render(<Page />)
      
      const mains = container.querySelectorAll('main#main-content')
      expect(mains.length).toBe(1)
      
      const h1s = container.querySelectorAll('h1')
      expect(h1s.length).toBe(1)
    })
  })
})
