import { useState, useCallback } from 'react';
import { useToast } from '@/components/toast/ToastProvider';
import { apiRequest } from '@/lib/client/apiClient';

export function useTestNotification(channelId: string) {
  const [isSending, setIsSending] = useState(false);
  const { success, error } = useToast();

  const sendTest = useCallback(async () => {
    if (isSending || !channelId) return;

    setIsSending(true);
    try {
      // Simulate an API call to a test path
      await apiRequest('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: channelId }),
      });

      // Simulate network delay for effect
      await new Promise((resolve) => setTimeout(resolve, 800));

      success({
        title: 'Test Sent',
        description: `Test notification sent successfully to the ${channelId} channel.`,
      });
    } catch (_err) {
      error({
        title: 'Test Failed',
        description: `Failed to send test notification to ${channelId}.`,
      });
    } finally {
      setIsSending(false);
    }
  }, [channelId, isSending, success, error]);

  return { sendTest, isSending };
}
