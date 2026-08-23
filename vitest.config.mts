import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const alias = { '@': fileURLToPath(new URL('.', import.meta.url)) }

// Two projects, because jsdom is the wrong environment for route handlers:
//
//   unit   — pure functions and client-side helpers, jsdom (as before)
//   routes — API route handlers imported directly and driven with a real
//            NextRequest, node environment, against the local Supabase
//
// The routes project is skipped automatically when SUPABASE_URL is unset, so
// `pnpm test` still works without `supabase start`. Run `pnpm test:routes` to
// require it.
export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: [
            'lib/**/*.test.ts',
            'lib/**/*.test.tsx',
            'components/**/*.test.tsx',
            'scripts/**/*.test.ts',
          ],
          exclude: ['node_modules', '.next'],
        },
      },
      {
        resolve: {
          alias: {
            ...alias,
            // See tests/routes/server-only-stub.ts.
            'server-only': fileURLToPath(
              new URL('./tests/routes/server-only-stub.ts', import.meta.url),
            ),
          },
        },
        test: {
          name: 'routes',
          environment: 'node',
          include: ['tests/routes/**/*.test.ts'],
          exclude: ['node_modules', '.next'],
          setupFiles: ['tests/routes/setup.ts'],
          // Route tests share one database, so they must not interleave.
          fileParallelism: false,
        },
      },
    ],
  },
})
