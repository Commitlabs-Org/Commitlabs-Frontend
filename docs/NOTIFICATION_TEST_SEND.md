# Notification Test Send

## Overview

To improve user confidence in the notification settings, we added per-channel "Send test" controls inside the `NotificationToggle` components used in the settings page. This allows users to manually verify that their notification configurations for different channels are working correctly.

## Implementation Details

1. **`useTestNotification` hook**:
   - Manages the in-flight state of a test send.
   - Triggers an API call to `/api/notifications/test` with the respective `channelId`.
   - Uses the application's `ToastProvider` to display the success or error feedback to the user.
   - Debounces concurrent click attempts to prevent spamming the API.

2. **`NotificationToggle` extension**:
   - Integrated the test send button next to the toggle switch.
   - The button is disabled when the notification toggle is off, preventing the user from testing a disabled channel.
   - Has accessible labels and a clear loading state ("Sending...") to indicate the operation is in progress.

## API Endpoint Reference

The test triggers a `POST` request to `/api/notifications/test` with the following JSON body:
```json
{
  "channel": "<channel_id>"
}
```
Currently, the test simulates the behavior for UI feedback purposes.

## Testing

Comprehensive RTL tests cover the test-send button behaviors, verifying that it gets disabled during the send process, properly triggers the fetch call, and handles API error states gracefully. See `src/components/settings/NotificationTestSend.test.tsx`.
