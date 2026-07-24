import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Design Tokens', () => {
  it('should define essential CSS variables in globals.css', () => {
    // Read the globals.css file
    const cssPath = path.resolve(__dirname, '../src/app/globals.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    // Expected tokens to be present
    const expectedTokens = [
      '--surface-primary',
      '--surface-secondary',
      '--text-primary',
      '--text-secondary',
      '--accent-teal',
      '--accent-teal-rgb',
      '--accent-green',
      '--accent-danger',
      '--border-subtle',
      '--border-teal',
    ];

    expectedTokens.forEach((token) => {
      expect(cssContent).toContain(token);
    });

    // Also assert they are defined under :root
    const rootBlockRegex = /:root\s*{([^}]*)}/;
    const match = cssContent.match(rootBlockRegex);
    
    expect(match).toBeTruthy();
    
    if (match) {
      const rootContent = match[1];
      expectedTokens.forEach((token) => {
        expect(rootContent).toContain(token);
      });
    }
  });
});
