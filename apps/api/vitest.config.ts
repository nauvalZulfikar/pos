import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 10_000,
    hookTimeout: 10_000,
    setupFiles: ['./vitest.setup.ts'],
    /**
     * Don't run vitest in worker processes — our singleton db/redis modules
     * confuse Node's module loader when run across multiple workers.
     */
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
