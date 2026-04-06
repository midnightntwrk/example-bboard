import { defineConfig } from 'vitest/config';

export default defineConfig({
  mode: 'node',
  test: {
    testTimeout: 1000 * 60 * 5,
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules'],
    pool: 'forks',
    deps: {
      external: [/@midnight-ntwrk/],
      interopDefault: true,
    },
  },
  resolve: {
    // Use the 'node' export condition so @midnight-ntwrk/onchain-runtime-* loads
    // via the fs-based WASM initializer instead of the browser WASM import variant.
    conditions: ['import', 'node', 'default'],
  },
  ssr: {
    external: [/@midnight-ntwrk/],
  },
});
