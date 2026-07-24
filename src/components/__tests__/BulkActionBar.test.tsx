import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BulkActionBar } from '../BulkActionBar';

describe('BulkActionBar', () => {
  it('renders nothing when selectedCount is 0', () => {
    const onClear = vi.fn();
    const onExportSelected = vi.fn();

    const { container } = render(
      <BulkActionBar
        selectedCount={0}
        onClear={onClear}
        onExportSelected={onExportSelected}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders action bar when items are selected', () => {
    const onClear = vi.fn();
    const onExportSelected = vi.fn();

    render(
      <BulkActionBar
        selectedCount={3}
        onClear={onClear}
        onExportSelected={onExportSelected}
      />
    );

    expect(screen.getByText('3 commitments selected')).toBeInTheDocument();
    expect(screen.getByText('Export selected')).toBeInTheDocument();
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('renders singular form when 1 item is selected', () => {
    const onClear = vi.fn();
    const onExportSelected = vi.fn();

    render(
      <BulkActionBar
        selectedCount={1}
        onClear={onClear}
        onExportSelected={onExportSelected}
      />
    );

    expect(screen.getByText('1 commitment selected')).toBeInTheDocument();
  });

  it('calls onExportSelected when export button is clicked', () => {
    const onClear = vi.fn();
    const onExportSelected = vi.fn();

    render(
      <BulkActionBar
        selectedCount={2}
        onClear={onClear}
        onExportSelected={onExportSelected}
      />
    );

    const exportButton = screen.getByText('Export selected');
    fireEvent.click(exportButton);

    expect(onExportSelected).toHaveBeenCalledTimes(1);
  });

  it('calls onClear when clear button is clicked', () => {
    const onClear = vi.fn();
    const onExportSelected = vi.fn();

    render(
      <BulkActionBar
        selectedCount={2}
        onClear={onClear}
        onExportSelected={onExportSelected}
      />
    );

    const clearButton = screen.getByText('Clear');
    fireEvent.click(clearButton);

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('disables export button when isExporting is true', () => {
    const onClear = vi.fn();
    const onExportSelected = vi.fn();

    render(
      <BulkActionBar
        selectedCount={2}
        onClear={onClear}
        onExportSelected={onExportSelected}
        isExporting={true}
      />
    );

    const exportButton = screen.getByText('Exporting...');
    expect(exportButton).toBeInTheDocument();
    expect(exportButton).toBeDisabled();
  });

  it('shows custom export label when provided', () => {
    const onClear = vi.fn();
    const onExportSelected = vi.fn();

    render(
      <BulkActionBar
        selectedCount={2}
        onClear={onClear}
        onExportSelected={onExportSelected}
        exportLabel="Download CSV"
      />
    );

    expect(screen.getByText('Download CSV')).toBeInTheDocument();
    expect(screen.queryByText('Export selected')).not.toBeInTheDocument();
  });

  it('has proper ARIA labels for accessibility', () => {
    const onClear = vi.fn();
    const onExportSelected = vi.fn();

    render(
      <BulkActionBar
        selectedCount={2}
        onClear={onClear}
        onExportSelected={onExportSelected}
      />
    );

    const exportButton = screen.getByLabelText('Export 2 selected commitments');
    const clearButton = screen.getByLabelText('Clear selection');

    expect(exportButton).toBeInTheDocument();
    expect(clearButton).toBeInTheDocument();
  });

  it('uses role="status" for live region announcements', () => {
    const onClear = vi.fn();
    const onExportSelected = vi.fn();

    const { container } = render(
      <BulkActionBar
        selectedCount={2}
        onClear={onClear}
        onExportSelected={onExportSelected}
      />
    );

    const statusElement = container.querySelector('[role="status"]');
    expect(statusElement).toBeInTheDocument();
    expect(statusElement).toHaveAttribute('aria-live', 'polite');
    expect(statusElement).toHaveAttribute('aria-atomic', 'true');
  });
});
