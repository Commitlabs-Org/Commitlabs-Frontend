import { expect, test } from '@playwright/test';

const ROUTES = ['/', '/create', '/dashboard', '/docs'] as const;

test.describe('Content Security Policy', () => {
  for (const route of ROUTES) {
    test(`${route} returns CSP header and logs no CSP violations`, async ({ page }) => {
      const consoleViolations: string[] = [];

      await page.addInitScript(() => {
        const violations: string[] = [];
        (window as unknown as { __cspViolations: string[] }).__cspViolations = violations;
        document.addEventListener('securitypolicyviolation', (event) => {
          violations.push(
            `${event.violatedDirective}: ${event.blockedURI || 'inline'}`,
          );
        });
      });

      page.on('console', (msg) => {
        const text = msg.text();
        if (
          msg.type() === 'error' &&
          /content security policy|csp|refused to/i.test(text)
        ) {
          consoleViolations.push(text);
        }
      });

      const response = await page.goto(route, { waitUntil: 'networkidle' });
      expect(response, `Expected a response for ${route}`).not.toBeNull();

      const cspHeader = response!.headers()['content-security-policy'];
      expect(cspHeader, `Missing Content-Security-Policy header on ${route}`).toBeTruthy();
      expect(cspHeader).toContain('script-src');
      expect(cspHeader).toMatch(/nonce-[A-Za-z0-9+/=]+/);

      const domViolations = await page.evaluate(
        () => (window as unknown as { __cspViolations?: string[] }).__cspViolations ?? [],
      );

      expect(domViolations, `Unexpected securitypolicyviolation events on ${route}`).toEqual([]);
      expect(consoleViolations, `Unexpected CSP console errors on ${route}`).toEqual([]);
    });
  }
});
