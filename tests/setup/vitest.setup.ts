// Feature flags: enable marketplace for all tests so existing marketplace
// route tests don't break when the gate is active.
process.env.COMMITLABS_FEATURE_MARKETPLACE = 'true';

import '@testing-library/jest-dom/vitest';
import * as axeMatchers from 'vitest-axe/matchers';
import 'vitest-axe/extend-expect';
import { expect } from 'vitest';

expect.extend(axeMatchers);

