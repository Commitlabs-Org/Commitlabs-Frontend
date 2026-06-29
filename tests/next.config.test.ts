import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('next.config.js', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    delete require.cache[require.resolve('../next.config.js')];
    delete require.cache[require.resolve('@next/bundle-analyzer')];
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function loadConfig() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../next.config.js');
  }

  it('enables the analyzer when ANALYZE is true', () => {
    process.env.ANALYZE = 'true';
    const config = loadConfig();
    
    const mockWebpackConfig = { externals: [], plugins: [] };
    const result = config.webpack(mockWebpackConfig, { isServer: false });
    
    // The real @next/bundle-analyzer adds the BundleAnalyzerPlugin when enabled
    expect(result.plugins.length).toBeGreaterThan(0);
  });

  it('disables the analyzer when ANALYZE is false or unset', () => {
    delete process.env.ANALYZE;
    const config = loadConfig();
    
    const mockWebpackConfig = { externals: [], plugins: [] };
    const result = config.webpack(mockWebpackConfig, { isServer: false });
    
    // When disabled, no plugins are added
    expect(result.plugins.length).toBe(0);
  });

  it('preserves the webpack externals configuration on the server', () => {
    const config = loadConfig();
    
    const mockWebpackConfig = { externals: [], plugins: [] };
    const result = config.webpack(mockWebpackConfig, { isServer: true });
    
    // Ensures our custom webpack config is still applied
    expect(result.externals).toContain('ioredis');
  });

  it('preserves the webpack externals configuration on the client', () => {
    const config = loadConfig();
    const mockWebpackConfig = { externals: [], plugins: [] };
    const result = config.webpack(mockWebpackConfig, { isServer: false });
    expect(result.externals).not.toContain('ioredis');
  });

  it('handles non-array externals in webpack config', () => {
    const config = loadConfig();
    const mockWebpackConfig = { externals: 'some-external', plugins: [] };
    const result = config.webpack(mockWebpackConfig, { isServer: true });
    expect(result.externals).toEqual(['ioredis']);
  });

  it('returns the correct security headers', async () => {
    const config = loadConfig();
    expect(typeof config.headers).toBe('function');
    
    const headers = await config.headers();
    expect(headers.length).toBeGreaterThan(0);
    expect(headers[0].source).toBe('/(.*)');
  });
});
