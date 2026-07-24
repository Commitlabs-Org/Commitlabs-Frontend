# Maturity Countdown Badge

## Overview
The `MaturityCountdown` component calculates and displays the remaining time until a specified Unix timestamp. It updates every 60 seconds and visually communicates urgency through CSS status classes.

## Usage
```tsx
import { MaturityCountdown } from 'src/components/MaturityCountdown';

// Pass the target timestamp in milliseconds
<MaturityCountdown maturityTimestamp={1719681000000} />