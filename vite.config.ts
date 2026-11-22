import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/car-case-league/',
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
