# Connection status and queued actions

The app now surfaces connectivity state at the shell level so users can see when the browser has lost network access and when the connection is restored.

## What changed

- A global connection banner appears when the browser goes offline and shows a reconnect confirmation when the app comes back online.
- The banner uses an accessible status region and avoids motion for users who prefer reduced motion.
- The create-commitment review step disables submission while offline and shows a short warning so users do not start a write action that cannot complete.

## Behavior

- The banner listens to `navigator.onLine` plus the browser `online` and `offline` events.
- When the app is offline, a persistent banner explains that queued actions will be held until the connection is restored.
- When connectivity returns, the banner switches to a confirmation state and then dismisses automatically.

## Testing

The new hook and banner behavior are covered by dedicated tests under the relevant hook and shell test directories.
