import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import CommitmentDetailHeader from '../Commitmentdetailheader';

// Helper to create a mock response for a successful timeline fetch.
const mockSuccessfulTimeline = (overrides: { page?: number; totalPages?: number; total?: number; empty?: boolean } = {}) =>
  (gurl: string | RequestInfo | URL): Promise<Response> => {
    const url = new URL(gurl, 'http://localhost');
    const page = Number(url.searchParams.get('page') || '1');
    const { totalPages = 1, total = 10, empty = false } = overrides;
    const events = empty
      ? []
      : [
          {
            id: `evt_${page}_${Date.now()}`,
            type: `commitment.${page}`,
            createdAt: new Date().toISOString(),
            data: { message: `Event on page ${page}` },
          },
        ];
    const pagination = {
      page,
      pageSize: 10,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ events, pagination }),
    } as Response);
  };

describe('CommitmentDetailHeader', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('fetches and displays commitment events with pagination', async () => {
    global.fetch = mockSuccessfulTimeline();

    render(<CommitmentDetailHeader commitmentId="cm_1" />);

    // Loading state
    expect(screen.getByText(/loading/i)).toBeInDocument();

    // Successful state
    expect(await screen.findByText('commitment.1')).toBeInDocument();
    expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInDocument();
    expect(screen.getByText(/Page 1 of 1/i)).toBeInDocument();
    expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled();
  });

  it('displays empty state when there are no events', async () => {
    global.fetch = mockSuccessfulTimeline({ empty: true });

    render(<CommitmentDetailHeader commitmentId="cm_1" />);

    expect(await screen.findByText(/no events/i)).toBeInDocument();
    expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInDocument();
  });

  it('shows error and recovers on retry', async () => {
    const fetchMock = jest.fn()
      .mockResolvedOnce({ ok: false, status: 500, json: async () => ({ error: 'Internal Server Error' }) } as Response)
      .mockResolvedOnce({ ok: true, status: 200, json: async () => ({ events: [{ id: 'evt_2', type: 'commitment.2', createdAt: new Date().toISOString(), data: {} }], pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1, hasNextPage: false, hasPreviousPage: false } }) } as Response);
    global.fetch = fetchMock;

    render(<CommitmentDetailHeader commitmentId="cm_1" />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/failed/i);
    const retryButton = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryButton);

    expect(await screen.findByText('commitment.2')).toBeInDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('displays permission denied when the API returns 403', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'Forbidden' }) } as Response);

    render(<CommitmentDetailHeader commitmentId="cm_1" />);

    expect(await screen.findByText(/permission|forbidden|not authorized/i)).toBeInDocument();
  });

  it('disables pagination buttons at boundaries', async () => {
    const fetchMock = jest.fn().mockImplementation((url: string) => {
      const page = new URL(url, 'http://localhost').searchParams.get('page') || '1';
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          events: [{ id: `evt_${page}`, type: `event-${page}`, createdAt: new Date().toISOString(), data: {} }],
          pagination: {
            page: Number(page),
            pageSize: 10,
            total: 5,
            totalPages: 1,
            hasNextPage: page < 1,
            hasPreviousPage: page > 1,
          },
        }),
      } as Response);
    });
    global.fetch = fetchMock;

    render(<CommitmentDetailHeader commitmentId="cm_1" />);

    const nextButton = await screen.findByRole('button', { name: /next page/i });
    expect(nextButton).toBeDisabled();

    const prevButton = screen.getByRole('button', { name: /previous page/i });
    expect(prevButton).toBeDisabled();
  });

  it('keyboard users can activate next page button', async () => {
    const user = userEvent.setup();
    const fetchMock = jest.fn().mockImplementation((url: string) => {
      const page = Number(new URL(url, 'http://localhost').searchParams.get('page') || '1');
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          events: [{ id: `evt_${page}`, type: `event-${page}`, createdAt: new Date().toISOString(), data: {} }],
          pagination: { page, pageSize: 10, total: 25, totalPages: 3, hasNextPage: page < 3, hasPreviousPage: page > 1 },
        }),
      } as Response);
    });
    global.fetch = fetchMock;

    render(<CommitmentDetailHeader commitmentId="cm_1" />);

    const nextButton = await screen.findByRole('button', { name: /next page/i });
    nextButton.focus();
    expect(nextButton).toHaveFocus();

    await user.keyboard('{Enter}');

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('page=2')));
    expect(await screen.findByText('event-2')).toBeInDocument();
  });

  it('exposes accessible names, landmarks, and live regions', async () => {
    global.fetch = mockSuccessfulTimeline();

    render(<CommitmentDetailHeader commitmentId="cm_1" />);

    const nav = await screen.findByRole('navigation', { name: /pagination/i });
    expect(nav).toHaveAttribute('aria-label', 'Pagination');

    const list = screen.getByRole('list', { name: /commitment events/i });
    expect(list).toBeInDocument();

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  it('queries responsive and reduced-motion media features', async () => {
    const mediaQueries = new Map<string, boolean>();
    mediaQueries.set('(max-width: 640px)', true);
    mediaQueries.set('(prefers-reduced-motion: reduce)', true);
    const matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: mediaQueries.get(query) ?? false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
    Object.defineProperty(window, 'matchMedia', { writable: true, value: matchMedia });

    global.fetch = mockSuccessfulTimeline();

    render(<CommitmentDetailHeader commitmentId="cm_1" />);

    await screen.findByRole('navigation', { name: /pagination/i });

    expect(matchMedia).toHaveBeenCalledWith('(max-width: 640px)');
    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });
});
