// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import MyCommitmentsFilters from './MyCommitmentsFilters';

describe('MyCommitmentsFilters', () => {
    const defaultProps = {
        searchQuery: '',
        onSearchChange: vi.fn(),
        status: 'All',
        type: 'All',
        sortBy: 'Newest',
        onStatusChange: vi.fn(),
        onTypeChange: vi.fn(),
        onSortByChange: vi.fn(),
    };

    it('renders all filter controls with default selections', () => {
        render(<MyCommitmentsFilters {...defaultProps} />);

        // Assert search input is rendered with the correct placeholder
        const searchInput = screen.getByPlaceholderText('Search by commitment ID...');
        expect(searchInput).toBeInTheDocument();
        expect(searchInput).toHaveValue('');

        // Assert select dropdowns are rendered with correct values
        const statusSelect = screen.getByDisplayValue('Status: All') as HTMLSelectElement;
        expect(statusSelect).toBeInTheDocument();
        expect(statusSelect.value).toBe('All');

        const typeSelect = screen.getByDisplayValue('Type: All') as HTMLSelectElement;
        expect(typeSelect).toBeInTheDocument();
        expect(typeSelect.value).toBe('All');

        const sortSelect = screen.getByDisplayValue('Sort: Newest') as HTMLSelectElement;
        expect(sortSelect).toBeInTheDocument();
        expect(sortSelect.value).toBe('Newest');
    });

    it('does not render sortBy dropdown when onSortByChange is not provided', () => {
        const { onSortByChange, sortBy, ...propsWithoutSort } = defaultProps;
        render(<MyCommitmentsFilters {...propsWithoutSort} />);

        expect(screen.queryByDisplayValue('Sort: Newest')).not.toBeInTheDocument();
    });

    it('emits onSearchChange when search query is changed', () => {
        const onSearchChange = vi.fn();
        render(<MyCommitmentsFilters {...defaultProps} onSearchChange={onSearchChange} />);

        const searchInput = screen.getByPlaceholderText('Search by commitment ID...');
        fireEvent.change(searchInput, { target: { value: 'commit-123' } });

        expect(onSearchChange).toHaveBeenCalledWith('commit-123');
    });

    it('emits onStatusChange when status selection is changed', () => {
        const onStatusChange = vi.fn();
        render(<MyCommitmentsFilters {...defaultProps} onStatusChange={onStatusChange} />);

        const statusSelect = screen.getByDisplayValue('Status: All');
        fireEvent.change(statusSelect, { target: { value: 'Active' } });

        expect(onStatusChange).toHaveBeenCalledWith('Active');
    });

    it('emits onTypeChange when type selection is changed', () => {
        const onTypeChange = vi.fn();
        render(<MyCommitmentsFilters {...defaultProps} onTypeChange={onTypeChange} />);

        const typeSelect = screen.getByDisplayValue('Type: All');
        fireEvent.change(typeSelect, { target: { value: 'Safe' } });

        expect(onTypeChange).toHaveBeenCalledWith('Safe');
    });

    it('emits onSortByChange when sort selection is changed', () => {
        const onSortByChange = vi.fn();
        render(<MyCommitmentsFilters {...defaultProps} onSortByChange={onSortByChange} />);

        const sortSelect = screen.getByDisplayValue('Sort: Newest');
        fireEvent.change(sortSelect, { target: { value: 'Oldest' } });

        expect(onSortByChange).toHaveBeenCalledWith('Oldest');
    });

    it('asserts the active filter is visually indicated with active class name and correct value', () => {
        const { container } = render(
            <MyCommitmentsFilters
                {...defaultProps}
                status="Settled"
                type="Aggressive"
                sortBy="ValueHighLow"
            />
        );

        // Check select values are set correctly
        const statusSelect = screen.getByDisplayValue('Settled') as HTMLSelectElement;
        const typeSelect = screen.getByDisplayValue('Aggressive') as HTMLSelectElement;
        const sortSelect = screen.getByDisplayValue('Value: High to Low') as HTMLSelectElement;

        expect(statusSelect.value).toBe('Settled');
        expect(typeSelect.value).toBe('Aggressive');
        expect(sortSelect.value).toBe('ValueHighLow');

        // Check visual indication (active class is added when filter is not 'All' or is set for sort)
        // Since we import styles from './MyCommitmentsFilters.module.css', they will map to classes.
        // We can assert that the active styles class name is present in their classList.
        // Class names will look like styles.selectActive, which typically resolves to some mock/original key.
        expect(statusSelect.className).toContain('selectActive');
        expect(typeSelect.className).toContain('selectActive');
        expect(sortSelect.className).toContain('selectActive');
    });

    it('covers the "clear" / "all" reset path', () => {
        const onStatusChange = vi.fn();
        const onTypeChange = vi.fn();

        render(
            <MyCommitmentsFilters
                {...defaultProps}
                status="Active"
                type="Balanced"
                onStatusChange={onStatusChange}
                onTypeChange={onTypeChange}
            />
        );

        // Reset status
        const statusSelect = screen.getByDisplayValue('Active');
        fireEvent.change(statusSelect, { target: { value: 'All' } });
        expect(onStatusChange).toHaveBeenCalledWith('All');

        // Reset type
        const typeSelect = screen.getByDisplayValue('Balanced');
        fireEvent.change(typeSelect, { target: { value: 'All' } });
        expect(onTypeChange).toHaveBeenCalledWith('All');
    });
});
