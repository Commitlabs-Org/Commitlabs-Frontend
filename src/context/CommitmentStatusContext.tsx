'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';

export interface CommitmentStatus {
  commitmentId: string;
  status: string;
  daysRemaining: number;
  complianceScore: number;
  currentValue: string;
  violationCount: number;
  expiresAt: string | null;
}

interface CommitmentStatusContextType {
  status: CommitmentStatus | null;
  isLoading: boolean;
  error: string | null;
  refreshStatus: () => Promise<void>;
}

const CommitmentStatusContext = createContext<CommitmentStatusContextType | undefined>(undefined);

interface CommitmentStatusProviderProps {
  commitmentId: string;
  pollIntervalMs?: number;
  children: ReactNode;
}

export const CommitmentStatusProvider: React.FC<CommitmentStatusProviderProps> = ({
  commitmentId,
  pollIntervalMs = 5000,
  children,
}) => {
  const [status, setStatus] = useState<CommitmentStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isHiddenRef = useRef(false);

  const fetchStatus = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(`/api/commitments/${commitmentId}/status`);
      if (!response.ok) {
        throw new Error(`Failed to fetch status: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      setStatus(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [commitmentId]);

  const refreshStatus = useCallback(async () => {
    setIsLoading(true);
    await fetchStatus();
  }, [fetchStatus]);

  const startPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
    }
    pollTimerRef.current = setInterval(() => {
      if (!isHiddenRef.current) {
        fetchStatus();
      }
    }, pollIntervalMs);
  }, [pollIntervalMs, fetchStatus]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      isHiddenRef.current = document.hidden;
      if (!document.hidden) {
        fetchStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchStatus]);

  useEffect(() => {
    fetchStatus();
    startPolling();
    return () => stopPolling();
  }, [commitmentId, fetchStatus, startPolling, stopPolling]);

  return (
    <CommitmentStatusContext.Provider
      value={{
        status,
        isLoading,
        error,
        refreshStatus,
      }}
    >
      {children}
    </CommitmentStatusContext.Provider>
  );
};

export const useCommitmentStatus = (): CommitmentStatusContextType => {
  const context = useContext(CommitmentStatusContext);
  if (!context) {
    throw new Error('useCommitmentStatus must be used within a CommitmentStatusProvider');
  }
  return context;
};
