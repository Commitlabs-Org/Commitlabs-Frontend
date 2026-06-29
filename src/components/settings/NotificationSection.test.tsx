/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { NotificationSection } from './NotificationSection'
import { NotificationToggle } from './NotificationToggle'

describe('NotificationSection', () => {
  const renderSection = (
    preferences: Record<string, boolean>,
    onChange: (key: string, enabled: boolean) => void
  ) => {
    return render(
      <NotificationSection title="Test Section" description="Section Description">
        {Object.entries(preferences).map(([key, enabled]) => (
          <NotificationToggle
            key={key}
            id={key}
            label={`Toggle ${key}`}
            description={`Description for ${key}`}
            enabled={enabled}
            onChange={(val) => onChange(key, val)}
          />
        ))}
      </NotificationSection>
    )
  }

  it('renders the section header and description', () => {
    renderSection({ a: true }, vi.fn())
    expect(screen.getByText('Test Section')).toBeInTheDocument()
    expect(screen.getByText('Section Description')).toBeInTheDocument()
  })

  it('renders grouped toggles and forwards changes (mixed states)', () => {
    const handleChange = vi.fn()
    renderSection({ a: true, b: false }, handleChange)
    
    expect(screen.getByLabelText('Toggle a')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /Toggle a/i })).toBeChecked()
    
    expect(screen.getByLabelText('Toggle b')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /Toggle b/i })).not.toBeChecked()

    fireEvent.click(screen.getByRole('switch', { name: /Toggle b/i }))
    expect(handleChange).toHaveBeenCalledWith('b', true)
  })

  it('handles all-on state correctly', () => {
    const handleChange = vi.fn()
    renderSection({ a: true, b: true, c: true }, handleChange)
    
    const switches = screen.getAllByRole('switch')
    expect(switches).toHaveLength(3)
    switches.forEach(s => expect(s).toBeChecked())
  })

  it('handles all-off state correctly', () => {
    const handleChange = vi.fn()
    renderSection({ a: false, b: false, c: false }, handleChange)
    
    const switches = screen.getAllByRole('switch')
    expect(switches).toHaveLength(3)
    switches.forEach(s => expect(s).not.toBeChecked())
  })

  it('handles single toggle correctly', () => {
    const handleChange = vi.fn()
    renderSection({ single: true }, handleChange)
    
    const switches = screen.getAllByRole('switch')
    expect(switches).toHaveLength(1)
    expect(switches[0]).toBeChecked()
    
    fireEvent.click(switches[0])
    expect(handleChange).toHaveBeenCalledWith('single', false)
  })

  it('handles empty preferences without crashing', () => {
    renderSection({}, vi.fn())
    expect(screen.getByText('Test Section')).toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })
})
