import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { AppSidebar } from './AppSidebar'

// Mock Next.js navigation hooks
const mockPush = vi.fn()
const mockPathname = '/'

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    aside: ({ children, ...props }: any) => <aside {...props}>{children}</aside>,
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

describe('AppSidebar', () => {
  beforeEach(() => {
    // Clear sessionStorage before each test
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    sessionStorage.clear()
  })

  describe('Rendering', () => {
    it('renders the sidebar with all navigation items', () => {
      render(<AppSidebar />)
      
      expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /marketplace/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /create/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /commitments/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument()
    })

    it('renders the CommitLabs logo and branding', () => {
      render(<AppSidebar />)
      
      expect(screen.getByText('CommitLabs')).toBeInTheDocument()
      expect(screen.getByText('C')).toBeInTheDocument()
    })

    it('applies custom className prop', () => {
      const { container } = render(<AppSidebar className="custom-class" />)
      const sidebar = container.querySelector('aside')
      
      expect(sidebar).toHaveClass('custom-class')
    })
  })

  describe('Active Route Highlighting', () => {
    it('highlights the home link when on home page', () => {
      vi.mocked(require('next/navigation').usePathname).mockReturnValue('/')
      render(<AppSidebar />)
      
      const homeLink = screen.getByRole('link', { name: /home/i })
      expect(homeLink).toHaveClass('bg-[#0FF0FC]/10')
      expect(homeLink).toHaveClass('text-[#0FF0FC]')
      expect(homeLink).toHaveAttribute('aria-current', 'page')
    })

    it('highlights the marketplace link when on marketplace page', () => {
      vi.mocked(require('next/navigation').usePathname).mockReturnValue('/marketplace')
      render(<AppSidebar />)
      
      const marketplaceLink = screen.getByRole('link', { name: /marketplace/i })
      expect(marketplaceLink).toHaveClass('bg-[#0FF0FC]/10')
      expect(marketplaceLink).toHaveAttribute('aria-current', 'page')
    })

    it('highlights the create link when on create page', () => {
      vi.mocked(require('next/navigation').usePathname).mockReturnValue('/create')
      render(<AppSidebar />)
      
      const createLink = screen.getByRole('link', { name: /create/i })
      expect(createLink).toHaveAttribute('aria-current', 'page')
    })

    it('highlights commitments link for nested commitment routes', () => {
      vi.mocked(require('next/navigation').usePathname).mockReturnValue('/commitments/CMT-123')
      render(<AppSidebar />)
      
      const commitmentsLink = screen.getByRole('link', { name: /commitments/i })
      expect(commitmentsLink).toHaveAttribute('aria-current', 'page')
    })
  })

  describe('Collapse Functionality', () => {
    it('toggles collapsed state when collapse button is clicked', () => {
      render(<AppSidebar />)
      
      // Initially expanded
      expect(screen.getByText('CommitLabs')).toBeInTheDocument()
      expect(screen.getByText('Home')).toBeInTheDocument()
      
      // Find and click collapse button
      const collapseButton = screen.getByRole('button', { name: /collapse sidebar/i })
      fireEvent.click(collapseButton)
      
      // Should be collapsed now
      expect(screen.queryByText('Home')).not.toBeInTheDocument()
    })

    it('persists collapsed state to sessionStorage', () => {
      render(<AppSidebar />)
      
      const collapseButton = screen.getByRole('button', { name: /collapse sidebar/i })
      fireEvent.click(collapseButton)
      
      expect(sessionStorage.getItem('sidebar-collapsed')).toBe('true')
    })

    it('loads collapsed state from sessionStorage on mount', () => {
      sessionStorage.setItem('sidebar-collapsed', 'true')
      
      render(<AppSidebar />)
      
      // Should be collapsed based on sessionStorage
      expect(screen.queryByText('Home')).not.toBeInTheDocument()
    })

    it('shows tooltips on nav items when collapsed', () => {
      sessionStorage.setItem('sidebar-collapsed', 'true')
      render(<AppSidebar />)
      
      const homeLink = screen.getByRole('link', { name: /home/i })
      expect(homeLink).toHaveAttribute('title', 'Home')
    })
  })

  describe('Mobile Functionality', () => {
    it('renders mobile menu toggle button', () => {
      render(<AppSidebar />)
      
      const toggleButton = screen.getByRole('button', { name: /toggle navigation menu/i })
      expect(toggleButton).toBeInTheDocument()
    })

    it('opens mobile menu when toggle button is clicked', () => {
      render(<AppSidebar />)
      
      const toggleButton = screen.getByRole('button', { name: /toggle navigation menu/i })
      fireEvent.click(toggleButton)
      
      expect(toggleButton).toHaveAttribute('aria-expanded', 'true')
    })

    it('renders close button in mobile menu', () => {
      render(<AppSidebar />)
      
      const toggleButton = screen.getByRole('button', { name: /toggle navigation menu/i })
      fireEvent.click(toggleButton)
      
      const closeButton = screen.getByRole('button', { name: /close navigation menu/i })
      expect(closeButton).toBeInTheDocument()
    })

    it('closes mobile menu when close button is clicked', () => {
      render(<AppSidebar />)
      
      const toggleButton = screen.getByRole('button', { name: /toggle navigation menu/i })
      fireEvent.click(toggleButton)
      
      const closeButton = screen.getByRole('button', { name: /close navigation menu/i })
      fireEvent.click(closeButton)
      
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false')
    })

    it('closes mobile menu when a navigation link is clicked', () => {
      render(<AppSidebar />)
      
      const toggleButton = screen.getByRole('button', { name: /toggle navigation menu/i })
      fireEvent.click(toggleButton)
      
      const marketplaceLink = screen.getByRole('link', { name: /marketplace/i })
      fireEvent.click(marketplaceLink)
      
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false')
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels on navigation', () => {
      render(<AppSidebar />)
      
      const nav = screen.getByRole('navigation')
      expect(nav).toHaveAttribute('aria-label', 'Main navigation')
    })

    it('sets aria-current on active navigation items', () => {
      vi.mocked(require('next/navigation').usePathname).mockReturnValue('/marketplace')
      render(<AppSidebar />)
      
      const marketplaceLink = screen.getByRole('link', { name: /marketplace/i })
      expect(marketplaceLink).toHaveAttribute('aria-current', 'page')
    })

    it('has proper aria-expanded on collapse button', () => {
      render(<AppSidebar />)
      
      const collapseButton = screen.getByRole('button', { name: /collapse sidebar/i })
      expect(collapseButton).toHaveAttribute('aria-expanded', 'true')
      
      fireEvent.click(collapseButton)
      expect(collapseButton).toHaveAttribute('aria-expanded', 'false')
    })

    it('has proper aria-label on mobile toggle button', () => {
      render(<AppSidebar />)
      
      const toggleButton = screen.getByRole('button', { name: /toggle navigation menu/i })
      expect(toggleButton).toHaveAttribute('aria-label', 'Toggle navigation menu')
    })

    it('handles keyboard navigation correctly', () => {
      render(<AppSidebar />)
      
      const toggleButton = screen.getByRole('button', { name: /toggle navigation menu/i })
      fireEvent.click(toggleButton)
      
      // Simulate Escape key to close
      fireEvent.keyDown(document, { key: 'Escape' })
      
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false')
    })
  })

  describe('Navigation Links', () => {
    it('all navigation links have correct href attributes', () => {
      render(<AppSidebar />)
      
      expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/')
      expect(screen.getByRole('link', { name: /marketplace/i })).toHaveAttribute('href', '/marketplace')
      expect(screen.getByRole('link', { name: /create/i })).toHaveAttribute('href', '/create')
      expect(screen.getByRole('link', { name: /commitments/i })).toHaveAttribute('href', '/commitments')
      expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute('href', '/settings')
    })

    it('renders icons for all navigation items', () => {
      const { container } = render(<AppSidebar />)
      
      // Each nav item should have an icon (svg)
      const navSection = screen.getByRole('navigation')
      const svgs = within(navSection).getAllByRole('link')
      
      expect(svgs.length).toBe(5) // 5 navigation items
    })
  })

  describe('Edge Cases', () => {
    it('handles missing sessionStorage gracefully', () => {
      const originalGetItem = Storage.prototype.getItem
      Storage.prototype.getItem = vi.fn(() => null)
      
      expect(() => render(<AppSidebar />)).not.toThrow()
      
      Storage.prototype.getItem = originalGetItem
    })

    it('handles rapid toggle clicks', () => {
      render(<AppSidebar />)
      
      const collapseButton = screen.getByRole('button', { name: /collapse sidebar/i })
      
      // Rapid clicks
      fireEvent.click(collapseButton)
      fireEvent.click(collapseButton)
      fireEvent.click(collapseButton)
      
      expect(() => screen.getByRole('navigation')).not.toThrow()
    })

    it('handles navigation to root path correctly', () => {
      vi.mocked(require('next/navigation').usePathname).mockReturnValue('/')
      render(<AppSidebar />)
      
      const homeLink = screen.getByRole('link', { name: /home/i })
      expect(homeLink).toHaveAttribute('aria-current', 'page')
      
      // Other links should not be active
      expect(screen.getByRole('link', { name: /marketplace/i })).not.toHaveAttribute('aria-current')
    })
  })
})
