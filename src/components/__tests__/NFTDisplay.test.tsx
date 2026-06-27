/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NFTDisplay from '../NFTDisplay';
import { useToast } from '../toast/ToastProvider';
import { useNftMetadata } from '@/hooks/useNftMetadata';

// Mock dependencies
vi.mock('../toast/ToastProvider', () => ({
  useToast: vi.fn(),
}));

vi.mock('@/hooks/useNftMetadata', () => ({
  useNftMetadata: vi.fn(),
}));

const mockUseToast = useToast as jest.MockedFunction<typeof useToast>;
const mockUseNftMetadata = useNftMetadata as jest.MockedFunction<typeof useNftMetadata>;

describe('NFTDisplay', () => {
  const mockSuccessToast = vi.fn();
  const mockErrorToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseToast.mockReturnValue({
      success: mockSuccessToast,
      error: mockErrorToast,
      info: vi.fn(),
      warning: vi.fn(),
      dismiss: vi.fn(),
      dismissAll: vi.fn(),
    });
    mockUseNftMetadata.mockReturnValue({
      metadata: null,
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    });
  });

  it('renders token ID and basic UI elements', () => {
    render(<NFTDisplay tokenId="test-token-123" />);
    expect(screen.getByText('Token ID')).toBeInTheDocument();
    expect(screen.getByText('test-token-123')).toBeInTheDocument();
  });

  it('renders initial metadata when provided', () => {
    const testMetadata = { name: 'Test NFT', description: 'A test commitment NFT' };
    render(<NFTDisplay tokenId="test-token" metadata={testMetadata} />);
    expect(screen.getByText('Metadata')).toBeInTheDocument();
    expect(screen.getByText('Test NFT')).toBeInTheDocument();
  });

  it('copies token ID to clipboard and shows success toast', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: mockWriteText },
    });

    render(<NFTDisplay tokenId="copy-test-token" />);
    const copyButton = screen.getByRole('button', { name: /Copy Token ID/i });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith('copy-test-token');
      expect(mockSuccessToast).toHaveBeenCalledWith({
        title: 'Token ID copied!',
        description: 'Token ID "copy-test-token" copied to clipboard.',
      });
    });
  });

  it('shows error toast when clipboard copy fails', async () => {
    const mockWriteText = vi.fn().mockRejectedValue(new Error('Clipboard failed'));
    Object.assign(navigator, {
      clipboard: { writeText: mockWriteText },
    });

    render(<NFTDisplay tokenId="fail-token" />);
    const copyButton = screen.getByRole('button', { name: /Copy Token ID/i });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(mockErrorToast).toHaveBeenCalledWith({
        title: 'Failed to copy',
        description: 'Could not copy token ID to clipboard.',
      });
    });
  });

  it('calls refresh when refresh button is clicked', async () => {
    const mockRefresh = vi.fn().mockResolvedValue(undefined);
    mockUseNftMetadata.mockReturnValue({
      metadata: null,
      isLoading: false,
      error: null,
      refresh: mockRefresh,
    });

    render(<NFTDisplay tokenId="refresh-test" metadataUrl="https://example.com/metadata" />);
    const refreshButton = screen.getByRole('button', { name: /Refresh Metadata/i });
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalledTimes(1);
      expect(mockSuccessToast).toHaveBeenCalledWith({
        title: 'Metadata refreshed',
        description: 'NFT metadata has been updated.',
      });
    });
  });

  it('disables refresh button when no metadataUrl is provided', () => {
    render(<NFTDisplay tokenId="no-url" />);
    const refreshButton = screen.getByRole('button', { name: /Refresh Metadata/i });
    expect(refreshButton).toBeDisabled();
  });

  it('shows loading state when refreshing', () => {
    mockUseNftMetadata.mockReturnValue({
      metadata: null,
      isLoading: true,
      error: null,
      refresh: vi.fn(),
    });

    render(<NFTDisplay tokenId="loading-test" metadataUrl="https://example.com" />);
    expect(screen.getByText('Refreshing...')).toBeInTheDocument();
  });

  it('shows error message when metadata fetch fails', () => {
    mockUseNftMetadata.mockReturnValue({
      metadata: null,
      isLoading: false,
      error: 'Failed to fetch metadata: 404 Not Found',
      refresh: vi.fn(),
    });

    render(<NFTDisplay tokenId="error-test" metadataUrl="https://example.com" />);
    expect(screen.getByText('Failed to load metadata')).toBeInTheDocument();
    expect(screen.getByText('Failed to fetch metadata: 404 Not Found')).toBeInTheDocument();
  });

  it('renders fallback when image fails to load', () => {
    render(<NFTDisplay tokenId="image-test" imageUrl="https://invalid-image-url.invalid" />);
    expect(screen.getByText('Commitment NFT')).toBeInTheDocument();
  });
});
