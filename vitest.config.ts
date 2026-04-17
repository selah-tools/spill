import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['app/**/*.test.ts', 'api/**/*.test.ts', 'lib/**/*.test.ts'],
    isolate: true,
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    sequence: {
      shuffle: true,
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      include: [
        'app/card-slug.ts',
        'app/question-map.ts',
        'app/questions.ts',
        'api/**/*.ts',
        'lib/**/*.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 65,
        lines: 80,
      },
    },
  },
})
